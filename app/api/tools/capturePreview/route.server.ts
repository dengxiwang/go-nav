import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import {
	assertPublicHttpUrl,
	fetchPublicResource,
	normalizeHttpUrl,
	readResponseBytes,
} from "@/lib/server/fetch-utils";
import { saveImageAsset } from "@/lib/server/image-hosting";
import { readNav } from "@/lib/server/store";

const MAX_PREVIEW_SIZE = 8 * 1024 * 1024;
const REQUEST_TIMEOUT = 35_000;
const PREVIEW_MAX_WIDTH = 1280;
const PREVIEW_MAX_HEIGHT = 900;

async function normalizeTargetUrl(raw: string): Promise<string> {
	const parsed = normalizeHttpUrl(raw);
	await assertPublicHttpUrl(parsed);
	return parsed.toString();
}

function contentTypeToExt(type: string): string {
	const lower = type.toLowerCase();
	if (lower.includes("webp")) return ".webp";
	if (lower.includes("png")) return ".png";
	if (lower.includes("gif")) return ".gif";
	if (lower.includes("avif")) return ".avif";
	if (lower.includes("jpeg") || lower.includes("jpg")) return ".jpg";
	return ".jpg";
}

async function compressPreviewImage(
	bytes: Buffer,
	contentType: string,
): Promise<{ bytes: Buffer; ext: string }> {
	if (contentType.toLowerCase().includes("svg")) {
		return { bytes, ext: ".svg" };
	}
	try {
		const sharpMod = (await import("sharp")).default;
		const meta = await sharpMod(bytes, { failOn: "none" }).metadata();
		const width = meta.width ?? PREVIEW_MAX_WIDTH;
		const height = meta.height ?? PREVIEW_MAX_HEIGHT;

		const compressed = await sharpMod(bytes, { failOn: "none" })
			.rotate()
			.resize({
				width: Math.min(width, PREVIEW_MAX_WIDTH),
				height: Math.min(height, PREVIEW_MAX_HEIGHT),
				fit: "inside",
				withoutEnlargement: true,
			})
			.webp({ quality: 80, effort: 4 })
			.toBuffer();

		// 如果压缩结果不够划算，保留原图，避免无意义的转码损耗。
		if (compressed.length >= bytes.length * 0.95) {
			return { bytes, ext: contentTypeToExt(contentType) };
		}
		return { bytes: compressed, ext: ".webp" };
	} catch {
		return { bytes, ext: contentTypeToExt(contentType) };
	}
}

function buildScreenshotSources(targetUrl: string): string[] {
	const encoded = encodeURIComponent(targetUrl);
	return [
		`https://image.thum.io/get/width/1366/crop/860/noanimate/${targetUrl}`,
		`https://s.wordpress.com/mshots/v1/${encoded}?w=1366`,
	];
}

async function tryFetchImage(url: string) {
	const res = await fetchPublicResource(url, {
		method: "GET",
		timeoutMs: REQUEST_TIMEOUT,
		maxBytes: MAX_PREVIEW_SIZE,
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
		},
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);

	const contentType = res.headers.get("content-type") || "";
	if (!contentType.toLowerCase().startsWith("image/")) {
		throw new Error("返回结果不是图片");
	}

	const bytes = await readResponseBytes(res, MAX_PREVIEW_SIZE);
	if (bytes.length === 0) throw new Error("截图内容为空");

	return { bytes, contentType };
}

/**
 * 自动获取网站首屏截图并保存到当前配置的素材存储。
 * POST /api/tools/capturePreview
 * Body: { url: string, existingPreviewUrl?: string }
 */
export async function POST(req: Request) {
	const store = await cookies();
	if (!verifySession(store.get(SESSION_COOKIE)?.value)) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}

	try {
		const body = (await req.json()) as {
			url?: string;
			existingPreviewUrl?: string;
		};
		if (!body?.url) {
			return NextResponse.json({ error: "缺少 url" }, { status: 400 });
		}

		const targetUrl = await normalizeTargetUrl(body.url);
		const candidates = buildScreenshotSources(targetUrl);
		const imageUpload = readNav().imageUpload;
		let lastError = "截图失败";

		for (const source of candidates) {
			try {
				const { bytes, contentType } = await tryFetchImage(source);
				const prepared =
					imageUpload?.compress === true
						? await compressPreviewImage(bytes, contentType)
						: { bytes, ext: contentTypeToExt(contentType) };
				const host = new URL(targetUrl).hostname.replace(/[^a-z0-9.-]/gi, "-");
				if (prepared.bytes.length > MAX_PREVIEW_SIZE) {
					throw new Error("截图文件过大");
				}
				const url = await saveImageAsset(
					`preview-${host}${prepared.ext}`,
					prepared.bytes,
					{
						dedupeByContent: true,
						preferredExistingUrl: body.existingPreviewUrl,
						contentType: contentTypeFromExt(prepared.ext),
						// 截图压缩已在上方完成，避免服务端再次有损编码。
						compress: false,
						forceWebp:
							imageUpload?.compress !== true &&
							imageUpload?.convertToWebp === true,
					},
				);
				return NextResponse.json({ url });
			} catch (e) {
				lastError = (e as Error).message || lastError;
			}
		}

		return NextResponse.json(
			{ error: `获取首屏截图失败：${lastError}` },
			{ status: 400 },
		);
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}

function contentTypeFromExt(ext: string): string {
	if (ext === ".svg") return "image/svg+xml";
	if (ext === ".png") return "image/png";
	if (ext === ".gif") return "image/gif";
	if (ext === ".webp") return "image/webp";
	if (ext === ".avif") return "image/avif";
	return "image/jpeg";
}
