import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/server/api-auth";
import { revalidateFrontendPaths } from "@/lib/server/revalidate-frontend";
import {
	readImageHostConfig,
	saveImageHostConfigFromInput,
	toPublicImageHostConfig,
	type ImageHostConfigInput,
} from "@/lib/server/image-hosting";

export async function GET() {
	if (!(await requireAdminAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}
	try {
		return NextResponse.json(toPublicImageHostConfig(await readImageHostConfig()));
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}

export async function PUT(req: Request) {
	if (!(await requireAdminAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}
	let body: ImageHostConfigInput;
	try {
		body = (await req.json()) as ImageHostConfigInput;
	} catch {
		return NextResponse.json({ error: "invalid body" }, { status: 400 });
	}
	try {
		const config = await saveImageHostConfigFromInput(body);
		await revalidateFrontendPaths();
		return NextResponse.json(config);
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
