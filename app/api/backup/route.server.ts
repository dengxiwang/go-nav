import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import { revalidateFrontendPaths } from "@/lib/server/revalidate-frontend";
import {
	createBackupFileName,
	createDataBackupZip,
	restoreDataBackupZip,
} from "@/lib/server/backup";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!await verifySession(token);
}

/**
 * GET：导出完整备份为 ZIP 压缩包，包含
 *   - website.yaml / website.json
 *   - nav.yaml / nav.json
 *   - uploads/<filename>...
 */
export async function GET() {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}
	try {
		const zipBuf = await createDataBackupZip();
		// Buffer 是 Uint8Array 的子类，可直接作为 Response Body
		return new NextResponse(new Uint8Array(zipBuf), {
			status: 200,
			headers: {
				"Content-Type": "application/zip",
				"Content-Disposition": `attachment; filename="${createBackupFileName()}"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}

/**
 * POST：导入 ZIP 备份并覆盖写入。
 * 接受 application/zip（或 octet-stream）原始字节，body 即 zip 文件内容。
 */
export async function POST(req: Request) {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}

	let buf: Buffer;
	try {
		const ab = await req.arrayBuffer();
		if (!ab || ab.byteLength === 0) {
			return NextResponse.json(
				{ error: "请上传备份 zip 文件" },
				{ status: 400 },
			);
		}
		buf = Buffer.from(ab);
	} catch {
		return NextResponse.json({ error: "读取请求体失败" }, { status: 400 });
	}

	try {
		const restored = await restoreDataBackupZip(buf);
		await revalidateFrontendPaths();
		return NextResponse.json({
			ok: true,
			restored,
		});
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 400 });
	}
}
