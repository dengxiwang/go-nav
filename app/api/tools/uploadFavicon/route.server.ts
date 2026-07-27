import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import { saveFaviconFromUrl } from "@/lib/server/favicon";

/**
 * 接收 Data URL 或图片 URL，下载并保存到当前配置的素材存储。
 * POST /api/tools/uploadFavicon
 * Body: { faviconUrl: string } // data:image/...base64 或 https://...
 */
export async function POST(req: Request) {
	const store = await cookies();
	if (!verifySession(store.get(SESSION_COOKIE)?.value)) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}

	try {
		const body = (await req.json()) as { faviconUrl?: string };
		const faviconUrl = body?.faviconUrl;
		if (!faviconUrl) {
			return NextResponse.json({ error: "缺少 faviconUrl" }, { status: 400 });
		}

		if (
			!faviconUrl.startsWith("data:image/") &&
			!faviconUrl.startsWith("http://") &&
			!faviconUrl.startsWith("https://")
		) {
			return NextResponse.json({ error: "不支持的 URL 格式" }, { status: 400 });
		}

		const url = await saveFaviconFromUrl(faviconUrl);
		return NextResponse.json({ url });
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
