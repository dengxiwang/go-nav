import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import { revalidateFrontendPaths } from "@/lib/server/revalidate-frontend";
import {
	getConfigRevision,
	parseStructuredContent,
	readWebsiteData,
	stringifyStructuredContent,
	writeWebsiteData,
} from "@/lib/server/store";
import type { WebsiteData } from "@/types";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!await verifySession(token);
}

async function buildSourceFilePayload(websiteData: WebsiteData) {
	return {
			content: stringifyStructuredContent(websiteData, "website"),
			fileName: "website.json",
			format: "json" as const,
			revision: await getConfigRevision(),
		};
}

export async function GET() {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}
	try {
		const websiteData = await readWebsiteData();
		return NextResponse.json(await buildSourceFilePayload(websiteData));
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}

export async function PUT(req: Request) {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}
	let body: { content: string };
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "invalid body" }, { status: 400 });
	}
	if (!body.content || typeof body.content !== "string") {
		return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
	}
	let websiteData: WebsiteData;
	try {
		websiteData = parseStructuredContent<WebsiteData>(body.content);
	} catch {
		return NextResponse.json(
			{ error: "格式错误，请检查 JSON / YAML 语法后重试" },
			{ status: 400 },
		);
	}
	try {
		if (!websiteData || typeof websiteData !== "object" || Array.isArray(websiteData)) {
			return NextResponse.json({ error: "配置内容无效" }, { status: 400 });
		}
		await writeWebsiteData(websiteData);
		await revalidateFrontendPaths();
		return NextResponse.json({
			ok: true,
			websiteData,
			...(await buildSourceFilePayload(websiteData)),
		});
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
