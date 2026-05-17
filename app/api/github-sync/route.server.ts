import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import { DATA_DIR } from "@/lib/server/paths";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!verifySession(token);
}

const CONFIG_FILE = path.join(DATA_DIR, ".sync-config.json");

/** GitHub 配置 */
type SyncConfig = {
	repoUrl: string;
	token: string;
	branch: string;
};

/** 读取 GitHub 配置（仓库地址/分支从文件，token从环境变量） */
function readSyncConfig(): SyncConfig | null {
	if (!fs.existsSync(CONFIG_FILE)) return null;
	try {
		const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
		// token 从环境变量读取
		const token = process.env.GITHUB_TOKEN;
		if (!token) return null;
		return {
			repoUrl: data.repoUrl,
			token,
			branch: data.branch || "main",
		};
	} catch {
		return null;
	}
}

/** 写入 GitHub 配置（不保存 token） */
function writeSyncConfig(config: Omit<SyncConfig, "token">): void {
	fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/** 删除配置 */
function deleteSyncConfig(): void {
	if (fs.existsSync(CONFIG_FILE)) {
		fs.unlinkSync(CONFIG_FILE);
	}
}

/** 排除的文件名列表（不会被同步到 GitHub） */
const EXCLUDED_FILES = new Set([".gitkeep", ".sync-config.json", ".webdav-config.json"]);

/** 检查文件是否被排除（隐藏文件或指定排除文件） */
function isExcluded(fileName: string): boolean {
	// 排除隐藏文件（以 . 开头）
	if (fileName.startsWith(".")) return true;
	// 排除指定文件
	if (EXCLUDED_FILES.has(fileName)) return true;
	return false;
}

/** 从 GitHub 仓库 URL 中提取 owner 和 repo */
function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
	const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
	if (match) return { owner: match[1], repo: match[2] };
	const parts = repoUrl.split("/");
	if (parts.length === 2) return { owner: parts[0], repo: parts[1] };
	throw new Error("无效的仓库地址格式");
}

/** 递归读取目录下所有文件（排除指定文件） */
function readDirRecursive(dir: string, base: string = dir): { path: string; content: string; encoding: "utf-8" | "base64" }[] {
	const results: { path: string; content: string; encoding: "utf-8" | "base64" }[] = [];
	if (!fs.existsSync(dir)) return results;

	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		const relPath = path.relative(base, fullPath).replace(/\\/g, "/");

		if (entry.isDirectory()) {
			results.push(...readDirRecursive(fullPath, base));
		} else {
			// 跳过排除的文件
			if (isExcluded(entry.name)) continue;
			const buffer = fs.readFileSync(fullPath);
			const isText = !buffer.some((b) => b === 0);
			if (isText) {
				results.push({ path: relPath, content: buffer.toString("utf-8"), encoding: "utf-8" });
			} else {
				results.push({ path: relPath, content: buffer.toString("base64"), encoding: "base64" });
			}
		}
	}
	return results;
}

/** GitHub API 请求封装 */
async function githubApi(
	token: string,
	url: string,
	options: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
	const res = await fetch(url, {
		...options,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"X-GitHub-Api-Version": "2022-11-28",
			...(options.headers || {}),
		},
	});
	const data = (await res.json().catch(() => ({}))) as unknown;
	return { ok: res.ok, status: res.status, data };
}

/** 获取当前分支的 commit SHA */
async function getBranchSha(token: string, owner: string, repo: string, branch: string): Promise<string | null> {
	const { ok, data } = await githubApi(token, `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`);
	if (!ok) return null;
	return (data as { object?: { sha?: string } })?.object?.sha ?? null;
}

/** 获取当前分支的树 SHA */
async function getTreeSha(token: string, owner: string, repo: string, commitSha: string): Promise<string | null> {
	const { ok, data } = await githubApi(token, `https://api.github.com/repos/${owner}/${repo}/git/commits/${commitSha}`);
	if (!ok) return null;
	return (data as { tree?: { sha?: string } })?.tree?.sha ?? null;
}

/** 创建新的树 */
async function createTree(
	token: string,
	owner: string,
	repo: string,
	baseTreeSha: string,
	files: { path: string; content: string; encoding: "utf-8" | "base64" }[],
): Promise<string | null> {
	const { ok, data } = await githubApi(token, `https://api.github.com/repos/${owner}/${repo}/git/trees`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			base_tree: baseTreeSha,
			tree: files.map((f) => ({
				path: f.path,
				mode: "100644",
				type: "blob",
				content: f.encoding === "base64" ? Buffer.from(f.content, "base64").toString("utf-8") : f.content,
			})),
		}),
	});
	if (!ok) return null;
	return (data as { sha?: string })?.sha ?? null;
}

/** 创建新的 commit */
async function createCommit(
	token: string,
	owner: string,
	repo: string,
	message: string,
	treeSha: string,
	parentSha: string,
): Promise<string | null> {
	const { ok, data } = await githubApi(token, `https://api.github.com/repos/${owner}/${repo}/git/commits`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
	});
	if (!ok) return null;
	return (data as { sha?: string })?.sha ?? null;
}

/** 更新分支指向新的 commit */
async function updateRef(token: string, owner: string, repo: string, branch: string, commitSha: string): Promise<boolean> {
	const { ok } = await githubApi(token, `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ sha: commitSha }),
	});
	return ok;
}

/** 同步到 GitHub */
async function syncToGitHub(config: SyncConfig): Promise<{ commitSha: string; fileCount: number }> {
	const { owner, repo } = parseRepoUrl(config.repoUrl);

	// 1. 读取本地文件
	const files = readDirRecursive(DATA_DIR);
	if (files.length === 0) {
		throw new Error("data 目录为空");
	}

	// 2. 获取当前分支的 commit SHA
	const parentSha = await getBranchSha(config.token, owner, repo, config.branch);
	if (!parentSha) {
		throw new Error(`获取分支 ${config.branch} 失败，请检查仓库地址和 Token`);
	}

	// 3. 获取当前树 SHA
	const baseTreeSha = await getTreeSha(config.token, owner, repo, parentSha);
	if (!baseTreeSha) {
		throw new Error("获取树对象失败");
	}

	// 4. 创建新的树（文件路径加上 data/ 前缀）
	const filesWithPrefix = files.map(f => ({ ...f, path: `data/${f.path}` }));
	const newTreeSha = await createTree(config.token, owner, repo, baseTreeSha, filesWithPrefix);
	if (!newTreeSha) {
		throw new Error("创建树对象失败");
	}

	// 5. 创建新的 commit
	const commitSha = await createCommit(
		config.token,
		owner,
		repo,
		`Sync from go-nav: ${new Date().toISOString()}`,
		newTreeSha,
		parentSha,
	);
	if (!commitSha) {
		throw new Error("创建提交失败");
	}

	// 6. 更新分支
	const updated = await updateRef(config.token, owner, repo, config.branch, commitSha);
	if (!updated) {
		throw new Error("更新分支失败");
	}

	return { commitSha, fileCount: files.length };
}

/** 从 GitHub 拉取 */
async function pullFromGitHub(config: SyncConfig): Promise<{ fileCount: number }> {
	const { owner, repo } = parseRepoUrl(config.repoUrl);

	// 1. 获取当前分支的 commit SHA
	const commitSha = await getBranchSha(config.token, owner, repo, config.branch);
	if (!commitSha) {
		throw new Error(`获取分支 ${config.branch} 失败`);
	}

	// 2. 获取树对象
	const { ok, data } = await githubApi(
		config.token,
		`https://api.github.com/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`,
	);
	if (!ok) {
		throw new Error("获取文件树失败");
	}

	const tree = (data as { tree?: Array<{ path?: string; type?: string; sha?: string }> })?.tree ?? [];
	// 只处理 data/ 目录下的文件
	const blobs = tree.filter((item) => item.type === "blob" && item.path?.startsWith("data/") && !isExcluded(path.basename(item.path ?? "")));

	// 3. 下载每个文件
	let downloaded = 0;
	for (const item of blobs) {
		if (!item.path || !item.sha) continue;

		const { ok: blobOk, data: blobData } = await githubApi(
			config.token,
			`https://api.github.com/repos/${owner}/${repo}/git/blobs/${item.sha}`,
		);
		if (!blobOk) continue;

		const content = (blobData as { content?: string; encoding?: string })?.content ?? "";
		const encoding = (blobData as { encoding?: string })?.encoding ?? "base64";

		const buffer = encoding === "base64" ? Buffer.from(content, "base64") : Buffer.from(content, "utf-8");

		// 去掉 data/ 前缀，写入本地 data 目录
		const relativePath = item.path.slice(5); // 去掉 "data/" 前缀
		const localPath = path.join(DATA_DIR, relativePath);
		fs.mkdirSync(path.dirname(localPath), { recursive: true });
		fs.writeFileSync(localPath, buffer);
		downloaded++;
	}

	// 4. 清除服务端缓存
	const { revalidatePath } = await import("next/cache");
	revalidatePath("/");

	return { fileCount: downloaded };
}

/** GET: 读取配置 */
export async function GET() {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未授权" }, { status: 401 });
	}

	const config = readSyncConfig();
	if (!config) {
		return NextResponse.json({ saved: false });
	}

	// 验证仓库信息
	let verifyInfo: { user: string; repo: string; branch: string } | null = null;
	try {
		const { owner, repo } = parseRepoUrl(config.repoUrl);
		const { ok, data } = await githubApi(config.token, `https://api.github.com/repos/${owner}/${repo}`);
		if (ok) {
			const fullName = (data as { full_name?: string })?.full_name ?? `${owner}/${repo}`;
			const [userName, repoName] = fullName.split("/");
			verifyInfo = { user: userName ?? owner, repo: repoName ?? repo, branch: config.branch };
		}
	} catch {
		// ignore
	}

	return NextResponse.json({
		saved: true,
		repoUrl: config.repoUrl,
		branch: config.branch,
		hasToken: true,
		verifyInfo,
	});
}

/** POST: 推送到 GitHub */
export async function POST() {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未授权" }, { status: 401 });
	}

	const config = readSyncConfig();
	if (!config) {
		return NextResponse.json({ error: "未配置 GitHub" }, { status: 400 });
	}

	try {
		const { commitSha, fileCount } = await syncToGitHub(config);

		return NextResponse.json({
			success: true,
			message: "推送成功",
			commitSha,
			fileCount,
			time: new Date().toISOString(),
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "推送失败";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

/** PUT: 保存配置并验证 */
export async function PUT(request: Request) {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未授权" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { repoUrl, branch = "main" } = body;

		if (!repoUrl) {
			return NextResponse.json({ error: "请填写仓库地址" }, { status: 400 });
		}

		// token 从环境变量读取
		const token = process.env.GITHUB_TOKEN;
		if (!token) {
			return NextResponse.json({ error: "未设置 GITHUB_TOKEN 环境变量" }, { status: 400 });
		}

		// 验证仓库
		const { owner, repo } = parseRepoUrl(repoUrl);
		const { ok, data } = await githubApi(token, `https://api.github.com/repos/${owner}/${repo}`);
		if (!ok) {
			return NextResponse.json({ error: "验证失败，请检查仓库地址和 Token" }, { status: 400 });
		}

		// 保存配置（不包含 token）
		writeSyncConfig({ repoUrl, branch });

		const fullName = (data as { full_name?: string })?.full_name ?? `${owner}/${repo}`;
		const [userName, repoName] = fullName.split("/");

		return NextResponse.json({
			success: true,
			message: "验证通过，配置已保存",
			verifyInfo: { user: userName ?? owner, repo: repoName ?? repo, branch },
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "验证失败";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

/** PATCH: 从 GitHub 拉取 */
export async function PATCH() {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未授权" }, { status: 401 });
	}

	const config = readSyncConfig();
	if (!config) {
		return NextResponse.json({ error: "未配置 GitHub" }, { status: 400 });
	}

	try {
		const { fileCount } = await pullFromGitHub(config);

		return NextResponse.json({
			success: true,
			message: "拉取成功",
			fileCount,
			time: new Date().toISOString(),
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "拉取失败";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

/** DELETE: 清除配置 */
export async function DELETE() {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未授权" }, { status: 401 });
	}

	deleteSyncConfig();
	return NextResponse.json({ success: true, message: "配置已清除" });
}
