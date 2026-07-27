import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import {
	fetchPublicResource,
	normalizeHttpUrl,
	readResponseBytes,
} from "@/lib/server/fetch-utils";
import {
	findFaviconCandidates,
	saveFaviconFromUrl,
} from "@/lib/server/favicon";

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
 * Body: { url: string, fetchIcon?: boolean }
 * 默认自动下载图标并返回本地模式下的 /uploads/... URL。
 */
export async function POST(req: Request) {
	const store = await cookies();
	if (!verifySession(store.get(SESSION_COOKIE)?.value)) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}

	try {
		const body = (await req.json()) as {
			url?: string;
			fetchIcon?: boolean;
		};
		const targetUrl = body?.url;
		if (!targetUrl) {
			return NextResponse.json({ error: "缺少 url" }, { status: 400 });
		}

		const target = normalizeHttpUrl(targetUrl);
		const res = await fetchPublicResource(target, {
			method: "GET",
			timeoutMs: REQUEST_TIMEOUT,
			maxBytes: MAX_HTML_SIZE,
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
			},
		});
		if (!res.ok) {
			return NextResponse.json(
				{ error: `HTTP ${res.status}` },
				{ status: 400 },
			);
		}
		const bytes = await readResponseBytes(res, MAX_HTML_SIZE);
		const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
		const finalUrl = res.url || target.href;

		const titleMatch = html.match(
			/<title[^>]*>([^<]+)<\/title>/i,
		);
		const rawTitle = titleMatch?.[1]?.trim() || "";
		const title = extractPrimaryTitle(rawTitle);

		let iconUrl: string | null = null;
		if (body.fetchIcon !== false) {
			const host = new URL(finalUrl).hostname;
			for (const candidate of findFaviconCandidates(html, finalUrl)) {
				try {
					iconUrl = await saveFaviconFromUrl(candidate, {
						fileNamePrefix: `favicon-${host}`,
					});
					break;
				} catch {
					// 当前候选不可用时继续尝试其它 link icon 与 /favicon.ico。
				}
			}
		}

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
			iconUrl,
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
