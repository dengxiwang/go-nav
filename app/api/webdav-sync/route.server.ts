import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import { DATA_DIR } from "@/lib/server/paths";
import { createZip, parseZip } from "@/lib/server/zip";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!verifySession(token);
}

const CONFIG_FILE = path.join(DATA_DIR, ".webdav-config.json");

/** WebDAV 配置 */
type WebDavConfig = {
	url: string;
	username: string;
	password: string;
	remotePath: string;
};

/** 读取 WebDAV 配置（URL/用户名/远程目录从文件，密码从环境变量） */
function readWebDavConfig(): WebDavConfig | null {
	if (!fs.existsSync(CONFIG_FILE)) return null;
	try {
		const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
		// 密码从环境变量读取
		const password = process.env.WEBDAV_PASSWORD;
		if (!password) return null;
		return {
			url: data.url,
			username: data.username,
			password,
			remotePath: data.remotePath || "/go-nav/backups",
		};
	} catch {
		return null;
	}
}

/** 写入 WebDAV 配置（不保存密码） */
function writeWebDavConfig(config: Omit<WebDavConfig, "password">): void {
	fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/** 删除配置 */
function deleteWebDavConfig(): void {
	if (fs.existsSync(CONFIG_FILE)) {
		fs.unlinkSync(CONFIG_FILE);
	}
}

/** 排除的文件名列表 */
const EXCLUDED_FILES = new Set([".gitkeep", ".sync-config.json", ".webdav-config.json"]);

/** 生成备份文件名：backup_20250517_143022.zip */
function backupFileName(date?: Date): string {
	const d = date ?? new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `backup_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.zip`;
}

/** 从备份文件名解析时间 */
function parseBackupTime(fileName: string): string | null {
	const match = fileName.match(/^backup_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.zip$/);
	if (!match) return null;
	return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
}

/** 递归读取目录下所有文件 */
function readDirRecursive(dir: string, base: string = dir): { name: string; data: Buffer }[] {
	const results: { name: string; data: Buffer }[] = [];
	if (!fs.existsSync(dir)) return results;

	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		const relPath = path.relative(base, fullPath).replace(/\\/g, "/");

		if (entry.isDirectory()) {
			results.push(...readDirRecursive(fullPath, base));
		} else {
			if (EXCLUDED_FILES.has(entry.name)) continue;
			results.push({ name: relPath, data: fs.readFileSync(fullPath) });
		}
	}
	return results;
}

/** WebDAV 请求封装 */
async function webdavRequest(
	config: WebDavConfig,
	method: string,
	remotePath: string,
	options: {
		body?: Buffer | string;
		headers?: Record<string, string>;
	} = {},
): Promise<{ ok: boolean; status: number; text: string; buffer?: Buffer }> {
	// 解析 baseUrl，提取域名部分
	const baseUrlObj = new URL(config.url);
	const origin = baseUrlObj.origin; // 如 https://dav.example.com

	// 如果 remotePath 是完整 URL，直接使用
	// 如果是绝对路径（以 / 开头），拼接域名
	// 否则拼接完整的 baseUrl
	let fullPath: string;
	if (remotePath.startsWith("http")) {
		fullPath = remotePath;
	} else if (remotePath.startsWith("/")) {
		fullPath = `${origin}${remotePath}`;
	} else {
		const baseUrl = config.url.replace(/\/+$/, "");
		fullPath = `${baseUrl}/${remotePath}`;
	}

	const headers: Record<string, string> = {
		...options.headers,
	};

	const auth = Buffer.from(`${config.username}:${config.password}`).toString("base64");
	headers["Authorization"] = `Basic ${auth}`;

	if (options.body && !headers["Content-Type"]) {
		headers["Content-Type"] = "application/octet-stream";
	}

	const body = options.body
		? (options.body instanceof Buffer ? new Uint8Array(options.body) as unknown as BodyInit : options.body as BodyInit)
		: undefined;

	const res = await fetch(fullPath, { method, headers, body });
	const contentType = res.headers.get("content-type") ?? "";

	let text = "";
	let buffer: Buffer | undefined;
	if (contentType.includes("application/xml") || contentType.includes("text/")) {
		text = await res.text().catch(() => "");
	} else {
		const arrBuf = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
		buffer = Buffer.from(arrBuf);
		text = "";
	}

	return { ok: res.ok, status: res.status, text, buffer };
}

/** 确保 WebDAV 远程目录存在 */
async function ensureRemoteDir(config: WebDavConfig, remoteDir: string): Promise<void> {
	await webdavRequest(config, "MKCOL", remoteDir);
	// 忽略结果，405=已存在，201=创建成功
}

/** 获取远程备份文件列表 */
async function listRemoteBackups(config: WebDavConfig): Promise<{ fileName: string; filePath: string; time: string; size?: number }[]> {
	const remoteBase = config.remotePath.replace(/\/+$/, "");

	const { ok, status, text } = await webdavRequest(config, "PROPFIND", remoteBase, {
		headers: { Depth: "infinity" },
	});

	if (!ok && status !== 207) {
		throw new Error(`获取备份列表失败: HTTP ${status}`);
	}

	const hrefRegex = /<(\w+:)?href[^>]*>([^<]+)<\/(\w+:)?href>/gi;
	const sizeRegex = /<(\w+:)?getcontentlength[^>]*>([^<]+)<\/(\w+:)?getcontentlength>/gi;
	const backups: { fileName: string; filePath: string; time: string; size?: number }[] = [];

	let match;
	while ((match = hrefRegex.exec(text)) !== null) {
		const rawHref = match[2]; // 原始 href
		const href = decodeURIComponent(rawHref);
		const baseName = path.basename(href.replace(/\/+$/, ""));

		// 跳过目录条目
		if (href.endsWith("/") || !baseName) continue;

		// 只处理备份文件
		const time = parseBackupTime(baseName);
		if (time) {
			// filePath: 直接使用原始 href（可能是完整 URL 或绝对路径）
			backups.push({ fileName: baseName, filePath: rawHref, time });
		}
	}

	// 尝试提取文件大小（match[2] 是内容）
	const sizeMatches = [...text.matchAll(sizeRegex)];
	if (sizeMatches.length === backups.length) {
		for (let i = 0; i < backups.length; i++) {
			backups[i].size = parseInt(sizeMatches[i][2], 10) || undefined;
		}
	}

	// 按时间降序排列
	backups.sort((a, b) => b.time.localeCompare(a.time));

	return backups;
}

/** 推送备份（打包为 zip） */
async function pushBackup(config: WebDavConfig): Promise<{ fileCount: number; fileName: string }> {
	const files = readDirRecursive(DATA_DIR);
	if (files.length === 0) {
		throw new Error("data 目录为空");
	}

	const remoteBase = config.remotePath.replace(/\/+$/, "");

	// 1. 确保远程目录存在
	await ensureRemoteDir(config, remoteBase);

	// 2. 打包为 zip
	const zipBuffer = createZip(files);
	const fileName = backupFileName();

	// 3. 上传 zip 文件
	const { ok, status } = await webdavRequest(config, "PUT", `${remoteBase}/${fileName}`, {
		body: zipBuffer,
	});
	if (!ok) {
		throw new Error(`上传失败: HTTP ${status}`);
	}

	return { fileCount: files.length, fileName };
}

/** 拉取指定备份 */
async function pullBackup(config: WebDavConfig, filePath: string): Promise<{ fileCount: number }> {
	// filePath 是完整的 URL 或相对于 baseUrl 的路径

	// 1. 下载 zip 文件
	const { ok, status, buffer } = await webdavRequest(config, "GET", filePath);
	if (!ok || !buffer) {
		throw new Error(`下载失败: HTTP ${status}`);
	}

	// 2. 解压 zip
	const entries = parseZip(buffer);

	// 3. 写入本地 data 目录
	for (const entry of entries) {
		const localPath = path.join(DATA_DIR, entry.name);
		fs.mkdirSync(path.dirname(localPath), { recursive: true });
		fs.writeFileSync(localPath, entry.data);
	}

	// 4. 清除服务端缓存
	const { revalidatePath } = await import("next/cache");
	revalidatePath("/");

	return { fileCount: entries.length };
}

/** GET: 读取配置 + 备份列表 */
export async function GET() {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未授权" }, { status: 401 });
	}

	const config = readWebDavConfig();
	if (!config) {
		return NextResponse.json({ saved: false });
	}

	// 获取远程备份列表
	let backups: { fileName: string; filePath: string; time: string; size?: number }[] = [];
	let error: string | undefined;
	try {
		backups = await listRemoteBackups(config);
	} catch (e) {
		error = e instanceof Error ? e.message : "获取备份列表失败";
	}

	return NextResponse.json({
		saved: true,
		url: config.url,
		username: config.username,
		remotePath: config.remotePath,
		hasPassword: true,
		backups,
		error,
	});
}

/** POST: 推送备份 */
export async function POST() {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未授权" }, { status: 401 });
	}

	const config = readWebDavConfig();
	if (!config) {
		return NextResponse.json({ error: "未配置 WebDAV" }, { status: 400 });
	}

	try {
		const { fileCount, fileName } = await pushBackup(config);

		return NextResponse.json({
			success: true,
			message: "备份成功",
			fileCount,
			fileName,
			time: new Date().toISOString(),
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "备份失败";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

/** PUT: 保存配置并验证连接 */
export async function PUT(request: Request) {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未授权" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { url, username, remotePath = "/go-nav/backups" } = body;

		if (!url || !username) {
			return NextResponse.json({ error: "请填写完整的服务器地址和用户名" }, { status: 400 });
		}

		// 密码从环境变量读取
		const password = process.env.WEBDAV_PASSWORD;
		if (!password) {
			return NextResponse.json({ error: "未设置 WEBDAV_PASSWORD 环境变量" }, { status: 400 });
		}

		const config: WebDavConfig = { url, username, password, remotePath };

		// 验证连接
		const { ok, status } = await webdavRequest(config, "PROPFIND", remotePath || "/", {
			headers: { Depth: "0" },
		});

		if (!ok && status !== 207) {
			const mkcolResult = await webdavRequest(config, "MKCOL", remotePath || "/");
			if (!mkcolResult.ok && mkcolResult.status !== 405) {
				throw new Error(`连接失败: HTTP ${status}，请检查地址、用户名和密码`);
			}
		}

		// 保存配置（不包含密码）
		writeWebDavConfig({ url, username, remotePath });

		return NextResponse.json({
			success: true,
			message: "验证通过，配置已保存",
			url,
			remotePath,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "验证失败";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

/** PATCH: 从指定备份拉取 */
export async function PATCH(request: Request) {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未授权" }, { status: 401 });
	}

	const config = readWebDavConfig();
	if (!config) {
		return NextResponse.json({ error: "未配置 WebDAV" }, { status: 400 });
	}

	try {
		const body = await request.json();
		const { filePath } = body;

		if (!filePath) {
			return NextResponse.json({ error: "请选择要恢复的备份" }, { status: 400 });
		}

		const { fileCount } = await pullBackup(config, filePath);

		return NextResponse.json({
			success: true,
			message: "恢复成功",
			fileCount,
			time: new Date().toISOString(),
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "恢复失败";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

/** DELETE: 删除指定备份或清除配置 */
export async function DELETE(request: Request) {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未授权" }, { status: 401 });
	}

	const config = readWebDavConfig();

	const { searchParams } = new URL(request.url);
	const filePath = searchParams.get("file");

	if (filePath) {
		// 删除指定远程备份
		if (!config) {
			return NextResponse.json({ error: "未配置 WebDAV" }, { status: 400 });
		}
		const { ok } = await webdavRequest(config, "DELETE", filePath);
		if (!ok) {
			return NextResponse.json({ error: "删除失败" }, { status: 500 });
		}
		return NextResponse.json({ success: true, message: "备份已删除" });
	}

	// 清除配置
	deleteWebDavConfig();
	return NextResponse.json({ success: true, message: "配置已清除" });
}
