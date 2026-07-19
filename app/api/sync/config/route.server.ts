import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/server/api-auth";
import {
	readDataSyncConfig,
	saveDataSyncConfigFromInput,
	toPublicDataSyncConfig,
	type DataSyncConfigInput,
} from "@/lib/server/data-sync";

export async function GET() {
	if (!(await requireAdminAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}
	try {
		return NextResponse.json(toPublicDataSyncConfig(await readDataSyncConfig()));
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}

export async function PUT(req: Request) {
	if (!(await requireAdminAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}
	let body: DataSyncConfigInput;
	try {
		body = (await req.json()) as DataSyncConfigInput;
	} catch {
		return NextResponse.json({ error: "invalid body" }, { status: 400 });
	}
	try {
		return NextResponse.json(await saveDataSyncConfigFromInput(body));
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
