import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import {
	fetchPublicResource,
	normalizeHttpUrl,
	readResponseBytes,
} from "@/lib/server/fetch-utils";

const MAX_HTML_SIZE = 2 * 1024 * 1024;
const REQUEST_TIMEOUT = 20_000;

function extractPrimaryTitle(rawTitle: string): string {
	const normalized = rawTitle.replace(/\s+/g, " ").trim();
	if (!normalized) return "";
	const [primary] = normalized.split(/\s*(?:——|—|｜|\||_|-|（|\(|，|,)\s*/);
	return primary?.trim() || normalized;
}

/**
 * 获取网站 HTML 并解析 title、favicon 等信息。
 * POST /api/fetch-website
 * Body: { url: string }
 */
export async function POST(req: Request) {
	const store = await cookies();
	if (!await verifySession(store.get(SESSION_COOKIE)?.value)) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}

	try {
		const body = (await req.json()) as { url?: string };
		const targetUrl = body?.url;
		if (!targetUrl) {
			return NextResponse.json({ error: "缺少 url" }, { status: 400 });
		}

		let html: string;
		try {
			const target = normalizeHttpUrl(targetUrl);
			const res = await fetchPublicResource(target, {
				method: "GET",
				timeoutMs: REQUEST_TIMEOUT,
				maxBytes: MAX_HTML_SIZE,
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				},
			});
			if (!res.ok) {
				return NextResponse.json(
					{ error: `HTTP ${res.status}` },
					{ status: 400 },
				);
			}
			const bytes = await readResponseBytes(res, MAX_HTML_SIZE);
			html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
		} catch (e) {
			throw e;
		}

		const titleMatch = html.match(
			/<title[^>]*>([^<]+)<\/title>/i,
		);
		const rawTitle = titleMatch?.[1]?.trim() || "";
		const title = extractPrimaryTitle(rawTitle);

		const faviconUrl = extractFaviconUrl(html, targetUrl);

		const descriptionMatch = html.match(
			/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
		) ||
			html.match(
				/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
			);
		const description = descriptionMatch?.[1]?.trim() || "";

		const keywordsMatch = html.match(
			/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']*)["']/i,
		) ||
			html.match(
				/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']keywords["']/i,
			);
		const keywords = keywordsMatch?.[1]
			?.split(/[,，]/)
			.map((s) => s.trim())
			.filter(Boolean) || [];

		return NextResponse.json({
			title,
			faviconUrl,
			description,
			keywords,
		});
	} catch (e) {
		return NextResponse.json(
			{ error: (e as Error).message || "获取失败" },
			{ status: 500 },
		);
	}
}

function extractFaviconUrl(html: string, baseUrl: string): string | null {
	const linkTags = html.match(
		/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]*>/gi,
	) || html.match(/<link[^>]+(?:icon|shortcut icon)[^>]*>/gi) || [];

	for (const tag of linkTags) {
		const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
		if (hrefMatch?.[1]) {
			return resolveUrl(hrefMatch[1], baseUrl);
		}
	}

	return resolveUrl("/favicon.ico", baseUrl);
}

function resolveUrl(href: string, baseUrl: string): string {
	if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("data:")) {
		return href;
	}
	if (href.startsWith("//")) {
		return "https:" + href;
	}
	if (href.startsWith("/")) {
		try {
			const url = new URL(baseUrl);
			return url.origin + href;
		} catch {
			return href;
		}
	}
	try {
		return new URL(href, baseUrl).href;
	} catch {
		return href;
	}
}
