import { createHash } from "node:crypto";
import path from "node:path";
import {
	parseStructuredContent,
	readJsonOr,
	readNav,
	readWebsiteData,
	stringifyStructuredContent,
	writeJsonAtomic,
	writeNav,
	writeWebsiteData,
} from "@/lib/server/store";
import { getFileStore } from "@/lib/server/storage/driver";
import {
	createDataBackupZip,
	disableJsPluginsForRestore,
	restoreDataBackupZip,
	type BackupRestoreResult,
} from "@/lib/server/backup";
import type { NavConfig, WebsiteData } from "@/types";

export type SyncProvider = "github" | "webdav";
export type SyncAction = "push" | "pull";

const WEBDAV_BACKUP_FILE_PREFIX = "go-nav-data";
const WEBDAV_BACKUP_FILE_SUFFIX = ".zip";
const WEBSITE_SYNC_IMPORT_FILES = ["website.yaml", "website.yml", "website.json"] as const;
const NAV_SYNC_IMPORT_FILES = ["nav.yaml", "nav.yml", "nav.json"] as const;
const ALLOWED_UPLOAD_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".svg",
	".ico",
]);

export interface GitHubSyncConfig {
	repo: string;
	branch: string;
	filePath: string;
	token: string;
	commitMessage: string;
}

export interface WebDavSyncConfig {
	url: string;
	filePath: string;
	username: string;
	password: string;
}

export interface WebDavBackupEntry {
	name: string;
	path: string;
	size?: number;
	createdAt?: string;
	modifiedAt?: string;
}

export interface DataSyncRunResult {
	ok: boolean;
	provider: SyncProvider;
	action: SyncAction;
	at: string;
	message: string;
	remote?: string;
	size?: number;
	restored?: BackupRestoreResult;
}

export interface DataSyncConfig {
	github: GitHubSyncConfig;
	webdav: WebDavSyncConfig;
}

export interface PublicDataSyncConfig {
	github: Omit<GitHubSyncConfig, "token"> & { hasToken: boolean };
	webdav: Omit<WebDavSyncConfig, "password"> & { hasPassword: boolean };
}

export interface DataSyncConfigInput {
	github?: Partial<GitHubSyncConfig>;
	webdav?: Partial<WebDavSyncConfig>;
}

export interface DataSyncRunOptions {
	target?: string;
	onProgress?: DataSyncProgressLogger;
}

export interface DataSyncProgressEvent {
	at: string;
	level: "info" | "success" | "error";
	message: string;
}

export type DataSyncProgressLogger = (
	event: DataSyncProgressEvent,
) => void | Promise<void>;

interface GitHubRepoParts {
	owner: string;
	repo: string;
}

interface GitHubContentResponse {
	type?: string;
	name?: string;
	path?: string;
	sha?: string;
	content?: string;
	encoding?: string;
	download_url?: string | null;
}

interface GitHubBlobResponse {
	content?: string;
	encoding?: string;
	size?: number;
}

interface GitHubRepoResponse {
	default_branch?: string;
}

interface GitHubRefResponse {
	object?: {
		sha?: string;
	};
}

interface GitHubCreateBlobResponse {
	sha: string;
}

interface GitHubCreateTreeResponse {
	sha: string;
}

interface GitHubCreateCommitResponse {
	sha: string;
}

interface GitHubCommitResponse {
	tree?: {
		sha?: string;
	};
}

interface GitHubPushBase {
	parentCommitSha?: string;
	parentTreeSha?: string;
	sourceBranch?: string;
	createRef: boolean;
}

interface GitHubPushResult {
	remote: string;
	changed: boolean;
}

interface SyncUploadFile {
	name: string;
	data: Buffer;
}

interface SyncFileEntry {
	path: string;
	data: Buffer;
}

interface WebDavPropfindItem {
	href: string;
	isCollection: boolean;
	size?: number;
	createdAt?: string;
	modifiedAt?: string;
}

const DEFAULT_SYNC_CONFIG: DataSyncConfig = {
	github: {
		repo: "",
		branch: "main",
		filePath: "data",
		token: "",
		commitMessage: "chore: backup Go Nav data",
	},
	webdav: {
		url: "",
		filePath: "backup/go-nav",
		username: "",
		password: "",
	},
};

function cloneDefaultConfig(): DataSyncConfig {
	return JSON.parse(JSON.stringify(DEFAULT_SYNC_CONFIG)) as DataSyncConfig;
}

function asString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function normalizeRemotePath(value: string, fallback: string): string {
	const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+/, "");
	const compact = trimmed.replace(/\/{2,}/g, "/");
	if (!compact) return fallback;
	const parts = compact.split("/");
	if (parts.some((part) => !part || part === "." || part === "..")) {
		return fallback;
	}
	return compact;
}

function normalizeConfig(input: Partial<DataSyncConfig>): DataSyncConfig {
	const defaults = cloneDefaultConfig();
	const github: Partial<GitHubSyncConfig> = input.github ?? {};
	const webdav: Partial<WebDavSyncConfig> = input.webdav ?? {};
	return {
		github: {
			repo: asString(github.repo).trim(),
			branch: asString(github.branch, defaults.github.branch).trim() || "main",
			filePath: normalizeRemotePath(
				asString(github.filePath, defaults.github.filePath),
				defaults.github.filePath,
			),
			token: asString(github.token).trim(),
			commitMessage:
				asString(github.commitMessage, defaults.github.commitMessage).trim() ||
				defaults.github.commitMessage,
		},
		webdav: {
			url: asString(webdav.url).trim(),
			filePath: normalizeRemotePath(
				asString(webdav.filePath, defaults.webdav.filePath),
				defaults.webdav.filePath,
			),
			username: asString(webdav.username).trim(),
			password: asString(webdav.password),
		},
	};
}

function normalizeWebDavTarget(target: string | undefined): string {
	const trimmed = (target || "")
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/{2,}/g, "/");
	if (!trimmed) return "";
	const parts = trimmed.split("/");
	if (parts.some((part) => !part || part === "." || part === "..")) return "";
	return parts.join("/");
}

function safeUploadName(name: string): string | null {
	const base = path.basename(name);
	if (!base || base.startsWith(".")) return null;
	if (base !== name) return null;
	if (!ALLOWED_UPLOAD_EXTENSIONS.has(path.extname(base).toLowerCase())) return null;
	return base;
}

async function getUploadEntriesForSync(): Promise<SyncUploadFile[]> {
	const fileStore = getFileStore();
	const uploads: SyncUploadFile[] = [];
	try {
		const allFiles = await fileStore.list();
		for (const file of allFiles) {
			const safe = safeUploadName(file);
			if (!safe) continue;
			try {
				const entry = await fileStore.read(safe);
				if (!entry) continue;
				uploads.push({ name: safe, data: Buffer.from(entry.data) });
			} catch {
				// 单个文件读取失败不应阻塞整体同步。
			}
		}
	} catch {
		// 列目录失败时返回空数组
	}
	return uploads;
}

async function collectGitHubSyncFiles(baseDir: string): Promise<SyncFileEntry[]> {
	const websiteData = await readWebsiteData();
	const nav = await readNav();
	const files: SyncFileEntry[] = [
		collectStructuredSyncEntry(baseDir, "website", websiteData),
		collectStructuredSyncEntry(baseDir, "nav", nav),
	];

	for (const upload of await getUploadEntriesForSync()) {
		files.push({
			path: `${baseDir}/uploads/${upload.name}`,
			data: upload.data,
		});
	}

	return files;
}

function collectStructuredSyncEntry(
	baseDir: string,
	baseName: "website" | "nav",
	value: unknown,
): SyncFileEntry {
	const fileName = `${baseName}.json`;
	const serialized = JSON.stringify(value, null, 2);
	return {
		path: `${baseDir}/${fileName}`,
		data: Buffer.from(serialized, "utf8"),
	};
}

export async function readDataSyncConfig(): Promise<DataSyncConfig> {
	const raw = await readJsonOr<Partial<DataSyncConfig>>("data-sync", cloneDefaultConfig());
	return normalizeConfig(raw);
}

export async function writeDataSyncConfig(config: DataSyncConfig) {
	await writeJsonAtomic("data-sync", normalizeConfig(config));
}

export function toPublicDataSyncConfig(
	config: DataSyncConfig,
): PublicDataSyncConfig {
	return {
		github: {
			repo: config.github.repo,
			branch: config.github.branch,
			filePath: config.github.filePath,
			commitMessage: config.github.commitMessage,
			hasToken: Boolean(config.github.token),
		},
		webdav: {
			url: config.webdav.url,
			filePath: config.webdav.filePath,
			username: config.webdav.username,
			hasPassword: Boolean(config.webdav.password),
		},
	};
}

export async function saveDataSyncConfigFromInput(
	input: DataSyncConfigInput,
): Promise<PublicDataSyncConfig> {
	const current = await readDataSyncConfig();
	const next = normalizeConfig({
		github: {
			...current.github,
			...input.github,
			token:
				input.github && "token" in input.github
					? input.github.token?.trim() || current.github.token
					: current.github.token,
		},
		webdav: {
			...current.webdav,
			...input.webdav,
			password:
				input.webdav && "password" in input.webdav
					? input.webdav.password || current.webdav.password
					: current.webdav.password,
		},
	});
	await writeDataSyncConfig(next);
	return toPublicDataSyncConfig(next);
}

export async function listWebDavBackups(): Promise<WebDavBackupEntry[]> {
	const config = await readDataSyncConfig();
	const entries = await listWebDavBackupFiles(config.webdav);
	return entries
		.filter((entry) => !entry.isCollection)
		.map((entry) => ({
			name: entry.name,
			path: entry.path,
			size: entry.size,
			createdAt: entry.createdAt,
			modifiedAt: entry.modifiedAt,
		}))
		.sort((a, b) => {
			const at = Date.parse(a.createdAt || a.modifiedAt || "");
			const bt = Date.parse(b.createdAt || b.modifiedAt || "");
			if (Number.isFinite(at) && Number.isFinite(bt)) return bt - at;
			if (Number.isFinite(at)) return -1;
			if (Number.isFinite(bt)) return 1;
			return b.name.localeCompare(a.name);
		});
}

export async function deleteWebDavBackup(targetPathInput: string): Promise<void> {
	const config = await readDataSyncConfig();
	await deleteWebDavBackupFile(config.webdav, targetPathInput);
}

export async function runDataSync(
	provider: SyncProvider,
	action: SyncAction,
	options: DataSyncRunOptions = {},
): Promise<DataSyncRunResult> {
	const config = await readDataSyncConfig();
	const at = new Date().toISOString();
	const onProgress = options.onProgress;
	const logProgress = async (
		level: DataSyncProgressEvent["level"],
		message: string,
	) => {
		if (!onProgress) return;
		await onProgress({
			at: new Date().toISOString(),
			level,
			message,
		});
	};
	let result: DataSyncRunResult;

	try {
		await logProgress(
			"info",
			`开始执行 ${providerLabel(provider)} ${actionLabel(action)}...`,
		);
		if (provider === "github") {
			if (action === "push") {
				const pushed = await pushToGitHub(config.github, logProgress);
				result = {
					ok: true,
					provider,
					action,
					at,
					remote: pushed.remote,
					message: pushed.changed ? "推送成功" : "数据没有变化，无需推送",
				};
			} else {
				const restored = await pullFromGitHub(config.github, logProgress);
				result = {
					ok: true,
					provider,
					action,
					at,
					remote: restored.remote,
					restored: restored.result,
					message: "拉取并还原成功",
				};
			}
		} else if (action === "push") {
			await logProgress("info", "正在打包本地备份数据...");
			const zip = await createDataBackupZip();
			await logProgress("info", `备份打包完成，大小 ${formatBytes(zip.length)}。`);
			const remote = await pushToWebDav(config.webdav, zip);
			result = {
				ok: true,
				provider,
				action,
				at,
				remote,
				size: zip.length,
				message: "推送成功",
			};
		} else {
			await logProgress("info", "正在拉取远端 WebDAV 备份...");
			const { remote, zip } = await pullFromWebDav(config.webdav, options.target);
			await logProgress("info", `拉取完成，大小 ${formatBytes(zip.length)}。`);
			const restored = await restoreDataBackupZip(zip);
			result = {
				ok: true,
				provider,
				action,
				at,
				remote,
				size: zip.length,
				restored,
				message: "拉取并还原成功",
			};
		}
		await logProgress("success", result.message);
	} catch (e) {
		result = {
			ok: false,
			provider,
			action,
			at,
			message: (e as Error).message,
		};
		await logProgress("error", result.message);
	}

	return result;
}

function providerLabel(provider: SyncProvider): string {
	return provider === "github" ? "GitHub" : "WebDAV";
}

function actionLabel(action: SyncAction): string {
	return action === "push" ? "推送" : "拉取";
}

function formatBytes(size: number): string {
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
	return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function createGitBlobSha(data: Buffer): string {
	const header = Buffer.from(`blob ${data.length}\u0000`, "utf8");
	return createHash("sha1").update(header).update(data).digest("hex");
}

function parseGitHubRepo(input: string): GitHubRepoParts | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	const urlMatch = trimmed.match(
		/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/?#].*)?$/i,
	);
	if (urlMatch?.[1] && urlMatch[2]) {
		return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/i, "") };
	}
	const shortMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
	if (shortMatch?.[1] && shortMatch[2]) {
		return { owner: shortMatch[1], repo: shortMatch[2].replace(/\.git$/i, "") };
	}
	return null;
}

function encodeGitHubPath(filePath: string): string {
	return filePath.split("/").map(encodeURIComponent).join("/");
}

function validateGitHubConfig(config: GitHubSyncConfig): GitHubRepoParts {
	const parsed = parseGitHubRepo(config.repo);
	if (!parsed) {
		throw new Error("请填写 GitHub 仓库，格式如 owner/repo");
	}
	if (!config.branch.trim()) {
		throw new Error("请填写 GitHub 分支");
	}
	if (!config.filePath.trim()) {
		throw new Error("请填写 GitHub 备份目录");
	}
	if (!config.token.trim()) {
		throw new Error("请填写 GitHub Token");
	}
	return parsed;
}

async function readGitHubError(res: Response): Promise<string> {
	const text = await res.text().catch(() => "");
	const status = res.status;
	if (!text) return `GitHub 请求失败 (${res.status})`;
	try {
		const data = JSON.parse(text) as { message?: string };
		const message = data.message || `GitHub 请求失败 (${status})`;
		if (status === 401 || status === 403) {
			return `GitHub 鉴权失败：请检查 Token 是否有效，以及是否授予目标仓库 Contents 读写权限（原始信息：${message}）`;
		}
		if (status === 404) {
			return `GitHub 资源不存在：请检查仓库名、分支名以及 Token 是否有该仓库访问权限（原始信息：${message}）`;
		}
		if (status === 422) {
			return `GitHub 请求参数无效：请检查分支、路径与提交信息（原始信息：${message}）`;
		}
		if (status === 409 && message.includes("Git Repository is empty")) {
			return "GitHub 仓库尚未初始化（空仓库）。请先在仓库中创建一个 README 或任意首个文件并提交一次，然后再执行同步推送。";
		}
		return message;
	} catch {
		return text.slice(0, 200) || `GitHub 请求失败 (${res.status})`;
	}
}

async function githubFetch<T>(
	url: string,
	token: string,
	init: RequestInit = {},
): Promise<T> {
	const res = await fetch(url, {
		...init,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"X-GitHub-Api-Version": "2022-11-28",
			...(init.headers ?? {}),
		},
	});
	if (!res.ok) {
		throw new Error(await readGitHubError(res));
	}
	return (await res.json()) as T;
}

async function getGitHubPathContent(
	parts: GitHubRepoParts,
	filePath: string,
	branch: string,
	token: string,
): Promise<GitHubContentResponse | GitHubContentResponse[] | null> {
	const url = `https://api.github.com/repos/${parts.owner}/${parts.repo}/contents/${encodeGitHubPath(filePath)}?ref=${encodeURIComponent(branch)}`;
	const res = await fetch(url, {
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"X-GitHub-Api-Version": "2022-11-28",
		},
	});
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(await readGitHubError(res));
	return (await res.json()) as GitHubContentResponse | GitHubContentResponse[];
}

function githubHeaders(token: string): Record<string, string> {
	return {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${token}`,
		"X-GitHub-Api-Version": "2022-11-28",
	};
}

async function getGitHubRef(
	parts: GitHubRepoParts,
	ref: string,
	token: string,
): Promise<GitHubRefResponse | null> {
	const url = `https://api.github.com/repos/${parts.owner}/${parts.repo}/git/ref/${encodeURIComponent(ref)}`;
	const res = await fetch(url, { headers: githubHeaders(token) });
	if (res.status === 404) return null;
	if (res.status === 409) {
		const text = await res.text().catch(() => "");
		if (text.includes("Git Repository is empty")) {
			return null;
		}
		throw new Error(
			text ? text.slice(0, 200) : `GitHub 请求失败 (${res.status})`,
		);
	}
	if (!res.ok) throw new Error(await readGitHubError(res));
	return (await res.json()) as GitHubRefResponse;
}

async function createGitHubRef(
	parts: GitHubRepoParts,
	ref: string,
	sha: string,
	token: string,
) {
	const url = `https://api.github.com/repos/${parts.owner}/${parts.repo}/git/refs`;
	await githubFetch<unknown>(url, token, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			ref: `refs/${ref}`,
			sha,
		}),
	});
}

async function updateGitHubRef(
	parts: GitHubRepoParts,
	ref: string,
	sha: string,
	token: string,
) {
	const url = `https://api.github.com/repos/${parts.owner}/${parts.repo}/git/refs/${encodeGitHubPath(ref)}`;
	await githubFetch<unknown>(url, token, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			sha,
			force: false,
		}),
	});
}

async function getGitHubCommit(
	parts: GitHubRepoParts,
	commitSha: string,
	token: string,
): Promise<GitHubCommitResponse> {
	const url = `https://api.github.com/repos/${parts.owner}/${parts.repo}/git/commits/${commitSha}`;
	return await githubFetch<GitHubCommitResponse>(url, token);
}

async function resolveGitHubPushBase(
	parts: GitHubRepoParts,
	config: GitHubSyncConfig,
): Promise<GitHubPushBase> {
	const targetRef = await getGitHubRef(parts, `heads/${config.branch}`, config.token);
	if (targetRef?.object?.sha) {
		const commit = await getGitHubCommit(parts, targetRef.object.sha, config.token);
		return {
			parentCommitSha: targetRef.object.sha,
			parentTreeSha: commit.tree?.sha,
			sourceBranch: config.branch,
			createRef: false,
		};
	}
	const repoInfo = await githubFetch<GitHubRepoResponse>(
		`https://api.github.com/repos/${parts.owner}/${parts.repo}`,
		config.token,
	);
	const defaultBranch = (repoInfo.default_branch || "").trim();
	if (defaultBranch) {
		const defaultRef = await getGitHubRef(parts, `heads/${defaultBranch}`, config.token);
		if (defaultRef?.object?.sha) {
			const commit = await getGitHubCommit(parts, defaultRef.object.sha, config.token);
			return {
				parentCommitSha: defaultRef.object.sha,
				parentTreeSha: commit.tree?.sha,
				sourceBranch: defaultBranch,
				createRef: true,
			};
		}
	}
	return { createRef: true };
}

async function readGitHubFileBuffer(
	parts: GitHubRepoParts,
	filePath: string,
	branch: string,
	token: string,
): Promise<Buffer> {
	const maybe = await readGitHubOptionalFileBuffer(parts, filePath, branch, token);
	if (!maybe) {
		throw new Error(`GitHub 文件不存在：${filePath}`);
	}
	return maybe;
}

async function readGitHubOptionalFileBuffer(
	parts: GitHubRepoParts,
	filePath: string,
	branch: string,
	token: string,
): Promise<Buffer | null> {
	const content = await getGitHubPathContent(parts, filePath, branch, token);
	if (!content) return null;
	if (Array.isArray(content)) {
		throw new Error(`GitHub 路径不是文件：${filePath}`);
	}
	if (content.content && content.encoding === "base64") {
		return Buffer.from(content.content.replace(/\s/g, ""), "base64");
	}
	if (!content.sha) {
		throw new Error(`GitHub 文件读取失败：${filePath}`);
	}
	const blobUrl = `https://api.github.com/repos/${parts.owner}/${parts.repo}/git/blobs/${content.sha}`;
	const blob = await githubFetch<GitHubBlobResponse>(blobUrl, token);
	if (!blob.content || blob.encoding !== "base64") {
		throw new Error(`GitHub 文件不是 base64 blob：${filePath}`);
	}
	return Buffer.from(blob.content.replace(/\s/g, ""), "base64");
}

async function readGitHubFirstMatchedFile(
	parts: GitHubRepoParts,
	baseDir: string,
	fileNames: readonly string[],
	branch: string,
	token: string,
): Promise<{ path: string; data: Buffer }> {
	for (const fileName of fileNames) {
		const filePath = `${baseDir}/${fileName}`;
		const fileData = await readGitHubOptionalFileBuffer(
			parts,
			filePath,
			branch,
			token,
		);
		if (fileData) return { path: filePath, data: fileData };
	}
	throw new Error(`GitHub 中未找到 ${fileNames.join(" / ")}`);
}

async function listGitHubDirectoryRecursive(
	parts: GitHubRepoParts,
	dirPath: string,
	branch: string,
	token: string,
): Promise<GitHubContentResponse[]> {
	const content = await getGitHubPathContent(parts, dirPath, branch, token);
	if (!content) return [];
	if (!Array.isArray(content)) {
		if (content.type === "dir") {
			return [];
		}
		throw new Error(`GitHub 目录路径无效：${dirPath}`);
	}

	const files: GitHubContentResponse[] = [];
	for (const entry of content) {
		if (entry.type === "file") {
			files.push(entry);
			continue;
		}
		if (entry.type === "dir" && entry.path) {
			const children = await listGitHubDirectoryRecursive(
				parts,
				entry.path,
				branch,
				token,
			);
			files.push(...children);
		}
	}

	return files;
}

async function pushToGitHub(
	config: GitHubSyncConfig,
	log?: (
		level: DataSyncProgressEvent["level"],
		message: string,
	) => Promise<void>,
): Promise<GitHubPushResult> {
	await log?.("info", "正在校验 GitHub 同步配置...");
	const parts = validateGitHubConfig(config);
	const baseDir = normalizeRemotePath(
		config.filePath,
		DEFAULT_SYNC_CONFIG.github.filePath,
	);
	await log?.(
		"info",
		`目标仓库 ${parts.owner}/${parts.repo}，分支 ${config.branch}，目录 ${baseDir}`,
	);
	const remote = `github:${parts.owner}/${parts.repo}@${config.branch}:${baseDir}/(website.yaml,website.json,nav.yaml,nav.json,uploads/*)`;
	const files = await collectGitHubSyncFiles(baseDir);
	if (files.length === 0) {
		throw new Error("没有可同步到 GitHub 的数据文件");
	}
	await log?.("info", `已准备 ${files.length} 个文件，开始同步...`);

	await log?.("info", "正在读取远端分支基线...");
	const pushBase = await resolveGitHubPushBase(parts, config);
	if (pushBase.parentCommitSha && !pushBase.parentTreeSha) {
		throw new Error("无法获取 GitHub 基线树信息，请稍后重试");
	}
	if (pushBase.createRef) {
		await log?.("info", "目标分支不存在，将在提交后自动创建分支。");
	} else {
		await log?.("info", "已获取目标分支基线，继续增量构建提交。");
	}

	const desiredPaths = new Set(files.map((file) => file.path));
	const remoteFileShaByPath = new Map<string, string>();
	let stalePaths: string[] = [];
	if (pushBase.sourceBranch) {
		await log?.(
			"info",
			`正在扫描远端目录旧文件（分支 ${pushBase.sourceBranch}）...`,
		);
		const existingFiles = await listGitHubDirectoryRecursive(
			parts,
			baseDir,
			pushBase.sourceBranch,
			config.token,
		).catch(() => []);
		for (const entry of existingFiles) {
			if (entry.type !== "file" || !entry.path || !entry.sha) continue;
			remoteFileShaByPath.set(entry.path, entry.sha);
		}
		stalePaths = Array.from(remoteFileShaByPath.keys()).filter(
			(remotePath) => !desiredPaths.has(remotePath),
		);
		if (stalePaths.length > 0) {
			await log?.("info", `发现 ${stalePaths.length} 个远端冗余文件，稍后将删除。`);
		}
	}

	const changedFiles = files.filter((file) => {
		const remoteSha = remoteFileShaByPath.get(file.path);
		if (!remoteSha) return true;
		return remoteSha !== createGitBlobSha(file.data);
	});
	const uploadsPrefix = `${baseDir}/uploads/`;
	const changedUploadCount = changedFiles.filter((file) =>
		file.path.startsWith(uploadsPrefix),
	).length;
	const deletedUploadCount = stalePaths.filter((filePath) =>
		filePath.startsWith(uploadsPrefix),
	).length;
	const changedConfigCount = changedFiles.length - changedUploadCount;
	const deletedConfigCount = stalePaths.length - deletedUploadCount;
	if (changedFiles.length === 0 && stalePaths.length === 0) {
		await log?.("success", "远端数据与本地一致，无需生成新提交。");
		return { remote, changed: false };
	}
	await log?.(
		"info",
		`本次将更新 ${changedFiles.length} 个文件（配置 ${changedConfigCount}、uploads ${changedUploadCount}），删除 ${stalePaths.length} 个文件（配置 ${deletedConfigCount}、uploads ${deletedUploadCount}）。`,
	);

	const apiBase = `https://api.github.com/repos/${parts.owner}/${parts.repo}`;
	const tree: Array<{
		path: string;
		mode: "100644";
		type: "blob";
		sha: string | null;
	}> = [];

	for (let i = 0; i < changedFiles.length; i++) {
		const file = changedFiles[i];
		await log?.(
			"info",
			`上传文件 ${i + 1}/${changedFiles.length}: ${file.path} (${formatBytes(file.data.length)})`,
		);
		const blob = await githubFetch<GitHubCreateBlobResponse>(
			`${apiBase}/git/blobs`,
			config.token,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content: file.data.toString("base64"),
					encoding: "base64",
				}),
			},
		);
		tree.push({
			path: file.path,
			mode: "100644",
			type: "blob",
			sha: blob.sha,
		});
	}
	await log?.("info", "文件内容上传完成。");

	for (const stalePath of stalePaths) {
		tree.push({
			path: stalePath,
			mode: "100644",
			type: "blob",
			sha: null,
		});
	}

	await log?.("info", "正在创建 Git tree...");
	const newTree = await githubFetch<GitHubCreateTreeResponse>(
		`${apiBase}/git/trees`,
		config.token,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				tree,
				...(pushBase.parentTreeSha ? { base_tree: pushBase.parentTreeSha } : {}),
			}),
		},
	);

	if (pushBase.parentTreeSha && newTree.sha === pushBase.parentTreeSha) {
		await log?.("success", "远端数据与本地一致，无需生成新提交。");
		return { remote, changed: false };
	}

	await log?.("info", "正在创建 Git commit...");
	const commit = await githubFetch<GitHubCreateCommitResponse>(
		`${apiBase}/git/commits`,
		config.token,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				message: config.commitMessage || "chore: backup Go Nav data",
				tree: newTree.sha,
				parents: pushBase.parentCommitSha ? [pushBase.parentCommitSha] : [],
			}),
		},
	);

	if (pushBase.createRef) {
		await log?.("info", `正在创建分支 heads/${config.branch}...`);
		await createGitHubRef(parts, `heads/${config.branch}`, commit.sha, config.token);
	} else {
		await log?.("info", `正在更新分支 heads/${config.branch}...`);
		await updateGitHubRef(parts, `heads/${config.branch}`, commit.sha, config.token);
	}
	await log?.("success", `推送完成，提交 SHA: ${commit.sha.slice(0, 8)}`);

	return { remote, changed: true };
}

async function pullFromGitHub(
	config: GitHubSyncConfig,
	log?: (
		level: DataSyncProgressEvent["level"],
		message: string,
	) => Promise<void>,
): Promise<{ remote: string; result: BackupRestoreResult }> {
	const parts = validateGitHubConfig(config);
	const baseDir = normalizeRemotePath(config.filePath, DEFAULT_SYNC_CONFIG.github.filePath);
	const uploadsDirPath = `${baseDir}/uploads`;
	await log?.(
		"info",
		`开始从 ${parts.owner}/${parts.repo}@${config.branch} 拉取 ${baseDir} 目录...`,
	);

	const websiteFile = await readGitHubFirstMatchedFile(
		parts,
		baseDir,
		WEBSITE_SYNC_IMPORT_FILES,
		config.branch,
		config.token,
	);
	const navFile = await readGitHubFirstMatchedFile(
		parts,
		baseDir,
		NAV_SYNC_IMPORT_FILES,
		config.branch,
		config.token,
	);
	await log?.(
		"info",
		`已下载 ${path.basename(websiteFile.path)} 和 ${path.basename(navFile.path)}。`,
	);

	let websiteData: WebsiteData;
	let navData: NavConfig;
	let disabledJsPlugins = 0;
	try {
		websiteData = parseStructuredContent<WebsiteData>(
			websiteFile.data.toString("utf8"),
		);
	} catch {
		throw new Error(`GitHub 的 ${path.basename(websiteFile.path)} 解析失败`);
	}
	try {
		navData = parseStructuredContent<NavConfig>(navFile.data.toString("utf8"));
		const result = disableJsPluginsForRestore(navData);
		navData = result.nav;
		disabledJsPlugins = result.disabled;
	} catch {
		throw new Error(`GitHub 的 ${path.basename(navFile.path)} 解析失败`);
	}

	await writeWebsiteData(websiteData);
	await writeNav(navData);
	await log?.("info", "本地配置已更新。");

	const uploadEntries = await listGitHubDirectoryRecursive(
		parts,
		uploadsDirPath,
		config.branch,
		config.token,
	).catch(() => []);

	let uploadsCount = 0;
	if (uploadEntries.length > 0) {
		await log?.("info", `发现 ${uploadEntries.length} 个远端上传文件，正在写入本地...`);
		const fileStore = getFileStore();
		for (const entry of uploadEntries) {
			if (!entry.path) continue;
			const name = entry.path.slice(uploadsDirPath.length + 1);
			const safe = safeUploadName(name);
			if (!safe) continue;
			const buf = await readGitHubFileBuffer(
				parts,
				entry.path,
				config.branch,
				config.token,
			);
			await fileStore.write(safe, buf);
			uploadsCount += 1;
		}
	}
	await log?.("success", `GitHub 拉取完成，恢复上传文件 ${uploadsCount} 个。`);

	return {
		remote: `github:${parts.owner}/${parts.repo}@${config.branch}:${baseDir}`,
		result: {
			website: true,
			nav: true,
			uploads: uploadsCount,
			disabledJsPlugins,
		},
	};
}

function validateWebDavConfig(config: WebDavSyncConfig) {
	if (!config.url.trim()) {
		throw new Error("请填写 WebDAV 地址");
	}
	try {
		new URL(config.url);
	} catch {
		throw new Error("WebDAV 地址不是有效 URL");
	}
	if (!config.filePath.trim()) {
		throw new Error("请填写 WebDAV 备份目录");
	}
	if (!config.username.trim()) {
		throw new Error("请填写 WebDAV 用户名");
	}
	if (!config.password) {
		throw new Error("请填写 WebDAV 密码");
	}
}

function webDavAuthHeader(config: WebDavSyncConfig): string {
	return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
}

function buildWebDavUrl(baseUrl: string, remotePath: string): string {
	const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
	const encodedPath = remotePath.split("/").map(encodeURIComponent).join("/");
	return new URL(encodedPath, base).toString();
}

function buildWebDavDirectoryUrls(baseUrl: string, filePath: string): string[] {
	const parts = filePath.split("/").slice(0, -1);
	const urls: string[] = [];
	for (let i = 0; i < parts.length; i++) {
		const dir = parts.slice(0, i + 1).join("/");
		urls.push(buildWebDavUrl(baseUrl, `${dir}/`));
	}
	return urls;
}

function formatCompactTimestamp(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	const hh = String(date.getHours()).padStart(2, "0");
	const mm = String(date.getMinutes()).padStart(2, "0");
	const ss = String(date.getSeconds()).padStart(2, "0");
	return `${y}${m}${d}${hh}${mm}${ss}`;
}

function generateWebDavBackupFileName(date = new Date()): string {
	return `${WEBDAV_BACKUP_FILE_PREFIX}-${formatCompactTimestamp(date)}${WEBDAV_BACKUP_FILE_SUFFIX}`;
}

function decodeHtmlEntities(input: string): string {
	return input
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

function parseWebDavMultiStatus(xml: string, baseUrl: string): WebDavPropfindItem[] {
	const responses =
		xml.match(/<[^>]*:?response\b[\s\S]*?<\/[^>]*:?response>/gi) || [];
	const list: WebDavPropfindItem[] = [];

	for (const block of responses) {
		const hrefMatch = block.match(
			/<[^>]*:?href\b[^>]*>([\s\S]*?)<\/[^>]*:?href>/i,
		);
		if (!hrefMatch?.[1]) continue;
		const rawHref = decodeHtmlEntities(hrefMatch[1].trim());

		let pathname = "";
		try {
			pathname = decodeURIComponent(new URL(rawHref, baseUrl).pathname);
		} catch {
			continue;
		}
		const trimmedPath = pathname.replace(/\/+$/, "");
		const name = trimmedPath.slice(trimmedPath.lastIndexOf("/") + 1);
		if (!name) continue;

		const propBlock =
			block.match(
				/<[^>]*:?prop\b[^>]*>([\s\S]*?)<\/[^>]*:?prop>/i,
			)?.[1] || "";
		const isCollection = /<[^>]*:?collection\b[^>]*\/?\s*>/i.test(propBlock);

		const sizeText =
			propBlock.match(
				/<[^>]*:?getcontentlength\b[^>]*>([\s\S]*?)<\/[^>]*:?getcontentlength>/i,
			)?.[1] || "";
		const sizeNum = Number(sizeText.trim());

		const createdAt =
			propBlock.match(
				/<[^>]*:?creationdate\b[^>]*>([\s\S]*?)<\/[^>]*:?creationdate>/i,
			)?.[1]?.trim() || undefined;
		const modifiedAt =
			propBlock.match(
				/<[^>]*:?getlastmodified\b[^>]*>([\s\S]*?)<\/[^>]*:?getlastmodified>/i,
			)?.[1]?.trim() || undefined;

		list.push({
			href: rawHref,
			isCollection,
			size: Number.isFinite(sizeNum) ? sizeNum : undefined,
			createdAt,
			modifiedAt,
		});
	}

	return list;
}

function normalizeWebDavEntryPath(
	baseUrl: string,
	href: string,
	fallbackName: string,
): string {
	try {
		const url = new URL(href, baseUrl);
		const rawPath = decodeURIComponent(url.pathname);
		const cleaned = rawPath.replace(/^\/+/, "").replace(/\/+$/, "");
		return cleaned || fallbackName;
	} catch {
		return fallbackName;
	}
}

async function readWebDavError(res: Response): Promise<string> {
	const text = await res.text().catch(() => "");
	return text.slice(0, 200) || `WebDAV 请求失败 (${res.status})`;
}

async function ensureWebDavDirectories(config: WebDavSyncConfig, dirPath: string) {
	const auth = webDavAuthHeader(config);
	for (const url of buildWebDavDirectoryUrls(config.url, `${dirPath}/x`)) {
		const res = await fetch(url, {
			method: "MKCOL",
			headers: { Authorization: auth },
		});
		if (res.ok || res.status === 405) continue;
		if (res.status === 409) {
			throw new Error("WebDAV 父目录不存在，请检查基础地址");
		}
		throw new Error(await readWebDavError(res));
	}
}

async function listWebDavBackupFiles(
	config: WebDavSyncConfig,
): Promise<Array<WebDavBackupEntry & { isCollection: boolean }>> {
	validateWebDavConfig(config);
	const baseDir = normalizeRemotePath(config.filePath, DEFAULT_SYNC_CONFIG.webdav.filePath);
	const targetDirUrl = buildWebDavUrl(config.url, `${baseDir}/`);
	const res = await fetch(targetDirUrl, {
		method: "PROPFIND",
		headers: {
			Authorization: webDavAuthHeader(config),
			Depth: "1",
			"Content-Type": "application/xml; charset=utf-8",
		},
		body: `<?xml version="1.0" encoding="utf-8" ?>\n<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype /><d:getcontentlength /><d:creationdate /><d:getlastmodified /></d:prop></d:propfind>`,
	});
	if (res.status === 404) {
		return [];
	}
	if (!res.ok && res.status !== 207) {
		throw new Error(await readWebDavError(res));
	}
	const xml = await res.text();
	const parsed = parseWebDavMultiStatus(xml, config.url);
	if (parsed.length === 0) return [];

	const normalizedDirPath = normalizeWebDavEntryPath(config.url, targetDirUrl, baseDir)
		.replace(/\/+$/, "")
		.toLowerCase();

	const entries: Array<WebDavBackupEntry & { isCollection: boolean }> = [];
	for (const item of parsed) {
		const pathValue = normalizeWebDavEntryPath(config.url, item.href, "");
		if (!pathValue) continue;
		if (pathValue.replace(/\/+$/, "").toLowerCase() === normalizedDirPath) {
			continue;
		}
		const name = pathValue.slice(pathValue.lastIndexOf("/") + 1);
		if (!name) continue;
		entries.push({
			name,
			path: pathValue,
			size: item.size,
			createdAt: item.createdAt,
			modifiedAt: item.modifiedAt,
			isCollection: item.isCollection,
		});
	}
	return entries;
}

async function pushToWebDav(
	config: WebDavSyncConfig,
	zip: Buffer,
): Promise<string> {
	validateWebDavConfig(config);
	const baseDir = normalizeRemotePath(config.filePath, DEFAULT_SYNC_CONFIG.webdav.filePath);
	await ensureWebDavDirectories(config, baseDir);
	const filename = generateWebDavBackupFileName();
	const targetPath = `${baseDir}/${filename}`;
	const target = buildWebDavUrl(config.url, targetPath);
	const res = await fetch(target, {
		method: "PUT",
		headers: {
			Authorization: webDavAuthHeader(config),
			"Content-Type": "application/zip",
		},
		body: new Uint8Array(zip),
	});
	if (!res.ok) {
		throw new Error(await readWebDavError(res));
	}
	return target;
}

async function pullFromWebDav(
	config: WebDavSyncConfig,
	targetPathInput?: string,
): Promise<{ remote: string; zip: Buffer }> {
	validateWebDavConfig(config);
	const baseDir = normalizeRemotePath(config.filePath, DEFAULT_SYNC_CONFIG.webdav.filePath);
	const normalizedTarget = normalizeWebDavTarget(targetPathInput);
	if (!normalizedTarget) {
		throw new Error("请选择要恢复的 WebDAV 备份文件");
	}

	const expectedPrefix = `${baseDir}/`.toLowerCase();
	if (!normalizedTarget.toLowerCase().startsWith(expectedPrefix)) {
		throw new Error("所选备份文件不在当前 WebDAV 备份目录下");
	}

	const target = buildWebDavUrl(config.url, normalizedTarget);
	const res = await fetch(target, {
		method: "GET",
		headers: { Authorization: webDavAuthHeader(config) },
	});
	if (!res.ok) {
		throw new Error(await readWebDavError(res));
	}
	return {
		remote: target,
		zip: Buffer.from(await res.arrayBuffer()),
	};
}

async function deleteWebDavBackupFile(
	config: WebDavSyncConfig,
	targetPathInput: string,
): Promise<void> {
	validateWebDavConfig(config);
	const baseDir = normalizeRemotePath(
		config.filePath,
		DEFAULT_SYNC_CONFIG.webdav.filePath,
	);
	const normalizedTarget = normalizeWebDavTarget(targetPathInput);
	if (!normalizedTarget) {
		throw new Error("请选择要删除的 WebDAV 备份文件");
	}
	const expectedPrefix = `${baseDir}/`.toLowerCase();
	if (!normalizedTarget.toLowerCase().startsWith(expectedPrefix)) {
		throw new Error("所选备份文件不在当前 WebDAV 备份目录下");
	}

	const target = buildWebDavUrl(config.url, normalizedTarget);
	const res = await fetch(target, {
		method: "DELETE",
		headers: { Authorization: webDavAuthHeader(config) },
	});
	if (res.status === 404) {
		throw new Error("备份文件不存在或已被删除");
	}
	if (!res.ok) {
		throw new Error(await readWebDavError(res));
	}
}
