import { createHash } from "node:crypto";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { NavConfig, WebsiteData } from "@/types";
import { getConfigStore, getFileStore } from "./storage/driver";

// ─── 默认值 ──────────────────────────────────────────────────

/**
 * 网站内容数据默认值（未生成 website 配置文件时使用）。
 */
export const DEFAULT_WEBSITE: WebsiteData = { categories: [] };

/**
 * 导航配置默认值（未生成 nav 配置文件时使用）。
 * 保持一份最小可用配置，确保前台页面能渲染、后台登录后能直接开始编辑。
 */
export const DEFAULT_NAV: NavConfig = {
	title: "Go Nav",
	name: "Go Nav",
	description: "简洁高效的网址导航站",
	keywords: ["网址导航站", "导航站", "网址导航", "个人导航"],
	logo: "/images/logo.svg",
	favicon: "/favicon.ico",
	author: "dengxiwang",
	copyright: "版权所有 © 2026 GOTAB. 保留所有权利",
	icp: "豫ICP备2023009053号-6",
	beian: "豫公网安备41072402001147号",
	qrCode: "https://www.gotab.cn/images/wx.webp",
	qrCodeText: "微信扫一扫",
	footerLinks: [
		{ label: "GOTAB 官网", href: "https://www.gotab.cn" },
		{ label: "作者 GitHub", href: "https://github.com/dengxiwang/go-nav" },
		{ label: " GoTab 新标签页", href: "https://web.gotab.cn" },
		{ label: "博客", href: "https://blog.gotab.cn" },
	],
	themeMode: "system",
	search: {
		defaultEngine: "local",
		enableLocalSearch: true,
		showEngineSelector: true,
		enableSuggestion: true,
		enableTabFocus: true,
		placeholder: "搜索网站或直接按 Enter 通过外部引擎搜索...",
		engines: [
			{ id: "baidu", name: "百度", icon: "/images/baidu.svg", url: "https://www.baidu.com/s?wd={query}&tn=68018901_11_oem_dg" },
			{ id: "bing", name: "必应", icon: "/images/bing.svg", url: "https://www.bing.com/search?q={query}" },
			{ id: "google", name: "谷歌", icon: "/images/google.svg", url: "https://www.google.com/search?q={query}" },
		],
	},
	ads: [
		{
			id: "ad-1778577116508",
			title: "雨云服务器",
			description: "",
			image: "https://blog.gotab.cn/upload/rainyun_ad.webp",
			url: "https://www.rainyun.com/gotab_",
			enabled: true,
		},
	],
	imageUpload: { convertToWebp: false },
	plugins: [],
	layout: {
		maxWidth: "1400",
		showFooter: true,
		showFooterQrCode: true,
		showFloatingQrCode: true,
		showFloatingActions: true,
		defaultIconPadding: "8",
		linkTarget: "new",
		autoUseIntranet: false,
		enableSiteDetailPage: false,
	},
	adsAspectRatio: "4/3",
};

// ─── 缓存 ────────────────────────────────────────────────────

const structuredCache = new Map<string, { stamp: string; value: unknown }>();

function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

// ─── 配置格式判断（基于 key 名） ─────────────────────────────

function isJsonKey(key: string): boolean {
	// 所有已知配置 key 默认使用 JSON 格式
	// 如果 key 以 .json 结尾也视为 JSON
	return key.endsWith(".json") || !key.endsWith(".yaml") && !key.endsWith(".yml");
}

// ─── 核心读写（通过存储抽象层） ──────────────────────────────

/**
 * 读取结构化配置并递归剥离 `_comment*` 注释字段。
 */
export async function readJson<T>(key: string): Promise<T> {
	const store = getConfigStore();
	const raw = await store.read(key);
	if (raw === null) throw new Error(`配置文件 ${key} 不存在`);
	const stamp = `${raw.length}`;
	const cached = structuredCache.get(key);
	if (cached?.stamp === stamp) return cached.value as T;
	const value = stripComments(parseStructuredContentByKey(raw, key)) as T;
	structuredCache.set(key, { stamp, value });
	return value;
}

/**
 * 容错读取：配置不存在或解析失败时返回 fallback。
 */
export async function readJsonOr<T>(key: string, fallback: T): Promise<T> {
	try {
		return await readJson<T>(key);
	} catch (e) {
		console.warn(
			`[store] 读取 ${key} 失败，使用默认值：${(e as Error).message}`,
		);
		return cloneJson(fallback);
	}
}

/**
 * 写入结构化配置。
 */
export async function writeJsonAtomic(key: string, value: unknown): Promise<void> {
	const store = getConfigStore();
	const content = stringifyStructuredFile(value, key);
	await store.write(key, content);
	structuredCache.delete(key);
}

// ─── 解析/序列化（纯函数，保持同步） ─────────────────────────

export function parseStructuredContent<T>(content: string): T {
	return stripComments(parseYaml(content)) as T;
}

function parseStructuredContentByKey<T>(raw: string, key: string): T {
	if (isJsonKey(key)) {
		return JSON.parse(raw) as T;
	}
	return stripComments(parseYaml(raw)) as T;
}

export function stringifyStructuredContent(value: unknown, key: string): string {
	return stringifyStructuredFile(value, key);
}

function stringifyStructuredFile(value: unknown, key: string): string {
	if (isJsonKey(key)) {
		return JSON.stringify(value, null, 2);
	}
	return stringifyYaml(value, { indent: 2, lineWidth: 0 });
}

// ─── 业务级读写 ──────────────────────────────────────────────

export async function readWebsiteData(): Promise<WebsiteData> {
	return readJsonOr<WebsiteData>("website", DEFAULT_WEBSITE);
}

export async function writeWebsiteData(v: WebsiteData): Promise<void> {
	await writeJsonAtomic("website", v);
}

export async function readNav(): Promise<NavConfig> {
	return readJsonOr<NavConfig>("nav", DEFAULT_NAV);
}

export async function writeNav(v: NavConfig): Promise<void> {
	await writeJsonAtomic("nav", v);
}

export async function getConfigRevision(): Promise<string> {
	const store = getConfigStore();
	const parts = await Promise.all(
		["website", "nav"].map(async (key) => {
			const content = await store.read(key);
			if (content === null) return `${key}:missing`;
			return `${key}:${content.length}`;
		}),
	);
	return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

// ─── 上传文件操作（通过 FileStore） ──────────────────────────

export interface SaveUploadOptions {
	dedupeByContent?: boolean;
	preferredExistingUrl?: string;
}

export async function saveUpload(
	fileName: string,
	bytes: Buffer,
	options?: SaveUploadOptions,
): Promise<string> {
	const fileStore = getFileStore();
	const ext = sanitizeExtension(path.extname(fileName)) || ".bin";
	const base = createUploadBaseName(
		path.basename(fileName, path.extname(fileName)),
	);
	if (!options?.dedupeByContent) {
		return saveUploadWithRandomSuffix(fileStore, base, ext, bytes);
	}

	const contentHash = createUploadContentHash(bytes);
	const preferredFileName = resolveUploadFileNameFromUrl(options.preferredExistingUrl);
	if (preferredFileName && await hasFileStoreUploadWithHash(fileStore, preferredFileName, contentHash)) {
		return toUploadUrl(preferredFileName);
	}

	const hashFileName = `${base}-${contentHash.slice(0, 12)}${ext}`;
	if (await hasFileStoreUploadWithHash(fileStore, hashFileName, contentHash)) {
		return toUploadUrl(hashFileName);
	}

	const existing = await findExistingUploadByHash(fileStore, base, ext, contentHash);
	if (existing) {
		return existing;
	}

	await fileStore.write(hashFileName, bytes);
	return toUploadUrl(hashFileName);
}

function sanitizeExtension(ext: string): string {
	const normalized = ext.toLowerCase();
	return /^\.[a-z0-9]+$/.test(normalized) ? normalized : "";
}

function createUploadBaseName(name: string): string {
	const slug = name
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-")
		.slice(0, 28)
		.replace(/-+$/g, "");
	return slug || "icon";
}

async function saveUploadWithRandomSuffix(
	fileStore: ReturnType<typeof getFileStore>,
	base: string,
	ext: string,
	bytes: Buffer,
): Promise<string> {
	let unique = "";
	do {
		unique = `${base}-${Math.random().toString(36).slice(2, 8)}${ext}`;
	} while (await fileStore.exists(unique));
	await fileStore.write(unique, bytes);
	return toUploadUrl(unique);
}

function toUploadUrl(fileName: string): string {
	return `/uploads/${fileName}`;
}

function createUploadContentHash(bytes: Buffer): string {
	return createHash("sha256").update(bytes).digest("hex");
}

async function hasFileStoreUploadWithHash(
	fileStore: ReturnType<typeof getFileStore>,
	fileName: string,
	expectedHash: string,
): Promise<boolean> {
	try {
		const entry = await fileStore.read(fileName);
		if (!entry) return false;
		const existingHash = createUploadContentHash(Buffer.from(entry.data));
		return existingHash === expectedHash;
	} catch {
		return false;
	}
}

function resolveUploadFileNameFromUrl(url: string | undefined): string | null {
	if (!url) return null;
	const clean = url.split("?")[0]?.split("#")[0] || "";
	if (!clean.startsWith("/uploads/")) return null;
	const rawFileName = clean.slice("/uploads/".length);
	if (!rawFileName || rawFileName.includes("/") || rawFileName.includes("\\")) {
		return null;
	}
	try {
		return decodeURIComponent(rawFileName);
	} catch {
		return null;
	}
}

async function findExistingUploadByHash(
	fileStore: ReturnType<typeof getFileStore>,
	base: string,
	ext: string,
	expectedHash: string,
): Promise<string | null> {
	const prefix = `${base}-`;
	try {
		const allFiles = await fileStore.list();
		for (const name of allFiles) {
			if (path.extname(name).toLowerCase() !== ext) continue;
			const isTargetBase =
				name === `${base}${ext}` || name.startsWith(prefix);
			if (!isTargetBase) continue;
			if (await hasFileStoreUploadWithHash(fileStore, name, expectedHash)) {
				return toUploadUrl(name);
			}
		}
	} catch {
		// 列目录失败时回退为直接写新文件
	}
	return null;
}

// ─── 工具函数 ────────────────────────────────────────────────

function stripComments<T>(input: T): T {
	if (Array.isArray(input)) {
		return input.map((v) => stripComments(v)) as unknown as T;
	}
	if (input && typeof input === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
			if (k.startsWith("_comment")) continue;
			out[k] = stripComments(v);
		}
		return out as unknown as T;
	}
	return input;
}
