import {
	fetchPublicResource,
	readResponseBytes,
} from "@/lib/server/fetch-utils";
import { saveImageAsset } from "@/lib/server/image-hosting";
import { readNav } from "@/lib/server/store";

const MAX_FAVICON_SIZE = 2 * 1024 * 1024;
const REQUEST_TIMEOUT = 15_000;
const MAX_FAVICON_CANDIDATES = 6;
const DATA_URL_IMAGE_RE =
	/^data:image\/([^;]+);base64,([a-z0-9+/=\s]+)$/i;

interface FaviconCandidate {
	href: string;
	sizes: string;
	type: string;
}

export interface SaveFaviconOptions {
	fileNamePrefix?: string;
}

/**
 * 从页面 HTML 中收集并排序图标地址。
 * 优先选择大尺寸 PNG / SVG / apple-touch-icon，最后回退到 /favicon.ico。
 */
export function findFaviconCandidates(
	html: string,
	baseUrl: string | URL,
): string[] {
	const resolvedBase = baseUrl instanceof URL ? baseUrl : new URL(baseUrl);
	const candidates = new Map<string, FaviconCandidate>();
	const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];

	for (const tag of linkTags) {
		const rel = getHtmlAttribute(tag, "rel").trim().toLowerCase();
		if (!rel.split(/\s+/).some((part) => part.includes("icon"))) continue;

		const href = getHtmlAttribute(tag, "href").trim();
		if (!href) continue;

		const resolvedHref = resolveFaviconUrl(href, resolvedBase);
		if (!resolvedHref || candidates.has(resolvedHref)) continue;

		candidates.set(resolvedHref, {
			href: resolvedHref,
			sizes: getHtmlAttribute(tag, "sizes"),
			type: getHtmlAttribute(tag, "type"),
		});
	}

	const sorted = Array.from(candidates.values())
		.sort((a, b) => scoreFavicon(b) - scoreFavicon(a))
		.slice(0, MAX_FAVICON_CANDIDATES)
		.map((candidate) => candidate.href);
	const fallback = new URL("/favicon.ico", resolvedBase).href;

	if (!sorted.includes(fallback)) sorted.push(fallback);
	return sorted;
}

/**
 * 下载 favicon 并保存到当前配置的素材存储；本地模式返回 /uploads/...。
 */
export async function saveFaviconFromUrl(
	faviconUrl: string,
	options?: SaveFaviconOptions,
): Promise<string> {
	let bytes: Buffer;
	let ext: string;

	if (faviconUrl.startsWith("data:image/")) {
		const match = faviconUrl.match(DATA_URL_IMAGE_RE);
		if (!match) throw new Error("无效的图标 Data URL");

		const encoded = match[2].replace(/\s/g, "");
		const estimatedBytes = Math.floor((encoded.length * 3) / 4);
		if (estimatedBytes > MAX_FAVICON_SIZE) {
			throw new Error("图标过大（最大 2MB）");
		}

		ext = imageMimeToExtension(match[1]);
		bytes = Buffer.from(encoded, "base64");
	} else {
		const res = await fetchPublicResource(faviconUrl, {
			method: "GET",
			timeoutMs: REQUEST_TIMEOUT,
			maxBytes: MAX_FAVICON_SIZE,
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
			},
		});
		if (!res.ok) throw new Error(`图标下载失败 HTTP ${res.status}`);

		const contentType = (res.headers.get("content-type") || "")
			.split(";")[0]
			.trim()
			.toLowerCase();
		if (!contentType.startsWith("image/")) {
			throw new Error("图标地址返回的内容不是图片");
		}

		ext = imageMimeToExtension(contentType.slice("image/".length));
		bytes = await readResponseBytes(res, MAX_FAVICON_SIZE);
	}

	if (bytes.length === 0) throw new Error("图标内容为空");
	if (bytes.length > MAX_FAVICON_SIZE) {
		throw new Error("图标过大（最大 2MB）");
	}

	const imageUpload = readNav().imageUpload;
	const prefix = sanitizeFileNamePrefix(options?.fileNamePrefix);
	return saveImageAsset(`${prefix}${ext}`, bytes, {
		dedupeByContent: true,
		contentType: contentTypeFromExtension(ext),
		compress: imageUpload?.compress === true,
		forceWebp: imageUpload?.convertToWebp === true,
	});
}

function getHtmlAttribute(tag: string, name: string): string {
	for (const match of tag.matchAll(
		/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g,
	)) {
		if (match[1].toLowerCase() === name.toLowerCase()) {
			return decodeHtmlAttribute(match[2] ?? match[3] ?? match[4] ?? "");
		}
	}
	return "";
}

function decodeHtmlAttribute(value: string): string {
	return value
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, '"')
		.replace(/&apos;|&#39;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">");
}

function resolveFaviconUrl(href: string, baseUrl: URL): string | null {
	try {
		const resolved = new URL(href, baseUrl);
		if (
			resolved.protocol !== "http:" &&
			resolved.protocol !== "https:" &&
			resolved.protocol !== "data:"
		) {
			return null;
		}
		return resolved.href;
	} catch {
		return null;
	}
}

function scoreFavicon(candidate: FaviconCandidate): number {
	let score = 0;
	let path = "";
	let query = "";

	try {
		const url = new URL(candidate.href);
		path = url.pathname.toLowerCase();
		query = url.search;
	} catch {
		path = candidate.href.toLowerCase();
	}

	const type = candidate.type.toLowerCase();
	if (path.endsWith(".png") || type.includes("png")) score += 100;
	else if (path.endsWith(".svg") || type.includes("svg")) score += 95;
	else if (path.endsWith(".webp") || type.includes("webp")) score += 90;
	else if (path.endsWith(".ico") || type.includes("icon")) score += 10;
	else score += 5;

	const declaredSize = Array.from(
		candidate.sizes.matchAll(/(\d+)\s*x\s*(\d+)/gi),
	).reduce((max, match) => {
		const width = Number.parseInt(match[1], 10);
		const height = Number.parseInt(match[2], 10);
		return Math.max(max, Math.min(width, height));
	}, 0);
	if (declaredSize > 0) score += Math.min(declaredSize, 512);

	const sizeScores: Array<[string, number]> = [
		["512", 200],
		["384", 180],
		["256", 160],
		["192", 140],
		["180", 130],
		["152", 120],
		["144", 110],
		["128", 100],
		["96", 80],
		["72", 60],
		["48", 40],
		["32", 20],
		["16", 10],
	];
	for (const [size, sizeScore] of sizeScores) {
		if (path.includes(size)) {
			score += sizeScore;
			break;
		}
	}

	if (path.includes("apple-touch-icon")) score += 30;
	if (path.includes("maskable")) score += 50;
	if (path.includes("android-chrome")) score += 20;
	if (path === "/favicon.ico" && query) score -= 50;
	score += path.split("/").filter(Boolean).length;

	return score;
}

function imageMimeToExtension(rawMime: string): string {
	const mime = rawMime.toLowerCase();
	if (mime.includes("svg")) return ".svg";
	if (mime.includes("png")) return ".png";
	if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
	if (mime.includes("gif")) return ".gif";
	if (mime.includes("webp")) return ".webp";
	if (mime.includes("avif")) return ".avif";
	if (mime.includes("icon")) return ".ico";
	return ".png";
}

function contentTypeFromExtension(ext: string): string {
	if (ext === ".svg") return "image/svg+xml";
	if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
	if (ext === ".gif") return "image/gif";
	if (ext === ".webp") return "image/webp";
	if (ext === ".avif") return "image/avif";
	if (ext === ".ico") return "image/x-icon";
	return "image/png";
}

function sanitizeFileNamePrefix(prefix: string | undefined): string {
	const sanitized = (prefix || "favicon")
		.toLowerCase()
		.replace(/[^a-z0-9.-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);
	return sanitized || "favicon";
}
