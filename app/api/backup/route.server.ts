import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
	BACKUP_IMPORT_ACTION_HEADER,
	BACKUP_IMPORT_CHUNK_BYTES,
	BACKUP_IMPORT_CHUNK_COUNT_HEADER,
	BACKUP_IMPORT_CHUNK_INDEX_HEADER,
	BACKUP_IMPORT_FILE_SIZE_HEADER,
	BACKUP_IMPORT_MAX_BYTES,
	BACKUP_IMPORT_UPLOAD_ID_HEADER,
	type BackupImportAction,
} from "@/lib/backup-import";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import { revalidateFrontendPaths } from "@/lib/server/revalidate-frontend";
import {
	createBackupFileName,
	createDataBackupZip,
	restoreDataBackupZip,
} from "@/lib/server/backup";
import {
	consumeBackupUpload,
	storeBackupUploadChunk,
	type BackupUploadDescriptor,
} from "@/lib/server/backup-upload";

class RequestBodyTooLargeError extends Error {}

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!verifySession(token);
}

function readIntegerHeader(req: Request, name: string): number {
	const raw = req.headers.get(name);
	if (!raw || !/^\d+$/.test(raw)) throw new Error("备份上传参数缺失或无效");
	const value = Number(raw);
	if (!Number.isSafeInteger(value)) throw new Error("备份上传参数超出范围");
	return value;
}

function readUploadDescriptor(req: Request): BackupUploadDescriptor {
	return {
		uploadId: req.headers.get(BACKUP_IMPORT_UPLOAD_ID_HEADER) ?? "",
		fileSize: readIntegerHeader(req, BACKUP_IMPORT_FILE_SIZE_HEADER),
		chunkCount: readIntegerHeader(req, BACKUP_IMPORT_CHUNK_COUNT_HEADER),
	};
}

async function readRequestBuffer(req: Request, maxBytes: number): Promise<Buffer> {
	const contentLength = req.headers.get("content-length");
	if (contentLength && /^\d+$/.test(contentLength)) {
		const declaredBytes = Number(contentLength);
		if (declaredBytes > maxBytes) throw new RequestBodyTooLargeError();
	}
	const ab = await req.arrayBuffer();
	if (ab.byteLength > maxBytes) throw new RequestBodyTooLargeError();
	return Buffer.from(ab);
}

function restoreBackup(buf: Buffer) {
	const restored = restoreDataBackupZip(buf);
	revalidateFrontendPaths();
	return NextResponse.json({ ok: true, restored });
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
		const zipBuf = createDataBackupZip();
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
 * 新版后台使用 512 KB 分片，避免触发常见反向代理的单请求体积限制；
 * 未携带分片请求头时仍兼容旧版 application/zip 原始请求体。
 */
export async function POST(req: Request) {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}

	const action = req.headers.get(
		BACKUP_IMPORT_ACTION_HEADER,
	) as BackupImportAction | null;
	try {
		if (action === "chunk") {
			const descriptor = readUploadDescriptor(req);
			const chunkIndex = readIntegerHeader(
				req,
				BACKUP_IMPORT_CHUNK_INDEX_HEADER,
			);
			const chunk = await readRequestBuffer(req, BACKUP_IMPORT_CHUNK_BYTES);
			if (chunk.length === 0) {
				return NextResponse.json({ error: "备份分片不能为空" }, { status: 400 });
			}
			const stored = storeBackupUploadChunk(descriptor, chunkIndex, chunk);
			return NextResponse.json({ ok: true, ...stored });
		}

		if (action === "complete") {
			const buf = consumeBackupUpload(readUploadDescriptor(req));
			return restoreBackup(buf);
		}

		if (action) {
			return NextResponse.json(
				{ error: "不支持的备份上传操作" },
				{ status: 400 },
			);
		}

		const buf = await readRequestBuffer(req, BACKUP_IMPORT_MAX_BYTES);
		if (buf.length === 0) {
			return NextResponse.json(
				{ error: "请上传备份 zip 文件" },
				{ status: 400 },
			);
		}
		return restoreBackup(buf);
	} catch (e) {
		if (e instanceof RequestBodyTooLargeError) {
			return NextResponse.json(
				{ error: "单次上传内容过大，请使用新版后台的分片还原功能" },
				{ status: 413 },
			);
		}
		return NextResponse.json({ error: (e as Error).message }, { status: 400 });
	}
}
