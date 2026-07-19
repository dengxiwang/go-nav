import fs from "node:fs";
import path from "node:path";

/**
 * 数据目录（便于 Docker 映射）。
 * 通过环境变量 DATA_DIR 自定义，默认项目根目录下的 `data/`。
 */
export const DATA_DIR = process.env.DATA_DIR
	? path.resolve(process.env.DATA_DIR)
	: path.join(process.cwd(), "data");

const STRUCTURED_FILE_EXTENSIONS = [".yaml", ".yml", ".json"] as const;

export type StructuredFileFormat = "yaml" | "json";

function normalizeStructuredFileFormat(
	raw: string | undefined,
): StructuredFileFormat {
	const value = (raw || "").trim().toLowerCase();
	if (value === "yaml" || value === "yml") return "yaml";
	return "json";
}

const STRUCTURED_WRITE_FORMAT = normalizeStructuredFileFormat(
	process.env.DATA_FILE_FORMAT,
);

function extensionByFormat(format: StructuredFileFormat): ".yaml" | ".json" {
	return format === "yaml" ? ".yaml" : ".json";
}

function resolveStructuredDataReadOrder(): readonly string[] {
	if (STRUCTURED_WRITE_FORMAT === "yaml") {
		return [".yaml", ".yml", ".json"];
	}
	return [".json", ".yaml", ".yml"];
}

function resolveStructuredDataFile(baseName: string): string | null {
	for (const ext of resolveStructuredDataReadOrder()) {
		const file = path.join(DATA_DIR, `${baseName}${ext}`);
		if (fs.existsSync(file)) return file;
	}
	return null;
}

function buildStructuredDataFile(baseName: string, ext: string): string {
	return path.join(DATA_DIR, `${baseName}${ext}`);
}

export function getStructuredFileFormat(file: string): StructuredFileFormat {
	return file.toLowerCase().endsWith(".json") ? "json" : "yaml";
}

export function listStructuredDataFileCandidates(baseName: string): string[] {
	return STRUCTURED_FILE_EXTENSIONS.map((ext) =>
		buildStructuredDataFile(baseName, ext),
	);
}

/** 网站基础配置文件路径（读取优先当前写入格式，再 fallback 到其余格式） */
export function resolveWebsiteFilePathForRead(): string {
	return (
		resolveStructuredDataFile("website") ??
		buildStructuredDataFile("website", extensionByFormat(STRUCTURED_WRITE_FORMAT))
	);
}

/** 网站基础配置文件路径（写入格式由 DATA_FILE_FORMAT 控制，默认 json） */
export function resolveWebsiteFilePathForWrite(): string {
	return buildStructuredDataFile(
		"website",
		extensionByFormat(STRUCTURED_WRITE_FORMAT),
	);
}

/** 导航数据文件路径（读取优先当前写入格式，再 fallback 到其余格式） */
export function resolveNavFilePathForRead(): string {
	return (
		resolveStructuredDataFile("nav") ??
		buildStructuredDataFile("nav", extensionByFormat(STRUCTURED_WRITE_FORMAT))
	);
}

/** 导航数据文件路径（写入格式由 DATA_FILE_FORMAT 控制，默认 json） */
export function resolveNavFilePathForWrite(): string {
	return buildStructuredDataFile("nav", extensionByFormat(STRUCTURED_WRITE_FORMAT));
}

/** 上传图片目录（后台上传的文件落在这里） */
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

/** 图床上传记录，用于远端图床按内容 MD5 复用已有路径 */
export const IMAGE_HOST_ASSETS_FILE = path.join(DATA_DIR, "image-host-assets.json");

/** 动态部署收到的投稿审核队列（投稿内容不进入公开 nav 配置） */
export const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");

/** 图床配置文件路径（读取优先当前写入格式，再 fallback 到其余格式） */
export function resolveImageHostFilePathForRead(): string {
	return (
		resolveStructuredDataFile("image-host") ??
		buildStructuredDataFile(
			"image-host",
			extensionByFormat(STRUCTURED_WRITE_FORMAT),
		)
	);
}

/** 图床配置文件路径（写入格式由 DATA_FILE_FORMAT 控制，默认 json） */
export function resolveImageHostFilePathForWrite(): string {
	return buildStructuredDataFile(
		"image-host",
		extensionByFormat(STRUCTURED_WRITE_FORMAT),
	);
}

/** 远端同步配置文件路径（读取优先当前写入格式，再 fallback 到其余格式） */
export function resolveSyncFilePathForRead(): string {
	return (
		resolveStructuredDataFile("sync") ??
		buildStructuredDataFile("sync", extensionByFormat(STRUCTURED_WRITE_FORMAT))
	);
}

/** 远端同步配置文件路径（写入格式由 DATA_FILE_FORMAT 控制，默认 json） */
export function resolveSyncFilePathForWrite(): string {
	return buildStructuredDataFile("sync", extensionByFormat(STRUCTURED_WRITE_FORMAT));
}
