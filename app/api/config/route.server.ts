import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NavConfig, WebsiteData } from "@/types";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import { revalidateFrontendPaths } from "@/lib/server/revalidate-frontend";
import {
	getSafeAccessProtectionConfig,
	toAdminNavConfig,
} from "@/lib/site-access-config";
import {
	prepareNavForWrite,
	SiteAccessConfigError,
} from "@/lib/server/site-access";
import {
	getConfigRevision,
	readNav,
	readWebsiteData,
	writeNav,
	writeWebsiteData,
} from "@/lib/server/store";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!verifySession(token);
}

/**
 * 读取完整配置（需鉴权）。
 * 前台页面通过 SSR 直读本地文件，不使用此接口；
 * 这里只供后台、编辑器等已登录场景调用，避免外部直接拉取全量配置。
 */
export async function GET() {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}
	try {
		const revision = getConfigRevision();
		const res = NextResponse.json({
			websiteData: readWebsiteData(),
			nav: toAdminNavConfig(readNav()),
			revision,
		});
		res.headers.set("ETag", `"${revision}"`);
		return res;
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}

/**
 * 更新配置：PUT { websiteData?, nav? }。鉴权。
 * 成功后触发前台页面 revalidate。
 */
export async function PUT(req: Request) {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}
	let body: { websiteData?: WebsiteData; nav?: NavConfig; revision?: string };
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "invalid body" }, { status: 400 });
	}
	try {
		const currentRevision = getConfigRevision();
		const ifMatch = req.headers.get("if-match")?.replace(/^"|"$/g, "");
		const expectedRevision = body.revision || ifMatch;
		if (expectedRevision && expectedRevision !== currentRevision) {
			return NextResponse.json(
				{
					error:
						"配置已被其它会话更新，请刷新后台后再保存，避免覆盖他人的改动。",
					revision: currentRevision,
				},
				{ status: 409 },
			);
		}
		const savedNav = body.nav
			? prepareNavForWrite(body.nav, readNav())
			: undefined;
		if (body.websiteData) writeWebsiteData(body.websiteData);
		if (savedNav) writeNav(savedNav);
		revalidateFrontendPaths();
		const revision = getConfigRevision();
		const res = NextResponse.json({
			ok: true,
			revision,
			...(savedNav
				? {
						accessProtection: getSafeAccessProtectionConfig(
							savedNav.accessProtection,
						),
					}
				: {}),
		});
		res.headers.set("ETag", `"${revision}"`);
		return res;
	} catch (e) {
		return NextResponse.json(
			{ error: (e as Error).message },
			{ status: e instanceof SiteAccessConfigError ? 400 : 500 },
		);
	}
}
