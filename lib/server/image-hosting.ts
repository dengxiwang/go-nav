import { createHash, createHmac, randomBytes } from "node:crypto";
import path from "node:path";
import {
	readJsonOr,
	saveUpload,
	writeJsonAtomic,
	type SaveUploadOptions,
} from "@/lib/server/store";
import { getStorageDriverName } from "@/lib/server/storage/driver";

export type ImageHostMode =
	| "local"
	| "webdav"
	| "github"
	| "s3"
	| "oss"
	| "multi";
export type ImageHostReturnUrlMode = "relative" | "absolute";

export interface ImageHostGitHubConfig {
	repo: string;
	branch: string;
	publicUrlPrefix: string;
	token: string;
	commitMessage: string;
}

export interface ImageHostWebDavConfig {
	url: string;
	publicUrlPrefix: string;
	username: string;
	password: string;
}

export interface ImageHostS3Config {
	endpoint: string;
	region: string;
	bucket: string;
	publicUrlPrefix: string;
	accessKeyId: string;
	secretAccessKey: string;
	forcePathStyle: boolean;
}

export interface ImageHostOssConfig {
	endpoint: string;
	bucket: string;
	publicUrlPrefix: string;
	accessKeyId: string;
	accessKeySecret: string;
}

export interface ImageHostConfig {
	mode: ImageHostMode;
	pathTemplate: string;
	publicUrlPrefix: string;
	returnUrlMode: ImageHostReturnUrlMode;
	github: ImageHostGitHubConfig;
	webdav: ImageHostWebDavConfig;
	s3: ImageHostS3Config;
	oss: ImageHostOssConfig;
}

export interface PublicImageHostConfig {
	mode: ImageHostMode;
	pathTemplate: string;
	publicUrlPrefix: string;
	returnUrlMode: ImageHostReturnUrlMode;
	github: Omit<ImageHostGitHubConfig, "token"> & { hasToken: boolean };
	webdav: Omit<ImageHostWebDavConfig, "password"> & { hasPassword: boolean };
	s3: Omit<ImageHostS3Config, "secretAccessKey"> & {
		hasSecretAccessKey: boolean;
	};
	oss: Omit<ImageHostOssConfig, "accessKeySecret"> & {
		hasAccessKeySecret: boolean;
	};
}

export interface ImageHostConfigInput {
	mode?: ImageHostMode;
	pathTemplate?: string;
	publicUrlPrefix?: string;
	returnUrlMode?: ImageHostReturnUrlMode;
	github?: Partial<ImageHostGitHubConfig>;
	webdav?: Partial<ImageHostWebDavConfig>;
	s3?: Partial<ImageHostS3Config>;
	oss?: Partial<ImageHostOssConfig>;
}

export interface SaveImageAssetOptions extends SaveUploadOptions {
	contentType?: string;
	forceWebp?: boolean;
}

interface GitHubRepoParts {
	owner: string;
	repo: string;
}

interface PreparedImageAsset {
	bytes: Buffer;
	ext: string;
	contentType: string;
}

type ImageHostProvider = "webdav" | "github" | "s3" | "oss";

interface ImageHostAssetEntry {
	md5: string;
	path: string;
	ext: string;
	size: number;
	contentType: string;
	providers: ImageHostProvider[];
	uploadedAt: string;
}

interface ImageHostAssetManifest {
	version: 1;
	assets: ImageHostAssetEntry[];
}

const DEFAULT_PATH_TEMPLATE = "/img/{yyyy}/{m}/{d}";
const DEFAULT_COMMIT_MESSAGE = "chore: upload Go Nav image";
const DEFAULT_ASSET_MANIFEST: ImageHostAssetManifest = {
	version: 1,
	assets: [],
};

const DEFAULT_IMAGE_HOST_CONFIG: ImageHostConfig = {
	mode: "local",
	pathTemplate: DEFAULT_PATH_TEMPLATE,
	publicUrlPrefix: "",
	returnUrlMode: "relative",
	github: {
		repo: "",
		branch: "main",
		publicUrlPrefix: "",
		token: "",
		commitMessage: DEFAULT_COMMIT_MESSAGE,
	},
	webdav: {
		url: "",
		publicUrlPrefix: "",
		username: "",
		password: "",
	},
	s3: {
		endpoint: "",
		region: "auto",
		bucket: "",
		publicUrlPrefix: "",
		accessKeyId: "",
		secretAccessKey: "",
		forcePathStyle: true,
	},
	oss: {
		endpoint: "",
		bucket: "",
		publicUrlPrefix: "",
		accessKeyId: "",
		accessKeySecret: "",
	},
};

const IMAGE_HOST_MODES = new Set<ImageHostMode>([
	"local",
	"webdav",
	"github",
	"s3",
	"oss",
	"multi",
]);

const RETURN_URL_MODES = new Set<ImageHostReturnUrlMode>([
	"relative",
	"absolute",
]);

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
	"image/png": ".png",
	"image/jpeg": ".jpg",
	"image/jpg": ".jpg",
	"image/gif": ".gif",
	"image/webp": ".webp",
	"image/svg+xml": ".svg",
	"image/x-icon": ".ico",
	"image/vnd.microsoft.icon": ".ico",
};

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};

function cloneDefaultConfig(): ImageHostConfig {
	return JSON.parse(JSON.stringify(DEFAULT_IMAGE_HOST_CONFIG)) as ImageHostConfig;
}

function asString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function normalizeMode(value: unknown): ImageHostMode {
	if (value === "webdav-github") return "multi";
	return IMAGE_HOST_MODES.has(value as ImageHostMode)
		? (value as ImageHostMode)
		: DEFAULT_IMAGE_HOST_CONFIG.mode;
}

function normalizeReturnUrlMode(value: unknown): ImageHostReturnUrlMode {
	return RETURN_URL_MODES.has(value as ImageHostReturnUrlMode)
		? (value as ImageHostReturnUrlMode)
		: DEFAULT_IMAGE_HOST_CONFIG.returnUrlMode;
}

function normalizePublicUrlPrefix(value: string): string {
	return value.trim().replace(/\/+$/g, "");
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function normalizeRemotePath(value: string, fallback: string): string {
	const trimmed = value.trim().replace(/\\/g, "/");
	const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
	const compact = withSlash.replace(/\/{2,}/g, "/").replace(/\/+$/g, "");
	if (!compact || compact === "/") return fallback;
	const parts = compact.split("/").filter(Boolean);
	if (parts.some((part) => part === "." || part === "..")) return fallback;
	return `/${parts.join("/")}`;
}

function normalizePathTemplate(value: string): string {
	return normalizeRemotePath(value, DEFAULT_PATH_TEMPLATE);
}

function normalizeConfig(input: Partial<ImageHostConfig>): ImageHostConfig {
	const defaults = cloneDefaultConfig();
	const github: Partial<ImageHostGitHubConfig> = input.github ?? {};
	const webdav: Partial<ImageHostWebDavConfig> = input.webdav ?? {};
	const s3: Partial<ImageHostS3Config> = input.s3 ?? {};
	const oss: Partial<ImageHostOssConfig> = input.oss ?? {};
	const mode = normalizeMode(input.mode);
	const returnUrlModeRaw = normalizeReturnUrlMode(input.returnUrlMode);
	const returnUrlMode: ImageHostReturnUrlMode =
		mode === "local" || mode === "multi" ? "relative" : returnUrlModeRaw;
	return {
		mode,
		pathTemplate: normalizePathTemplate(
			asString(input.pathTemplate, defaults.pathTemplate),
		),
		publicUrlPrefix: normalizePublicUrlPrefix(
			asString(input.publicUrlPrefix, defaults.publicUrlPrefix),
		),
		returnUrlMode,
		github: {
			repo: asString(github.repo, defaults.github.repo).trim(),
			branch:
				asString(github.branch, defaults.github.branch).trim() ||
				defaults.github.branch,
			publicUrlPrefix: normalizePublicUrlPrefix(
				asString(github.publicUrlPrefix, defaults.github.publicUrlPrefix),
			),
			token: asString(github.token, defaults.github.token).trim(),
			commitMessage:
				asString(github.commitMessage, defaults.github.commitMessage).trim() ||
				defaults.github.commitMessage,
		},
		webdav: {
			url: asString(webdav.url, defaults.webdav.url).trim(),
			publicUrlPrefix: normalizePublicUrlPrefix(
				asString(webdav.publicUrlPrefix, defaults.webdav.publicUrlPrefix),
			),
			username: asString(webdav.username, defaults.webdav.username).trim(),
			password: asString(webdav.password, defaults.webdav.password),
		},
		s3: {
			endpoint: asString(s3.endpoint, defaults.s3.endpoint).trim(),
			region:
				asString(s3.region, defaults.s3.region).trim() || defaults.s3.region,
			bucket: asString(s3.bucket, defaults.s3.bucket).trim(),
			publicUrlPrefix: normalizePublicUrlPrefix(
				asString(s3.publicUrlPrefix, defaults.s3.publicUrlPrefix),
			),
			accessKeyId: asString(s3.accessKeyId, defaults.s3.accessKeyId).trim(),
			secretAccessKey: asString(
				s3.secretAccessKey,
				defaults.s3.secretAccessKey,
			),
			forcePathStyle: normalizeBoolean(
				s3.forcePathStyle,
				defaults.s3.forcePathStyle,
			),
		},
		oss: {
			endpoint: asString(oss.endpoint, defaults.oss.endpoint).trim(),
			bucket: asString(oss.bucket, defaults.oss.bucket).trim(),
			publicUrlPrefix: normalizePublicUrlPrefix(
				asString(oss.publicUrlPrefix, defaults.oss.publicUrlPrefix),
			),
			accessKeyId: asString(oss.accessKeyId, defaults.oss.accessKeyId).trim(),
			accessKeySecret: asString(
				oss.accessKeySecret,
				defaults.oss.accessKeySecret,
			),
		},
	};
}

export async function readImageHostConfig(): Promise<ImageHostConfig> {
	const raw = await readJsonOr<Partial<ImageHostConfig>>("image-host", cloneDefaultConfig());
	return normalizeConfig(raw);
}

export async function writeImageHostConfig(config: ImageHostConfig) {
	await writeJsonAtomic("image-host", normalizeConfig(config));
}

export function toPublicImageHostConfig(
	config: ImageHostConfig,
): PublicImageHostConfig {
	return {
		mode: config.mode,
		pathTemplate: config.pathTemplate,
		publicUrlPrefix: config.publicUrlPrefix,
		returnUrlMode: config.returnUrlMode,
		github: {
			repo: config.github.repo,
			branch: config.github.branch,
			publicUrlPrefix: config.github.publicUrlPrefix,
			commitMessage: config.github.commitMessage,
			hasToken: Boolean(config.github.token),
		},
		webdav: {
			url: config.webdav.url,
			publicUrlPrefix: config.webdav.publicUrlPrefix,
			username: config.webdav.username,
			hasPassword: Boolean(config.webdav.password),
		},
		s3: {
			endpoint: config.s3.endpoint,
			region: config.s3.region,
			bucket: config.s3.bucket,
			publicUrlPrefix: config.s3.publicUrlPrefix,
			accessKeyId: config.s3.accessKeyId,
			forcePathStyle: config.s3.forcePathStyle,
			hasSecretAccessKey: Boolean(config.s3.secretAccessKey),
		},
		oss: {
			endpoint: config.oss.endpoint,
			bucket: config.oss.bucket,
			publicUrlPrefix: config.oss.publicUrlPrefix,
			accessKeyId: config.oss.accessKeyId,
			hasAccessKeySecret: Boolean(config.oss.accessKeySecret),
		},
	};
}

export async function saveImageHostConfigFromInput(
	input: ImageHostConfigInput,
): Promise<PublicImageHostConfig> {
	const current = await readImageHostConfig();
	const next = normalizeConfig({
		...current,
		...input,
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
		s3: {
			...current.s3,
			...input.s3,
			secretAccessKey:
				input.s3 && "secretAccessKey" in input.s3
					? input.s3.secretAccessKey || current.s3.secretAccessKey
					: current.s3.secretAccessKey,
		},
		oss: {
			...current.oss,
			...input.oss,
			accessKeySecret:
				input.oss && "accessKeySecret" in input.oss
					? input.oss.accessKeySecret || current.oss.accessKeySecret
					: current.oss.accessKeySecret,
		},
	});
	// 保存时即校验当前模式，避免“配置未完整但保存成功”导致后续上传误解为回退本地 uploads。
	if (next.mode !== "local") {
		assertRemoteReady(next);
	}
	await writeImageHostConfig(next);
	return toPublicImageHostConfig(next);
}

function normalizeAssetManifest(input: unknown): ImageHostAssetManifest {
	if (!input || typeof input !== "object") return DEFAULT_ASSET_MANIFEST;
	const rawAssets = (input as { assets?: unknown }).assets;
	if (!Array.isArray(rawAssets)) return DEFAULT_ASSET_MANIFEST;
	const assets: ImageHostAssetEntry[] = [];
	for (const item of rawAssets) {
		if (!item || typeof item !== "object") continue;
		const raw = item as Partial<ImageHostAssetEntry>;
		const md5 = typeof raw.md5 === "string" ? raw.md5 : "";
		const assetPath = typeof raw.path === "string" ? raw.path : "";
		const ext = typeof raw.ext === "string" ? raw.ext : "";
		if (!/^[a-f0-9]{32}$/i.test(md5) || !assetPath || !ext) continue;
		const providers = Array.isArray(raw.providers)
			? raw.providers.filter(
					(provider): provider is ImageHostProvider =>
						provider === "webdav" ||
						provider === "github" ||
						provider === "s3" ||
						provider === "oss",
				)
			: [];
		assets.push({
			md5: md5.toLowerCase(),
			path: assetPath.replace(/^\/+/g, ""),
			ext,
			size: typeof raw.size === "number" ? raw.size : 0,
			contentType:
				typeof raw.contentType === "string"
					? raw.contentType
					: contentTypeFromExtension(ext),
			providers: Array.from(new Set(providers)),
			uploadedAt:
				typeof raw.uploadedAt === "string"
					? raw.uploadedAt
					: new Date().toISOString(),
		});
	}
	return { version: 1, assets };
}

async function readAssetManifest(): Promise<ImageHostAssetManifest> {
	return normalizeAssetManifest(
		await readJsonOr<unknown>("image-host-assets", DEFAULT_ASSET_MANIFEST),
	);
}

async function writeAssetManifest(manifest: ImageHostAssetManifest) {
	await writeJsonAtomic("image-host-assets", manifest);
}

function createAssetMd5(bytes: Buffer): string {
	return createHash("md5").update(bytes).digest("hex");
}

function findReusableAsset(
	manifest: ImageHostAssetManifest,
	md5: string,
	ext: string,
): ImageHostAssetEntry | null {
	return (
		manifest.assets.find((asset) => asset.md5 === md5 && asset.ext === ext) ??
		null
	);
}

function providersMissing(
	entry: ImageHostAssetEntry,
	providers: ImageHostProvider[],
): ImageHostProvider[] {
	return providers.filter((provider) => !entry.providers.includes(provider));
}

function upsertAssetManifestEntry(
	manifest: ImageHostAssetManifest,
	entry: ImageHostAssetEntry,
): ImageHostAssetManifest {
	const assets = manifest.assets.filter(
		(item) => !(item.md5 === entry.md5 && item.ext === entry.ext),
	);
	return {
		version: 1,
		assets: [entry, ...assets].slice(0, 5000),
	};
}

function extensionFromContentType(contentType: string | undefined): string {
	const clean = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
	return EXT_BY_CONTENT_TYPE[clean] ?? "";
}

function sanitizeExtension(ext: string): string {
	const lower = ext.toLowerCase();
	if (lower === ".jpeg") return ".jpg";
	return /^\.[a-z0-9]+$/.test(lower) ? lower : "";
}

function inferSourceExtension(fileName: string, contentType: string | undefined) {
	return (
		sanitizeExtension(path.extname(fileName)) ||
		extensionFromContentType(contentType) ||
		".bin"
	);
}

function contentTypeFromExtension(ext: string, fallback?: string): string {
	return CONTENT_TYPE_BY_EXT[ext] || fallback || "application/octet-stream";
}

async function prepareImageAsset(
	fileName: string,
	bytes: Buffer,
	contentType: string | undefined,
	forceWebp?: boolean,
): Promise<PreparedImageAsset> {
	const sourceExt = inferSourceExtension(fileName, contentType);
	const sourceMime = contentTypeFromExtension(sourceExt, contentType);
	// Cloudflare Workers 不支持 sharp 原生模块，直接返回原图
	if (getStorageDriverName() === "cloudflare") {
		return { bytes, ext: sourceExt, contentType: sourceMime };
	}
	const shouldConvertToWebp =
		forceWebp === true &&
		[".jpg", ".png", ".webp", ".svg"].includes(sourceExt);
	// 固定智能策略：仅对可安全重编码的位图执行有损/无损压缩，其它格式保持原样。
	if (!shouldConvertToWebp && ![".jpg", ".png", ".webp"].includes(sourceExt)) {
		return { bytes, ext: sourceExt, contentType: sourceMime };
	}

	try {
		const sharpMod = (await import("sharp")).default;
		let pipeline = sharpMod(bytes, { failOn: "none" }).rotate();
		const quality = 82;

		if (shouldConvertToWebp) {
			pipeline = pipeline.webp({ quality, effort: 4 });
		} else if (sourceExt === ".webp") {
			pipeline = pipeline.webp({ quality, effort: 4 });
		} else if (sourceExt === ".jpg") {
			pipeline = pipeline.jpeg({ quality, mozjpeg: true });
		} else if (sourceExt === ".png") {
			pipeline = pipeline.png({ compressionLevel: 9, quality });
		} else {
			return { bytes, ext: sourceExt, contentType: sourceMime };
		}

		const converted = await pipeline.toBuffer();
		if (!shouldConvertToWebp && converted.length >= bytes.length * 0.98) {
			return { bytes, ext: sourceExt, contentType: sourceMime };
		}

		return {
			bytes: converted,
			ext: shouldConvertToWebp ? ".webp" : sourceExt,
			contentType: shouldConvertToWebp
				? "image/webp"
				: contentTypeFromExtension(sourceExt, sourceMime),
		};
	} catch (e) {
		console.warn(`[image-host] 图片压缩失败，回退原图：${(e as Error).message}`);
		return { bytes, ext: sourceExt, contentType: sourceMime };
	}
}

function pad2(value: number): string {
	return String(value).padStart(2, "0");
}

function renderPathTemplate(template: string, date = new Date()): string {
	const yyyy = String(date.getFullYear());
	const yy = yyyy.slice(-2);
	const m = String(date.getMonth() + 1);
	const mm = pad2(date.getMonth() + 1);
	const d = String(date.getDate());
	const dd = pad2(date.getDate());
	const segmentTokens: Record<string, string> = {
		Y: yyyy,
		YYYY: yyyy,
		yyyy,
		YY: yy,
		yy,
		M: m,
		m,
		MM: mm,
		mm,
		D: d,
		d,
		DD: dd,
		dd,
	};

	const rendered = template
		.split("/")
		.map((segment) => {
			const replacedSegment = segmentTokens[segment] ?? segment;
			return replacedSegment
				.replace(/\{Y\}|\{YYYY\}|\{yyyy\}/g, yyyy)
				.replace(/\{YY\}|\{yy\}/g, yy)
				.replace(/\{M\}|\{m\}/g, m)
				.replace(/\{MM\}|\{mm\}/g, mm)
				.replace(/\{D\}|\{d\}/g, d)
				.replace(/\{DD\}|\{dd\}/g, dd);
		})
		.join("/");

	return normalizeRemotePath(rendered, DEFAULT_PATH_TEMPLATE);
}

function createRandomFileName(ext: string): string {
	return `${randomBytes(12).toString("hex")}${ext}`;
}

function buildRemoteAssetPath(config: ImageHostConfig, ext: string): string {
	const dir = renderPathTemplate(config.pathTemplate).replace(/^\/+|\/+$/g, "");
	const fileName = createRandomFileName(ext);
	return `${dir}/${fileName}`;
}

function isWebDavConfigured(config: ImageHostWebDavConfig): boolean {
	return Boolean(
		config.url.trim() && config.username.trim() && config.password,
	);
}

function isGitHubConfigured(config: ImageHostGitHubConfig): boolean {
	return Boolean(
		config.repo.trim() && config.branch.trim() && config.token.trim(),
	);
}

function isWebDavReady(config: ImageHostWebDavConfig): boolean {
	return Boolean(isWebDavConfigured(config) && config.publicUrlPrefix.trim());
}

function isGitHubReady(config: ImageHostGitHubConfig): boolean {
	return Boolean(isGitHubConfigured(config) && config.publicUrlPrefix.trim());
}

function isS3Configured(config: ImageHostS3Config): boolean {
	return Boolean(
		config.endpoint.trim() &&
			config.region.trim() &&
			config.bucket.trim() &&
			config.accessKeyId.trim() &&
			config.secretAccessKey,
	);
}

function isS3Ready(config: ImageHostS3Config): boolean {
	return Boolean(isS3Configured(config) && config.publicUrlPrefix.trim());
}

function isOssConfigured(config: ImageHostOssConfig): boolean {
	return Boolean(
		config.endpoint.trim() &&
			config.bucket.trim() &&
			config.accessKeyId.trim() &&
			config.accessKeySecret,
	);
}

function isOssReady(config: ImageHostOssConfig): boolean {
	return Boolean(isOssConfigured(config) && config.publicUrlPrefix.trim());
}

function providersForMode(config: ImageHostConfig): ImageHostProvider[] {
	if (config.mode === "webdav") return ["webdav"];
	if (config.mode === "github") return ["github"];
	if (config.mode === "s3") return ["s3"];
	if (config.mode === "oss") return ["oss"];
	if (config.mode !== "multi") return [];

	const hasAnyWebDavInput = Boolean(
		config.webdav.url.trim() ||
			config.webdav.username.trim() ||
			config.webdav.password ||
			config.webdav.publicUrlPrefix.trim(),
	);
	const hasAnyGitHubInput = Boolean(
		config.github.repo.trim() ||
			config.github.token.trim() ||
			config.github.publicUrlPrefix.trim(),
	);
	const hasAnyS3Input = Boolean(
		config.s3.endpoint.trim() ||
			config.s3.bucket.trim() ||
			config.s3.accessKeyId.trim() ||
			config.s3.secretAccessKey ||
			config.s3.publicUrlPrefix.trim(),
	);
	const hasAnyOssInput = Boolean(
		config.oss.endpoint.trim() ||
			config.oss.bucket.trim() ||
			config.oss.accessKeyId.trim() ||
			config.oss.accessKeySecret ||
			config.oss.publicUrlPrefix.trim(),
	);

	const webdavReady = isWebDavReady(config.webdav);
	const githubReady = isGitHubReady(config.github);
	const s3Ready = isS3Ready(config.s3);
	const ossReady = isOssReady(config.oss);
	if (hasAnyWebDavInput && !webdavReady) {
		throw new Error(
			"多图床策略下，WebDAV 若已填写请补全地址、用户名、密码和图片访问前缀后再保存",
		);
	}
	if (hasAnyGitHubInput && !githubReady) {
		throw new Error(
			"多图床策略下，GitHub 若已填写请补全仓库、分支、Token 和图片访问前缀后再保存",
		);
	}
	if (hasAnyS3Input && !s3Ready) {
		throw new Error(
			"多图床策略下，S3 兼容存储若已填写请补全 Endpoint、Region、Bucket、Access Key、Secret Key 和图片访问前缀后再保存",
		);
	}
	if (hasAnyOssInput && !ossReady) {
		throw new Error(
			"多图床策略下，阿里云 OSS 若已填写请补全 Endpoint、Bucket、AccessKey ID、AccessKey Secret 和图片访问前缀后再保存",
		);
	}

	const providers: ImageHostProvider[] = [];
	if (webdavReady) providers.push("webdav");
	if (githubReady) providers.push("github");
	if (s3Ready) providers.push("s3");
	if (ossReady) providers.push("oss");
	if (providers.length === 0) {
		throw new Error("多图床策略下，至少需要完整配置一个图床");
	}
	return providers;
}

function assertRemoteReady(config: ImageHostConfig) {
	if (config.mode === "multi" && config.returnUrlMode !== "relative") {
		throw new Error("多图床策略仅支持相对路径返回，请将写入 JSON 地址改为相对路径");
	}
	if (config.returnUrlMode === "relative") {
		if (!config.publicUrlPrefix) {
			throw new Error("相对路径模式需要填写图片链接前缀，用于访问 /img/... 图片");
		}
		const renderedDir = renderPathTemplate(config.pathTemplate);
		if (renderedDir !== "/img" && !renderedDir.startsWith("/img/")) {
			throw new Error(
				"相对路径模式下，上传路径模板必须以 /img 开头；如需使用其它路径，请切换为完整图片链接模式",
			);
		}
	}
	const providers = providersForMode(config);
	if (providers.includes("webdav")) {
		validateWebDavConfig(config.webdav);
		if (!config.webdav.publicUrlPrefix.trim()) {
			throw new Error("请填写 WebDAV 图片访问前缀");
		}
	}
	if (providers.includes("github")) {
		validateGitHubConfig(config.github);
		if (!config.github.publicUrlPrefix.trim()) {
			throw new Error("请填写 GitHub 图片访问前缀");
		}
	}
	if (providers.includes("s3")) {
		validateS3Config(config.s3);
		if (!config.s3.publicUrlPrefix.trim()) {
			throw new Error("请填写 S3 兼容存储图片访问前缀");
		}
	}
	if (providers.includes("oss")) {
		validateOssConfig(config.oss);
		if (!config.oss.publicUrlPrefix.trim()) {
			throw new Error("请填写阿里云 OSS 图片访问前缀");
		}
	}
}

function validateGitHubConfig(config: ImageHostGitHubConfig): GitHubRepoParts {
	const parsed = parseGitHubRepo(config.repo);
	if (!parsed) throw new Error("请填写 GitHub 仓库，格式如 owner/repo");
	if (!config.branch.trim()) throw new Error("请填写 GitHub 分支");
	if (!config.token.trim()) throw new Error("请填写 GitHub Token");
	return parsed;
}

function parseGitHubRepo(input: string): GitHubRepoParts | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	const urlMatch = trimmed.match(
		/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/?#].*)?$/i,
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

function githubHeaders(token: string): Record<string, string> {
	return {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${token}`,
		"X-GitHub-Api-Version": "2022-11-28",
	};
}

async function readGitHubError(res: Response): Promise<string> {
	const text = await res.text().catch(() => "");
	try {
		const data = JSON.parse(text) as { message?: string };
		const message = data.message || `GitHub 请求失败 (${res.status})`;
		if (res.status === 401 || res.status === 403) {
			return `GitHub 鉴权失败：请检查 Token 是否有效，并授予目标仓库 Contents 读写权限（原始信息：${message}）`;
		}
		if (res.status === 404) {
			return `GitHub 资源不存在：请检查仓库、分支以及 Token 权限（原始信息：${message}）`;
		}
		return message;
	} catch {
		return text.slice(0, 200) || `GitHub 请求失败 (${res.status})`;
	}
}

async function uploadToGitHub(
	config: ImageHostGitHubConfig,
	remotePath: string,
	asset: PreparedImageAsset,
) {
	const parts = validateGitHubConfig(config);
	const url = `https://api.github.com/repos/${parts.owner}/${parts.repo}/contents/${encodeGitHubPath(remotePath)}`;
	const res = await fetch(url, {
		method: "PUT",
		headers: {
			...githubHeaders(config.token),
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			message: config.commitMessage || DEFAULT_COMMIT_MESSAGE,
			content: asset.bytes.toString("base64"),
			branch: config.branch,
		}),
	});
	if (!res.ok) {
		throw new Error(await readGitHubError(res));
	}
}

function encodeRemotePath(filePath: string): string {
	return filePath
		.replace(/^\/+/g, "")
		.split("/")
		.map(encodeURIComponent)
		.join("/");
}

function validateEndpoint(endpoint: string, label: string): URL {
	const clean = endpoint.trim();
	if (!clean) throw new Error(`请填写 ${label} Endpoint`);
	try {
		const url = new URL(clean.includes("://") ? clean : `https://${clean}`);
		url.pathname = url.pathname.replace(/\/+$/g, "");
		return url;
	} catch {
		throw new Error(`${label} Endpoint 不是有效 URL`);
	}
}

function validateBucketName(bucket: string, label: string) {
	if (!bucket.trim()) throw new Error(`请填写 ${label} Bucket`);
	if (bucket.includes("/") || /\s/.test(bucket)) {
		throw new Error(`${label} Bucket 不能包含斜杠或空白字符`);
	}
}

function validateS3Config(config: ImageHostS3Config) {
	validateEndpoint(config.endpoint, "S3 兼容存储");
	if (!config.region.trim()) throw new Error("请填写 S3 兼容存储 Region");
	validateBucketName(config.bucket, "S3 兼容存储");
	if (!config.accessKeyId.trim()) {
		throw new Error("请填写 S3 兼容存储 Access Key");
	}
	if (!config.secretAccessKey) {
		throw new Error("请填写 S3 兼容存储 Secret Key");
	}
}

function toAmzDate(date: Date) {
	return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function toDateStamp(date: Date) {
	return toAmzDate(date).slice(0, 8);
}

function sha256Hex(value: Buffer | string): string {
	return createHash("sha256").update(value).digest("hex");
}

function hmacSha256(key: Buffer | string, value: string): Buffer {
	return createHmac("sha256", key).update(value).digest();
}

function buildS3Url(config: ImageHostS3Config, remotePath: string): URL {
	const endpoint = validateEndpoint(config.endpoint, "S3 兼容存储");
	const encodedPath = encodeRemotePath(remotePath);
	if (config.forcePathStyle) {
		const basePath = endpoint.pathname.replace(/^\/+|\/+$/g, "");
		endpoint.pathname = [basePath, config.bucket, encodedPath]
			.filter(Boolean)
			.join("/");
		return endpoint;
	}

	endpoint.hostname = `${config.bucket}.${endpoint.hostname}`;
	const basePath = endpoint.pathname.replace(/^\/+|\/+$/g, "");
	endpoint.pathname = [basePath, encodedPath].filter(Boolean).join("/");
	return endpoint;
}

function s3AuthorizationHeaders(
	config: ImageHostS3Config,
	url: URL,
	asset: PreparedImageAsset,
) {
	const now = new Date();
	const amzDate = toAmzDate(now);
	const dateStamp = toDateStamp(now);
	const payloadHash = sha256Hex(asset.bytes);
	const region = config.region.trim();
	const canonicalUri = url.pathname
		.split("/")
		.map((part) => encodeURIComponent(decodeURIComponent(part)))
		.join("/")
		.replace(/%2F/g, "/");
	const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
	const canonicalHeaders = [
		`content-type:${asset.contentType}`,
		`host:${url.host}`,
		`x-amz-content-sha256:${payloadHash}`,
		`x-amz-date:${amzDate}`,
	].join("\n");
	const canonicalRequest = [
		"PUT",
		canonicalUri,
		"",
		`${canonicalHeaders}\n`,
		signedHeaders,
		payloadHash,
	].join("\n");
	const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
	const stringToSign = [
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		sha256Hex(canonicalRequest),
	].join("\n");
	const signingKey = hmacSha256(
		hmacSha256(hmacSha256(hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp), region), "s3"),
		"aws4_request",
	);
	const signature = createHmac("sha256", signingKey)
		.update(stringToSign)
		.digest("hex");

	return {
		Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
		"Content-Type": asset.contentType,
		"x-amz-content-sha256": payloadHash,
		"x-amz-date": amzDate,
	};
}

async function readS3Error(res: Response): Promise<string> {
	const text = await res.text().catch(() => "");
	return text.slice(0, 300) || `S3 兼容存储请求失败 (${res.status})`;
}

async function uploadToS3(
	config: ImageHostS3Config,
	remotePath: string,
	asset: PreparedImageAsset,
) {
	validateS3Config(config);
	const target = buildS3Url(config, remotePath);
	const res = await fetch(target, {
		method: "PUT",
		headers: s3AuthorizationHeaders(config, target, asset),
		body: new Uint8Array(asset.bytes),
	});
	if (!res.ok) {
		throw new Error(await readS3Error(res));
	}
}

function validateOssConfig(config: ImageHostOssConfig) {
	validateEndpoint(config.endpoint, "阿里云 OSS");
	validateBucketName(config.bucket, "阿里云 OSS");
	if (!config.accessKeyId.trim()) throw new Error("请填写阿里云 OSS AccessKey ID");
	if (!config.accessKeySecret) throw new Error("请填写阿里云 OSS AccessKey Secret");
}

function buildOssUrl(config: ImageHostOssConfig, remotePath: string): URL {
	const endpoint = validateEndpoint(config.endpoint, "阿里云 OSS");
	const endpointHost = endpoint.hostname.startsWith(`${config.bucket}.`)
		? endpoint.hostname
		: `${config.bucket}.${endpoint.hostname}`;
	endpoint.hostname = endpointHost;
	const basePath = endpoint.pathname.replace(/^\/+|\/+$/g, "");
	endpoint.pathname = [basePath, encodeRemotePath(remotePath)]
		.filter(Boolean)
		.join("/");
	return endpoint;
}

function ossAuthorizationHeaders(
	config: ImageHostOssConfig,
	remotePath: string,
	asset: PreparedImageAsset,
) {
	const date = new Date().toUTCString();
	const canonicalResource = `/${config.bucket}/${remotePath.replace(/^\/+/g, "")}`;
	const stringToSign = [
		"PUT",
		"",
		asset.contentType,
		date,
		canonicalResource,
	].join("\n");
	const signature = createHmac("sha1", config.accessKeySecret)
		.update(stringToSign)
		.digest("base64");
	return {
		Authorization: `OSS ${config.accessKeyId}:${signature}`,
		"Content-Type": asset.contentType,
		Date: date,
	};
}

async function readOssError(res: Response): Promise<string> {
	const text = await res.text().catch(() => "");
	return text.slice(0, 300) || `阿里云 OSS 请求失败 (${res.status})`;
}

async function uploadToOss(
	config: ImageHostOssConfig,
	remotePath: string,
	asset: PreparedImageAsset,
) {
	validateOssConfig(config);
	const target = buildOssUrl(config, remotePath);
	const res = await fetch(target, {
		method: "PUT",
		headers: ossAuthorizationHeaders(config, remotePath, asset),
		body: new Uint8Array(asset.bytes),
	});
	if (!res.ok) {
		throw new Error(await readOssError(res));
	}
}

function validateWebDavConfig(config: ImageHostWebDavConfig) {
	if (!config.url.trim()) throw new Error("请填写 WebDAV 地址");
	try {
		new URL(config.url);
	} catch {
		throw new Error("WebDAV 地址不是有效 URL");
	}
	if (!config.username.trim()) throw new Error("请填写 WebDAV 用户名");
	if (!config.password) throw new Error("请填写 WebDAV 密码");
}

function webDavAuthHeader(config: ImageHostWebDavConfig): string {
	return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
}

function buildWebDavUrl(baseUrl: string, remotePath: string): string {
	const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
	const encodedPath = remotePath
		.replace(/^\/+/g, "")
		.split("/")
		.map(encodeURIComponent)
		.join("/");
	return new URL(encodedPath, base).toString();
}

function buildGitHubRawUrl(
	config: ImageHostGitHubConfig,
	remotePath: string,
): string | null {
	if (config.publicUrlPrefix.trim()) {
		return joinImagePublicUrl(config.publicUrlPrefix, `/${remotePath}`);
	}
	const parts = parseGitHubRepo(config.repo);
	if (!parts) return null;
	const branch = config.branch.trim() || "main";
	return `https://raw.githubusercontent.com/${parts.owner}/${parts.repo}/${branch}/${encodeGitHubPath(remotePath)}`;
}

function resolveAbsoluteRemoteUrl(
	config: ImageHostConfig,
	remotePath: string,
): string {
	if (config.mode === "webdav" || config.mode === "multi") {
		if (config.webdav.publicUrlPrefix.trim()) {
			return joinImagePublicUrl(config.webdav.publicUrlPrefix, `/${remotePath}`);
		}
		try {
			return buildWebDavUrl(config.webdav.url, remotePath);
		} catch {
			// 回退到其它可用地址策略
		}
	}
	if (config.mode === "github" || config.mode === "multi") {
		const githubRaw = buildGitHubRawUrl(config.github, remotePath);
		if (githubRaw) return githubRaw;
	}
	if (
		(config.mode === "s3" || config.mode === "multi") &&
		config.s3.publicUrlPrefix.trim()
	) {
		return joinImagePublicUrl(config.s3.publicUrlPrefix, `/${remotePath}`);
	}
	if (
		(config.mode === "oss" || config.mode === "multi") &&
		config.oss.publicUrlPrefix.trim()
	) {
		return joinImagePublicUrl(config.oss.publicUrlPrefix, `/${remotePath}`);
	}
	return joinImagePublicUrl(config.publicUrlPrefix, `/${remotePath}`);
}

function buildWebDavDirectoryUrls(baseUrl: string, filePath: string): string[] {
	const parts = filePath.replace(/^\/+/g, "").split("/").slice(0, -1);
	const urls: string[] = [];
	for (let i = 0; i < parts.length; i++) {
		const dir = parts.slice(0, i + 1).join("/");
		urls.push(buildWebDavUrl(baseUrl, `${dir}/`));
	}
	return urls;
}

async function readWebDavError(res: Response): Promise<string> {
	const text = await res.text().catch(() => "");
	return text.slice(0, 200) || `WebDAV 请求失败 (${res.status})`;
}

async function ensureWebDavDirectories(
	config: ImageHostWebDavConfig,
	remotePath: string,
) {
	const auth = webDavAuthHeader(config);
	for (const url of buildWebDavDirectoryUrls(config.url, remotePath)) {
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

async function uploadToWebDav(
	config: ImageHostWebDavConfig,
	remotePath: string,
	asset: PreparedImageAsset,
) {
	validateWebDavConfig(config);
	await ensureWebDavDirectories(config, remotePath);
	const target = buildWebDavUrl(config.url, remotePath);
	const res = await fetch(target, {
		method: "PUT",
		headers: {
			Authorization: webDavAuthHeader(config),
			"Content-Type": asset.contentType,
		},
		body: new Uint8Array(asset.bytes),
	});
	if (!res.ok) {
		throw new Error(await readWebDavError(res));
	}
}

async function uploadToProviders(
	config: ImageHostConfig,
	remotePath: string,
	asset: PreparedImageAsset,
	providers: ImageHostProvider[],
) {
	await Promise.all(
		providers.map((provider) => {
			if (provider === "webdav") {
				return uploadToWebDav(config.webdav, remotePath, asset);
			}
			if (provider === "github") {
				return uploadToGitHub(config.github, remotePath, asset);
			}
			if (provider === "s3") {
				return uploadToS3(config.s3, remotePath, asset);
			}
			return uploadToOss(config.oss, remotePath, asset);
		}),
	);
}

export function joinImagePublicUrl(
	publicUrlPrefix: string,
	relativePath: string,
): string {
	const prefix = normalizePublicUrlPrefix(publicUrlPrefix);
	if (!prefix) return relativePath;
	return `${prefix}/${relativePath.replace(/^\/+/g, "")}`;
}

export async function resolveImageHostPublicUrl(relativePath: string): Promise<string | null> {
	const config = await readImageHostConfig();
	if (!config.publicUrlPrefix) return null;
	const clean = normalizeRemotePath(relativePath, "");
	if (!clean) return null;
	return joinImagePublicUrl(config.publicUrlPrefix, clean);
}

export async function saveImageAsset(
	fileName: string,
	bytes: Buffer,
	options?: SaveImageAssetOptions,
): Promise<string> {
	const config = await readImageHostConfig();
	const asset = await prepareImageAsset(
		fileName,
		bytes,
		options?.contentType,
		options?.forceWebp,
	);
	const preparedFileName = `${path.basename(
		fileName,
		path.extname(fileName),
	)}${asset.ext}`;

	if (config.mode === "local") {
		return saveUpload(preparedFileName, asset.bytes, options);
	}

	assertRemoteReady(config);
	const remotePath = buildRemoteAssetPath(config, asset.ext);
	const providers = providersForMode(config);
	const assetMd5 = createAssetMd5(asset.bytes);
	const manifest = await readAssetManifest();
	const reusableAsset = findReusableAsset(manifest, assetMd5, asset.ext);

	if (reusableAsset) {
		const missingProviders = providersMissing(reusableAsset, providers);
		if (missingProviders.length > 0) {
			await uploadToProviders(config, reusableAsset.path, asset, missingProviders);
			const updatedEntry: ImageHostAssetEntry = {
				...reusableAsset,
				size: asset.bytes.length,
				contentType: asset.contentType,
				providers: Array.from(
					new Set([...reusableAsset.providers, ...missingProviders]),
				),
			};
			await writeAssetManifest(upsertAssetManifestEntry(manifest, updatedEntry));
		}
		const existingUrl = `/${reusableAsset.path}`;
		if (config.returnUrlMode === "absolute") {
			return resolveAbsoluteRemoteUrl(config, reusableAsset.path);
		}
		return existingUrl;
	}

	await uploadToProviders(config, remotePath, asset, providers);

	await writeAssetManifest(
		upsertAssetManifestEntry(manifest, {
			md5: assetMd5,
			path: remotePath,
			ext: asset.ext,
			size: asset.bytes.length,
			contentType: asset.contentType,
			providers,
			uploadedAt: new Date().toISOString(),
		}),
	);

	const relativeUrl = `/${remotePath}`;
	if (config.returnUrlMode === "absolute") {
		return resolveAbsoluteRemoteUrl(config, remotePath);
	}
	return relativeUrl;
}
