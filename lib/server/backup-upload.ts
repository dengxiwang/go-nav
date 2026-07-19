import fs from "node:fs";
import path from "node:path";
import {
	BACKUP_IMPORT_CHUNK_BYTES,
	BACKUP_IMPORT_MAX_BYTES,
} from "@/lib/backup-import";
import { DATA_DIR } from "@/lib/server/paths";

const UPLOAD_ROOT = path.join(DATA_DIR, ".backup-imports");
const UPLOAD_TTL_MS = 30 * 60 * 1000;
const UPLOAD_ID_PATTERN = /^[a-zA-Z0-9-]{16,80}$/;

interface UploadMeta {
	fileSize: number;
	chunkCount: number;
	nextIndex: number;
	updatedAt: number;
}

export interface BackupUploadDescriptor {
	uploadId: string;
	fileSize: number;
	chunkCount: number;
}

function validateDescriptor(
	descriptor: BackupUploadDescriptor,
): BackupUploadDescriptor {
	const { uploadId, fileSize, chunkCount } = descriptor;
	if (!UPLOAD_ID_PATTERN.test(uploadId)) {
		throw new Error("无效的备份上传标识");
	}
	if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
		throw new Error("备份文件大小无效");
	}
	if (fileSize > BACKUP_IMPORT_MAX_BYTES) {
		throw new Error("备份文件不能超过 256 MB");
	}
	const expectedChunkCount = Math.ceil(fileSize / BACKUP_IMPORT_CHUNK_BYTES);
	if (
		!Number.isSafeInteger(chunkCount) ||
		chunkCount <= 0 ||
		chunkCount !== expectedChunkCount
	) {
		throw new Error("备份分片数量无效");
	}
	return descriptor;
}

function uploadDir(uploadId: string): string {
	return path.join(UPLOAD_ROOT, uploadId);
}

function metaPath(uploadId: string): string {
	return path.join(uploadDir(uploadId), "meta.json");
}

function dataPath(uploadId: string): string {
	return path.join(uploadDir(uploadId), "backup.zip.part");
}

function readMeta(uploadId: string): UploadMeta {
	try {
		return JSON.parse(fs.readFileSync(metaPath(uploadId), "utf8")) as UploadMeta;
	} catch {
		throw new Error("备份上传会话不存在或已过期，请重新上传");
	}
}

function writeMeta(uploadId: string, meta: UploadMeta): void {
	const file = metaPath(uploadId);
	const tempFile = `${file}.tmp`;
	fs.writeFileSync(tempFile, JSON.stringify(meta), "utf8");
	fs.renameSync(tempFile, file);
}

function assertMatchingMeta(
	meta: UploadMeta,
	descriptor: BackupUploadDescriptor,
): void {
	if (
		meta.fileSize !== descriptor.fileSize ||
		meta.chunkCount !== descriptor.chunkCount
	) {
		throw new Error("备份上传参数与已有会话不一致，请重新上传");
	}
}

function cleanupExpiredUploads(now = Date.now()): void {
	if (!fs.existsSync(UPLOAD_ROOT)) return;
	for (const name of fs.readdirSync(UPLOAD_ROOT)) {
		if (!UPLOAD_ID_PATTERN.test(name)) continue;
		const dir = uploadDir(name);
		try {
			const meta = readMeta(name);
			if (now - meta.updatedAt <= UPLOAD_TTL_MS) continue;
			fs.rmSync(dir, { recursive: true, force: true });
		} catch {
			try {
				const stat = fs.statSync(dir);
				if (now - stat.mtimeMs > UPLOAD_TTL_MS) {
					fs.rmSync(dir, { recursive: true, force: true });
				}
			} catch {
				// 清理临时文件失败不应中断当前还原。
			}
		}
	}
}

export function storeBackupUploadChunk(
	descriptorInput: BackupUploadDescriptor,
	chunkIndex: number,
	chunk: Buffer,
): { receivedChunks: number } {
	const descriptor = validateDescriptor(descriptorInput);
	if (
		!Number.isSafeInteger(chunkIndex) ||
		chunkIndex < 0 ||
		chunkIndex >= descriptor.chunkCount
	) {
		throw new Error("备份分片序号无效");
	}

	const expectedSize =
		chunkIndex === descriptor.chunkCount - 1
			? descriptor.fileSize - chunkIndex * BACKUP_IMPORT_CHUNK_BYTES
			: BACKUP_IMPORT_CHUNK_BYTES;
	if (chunk.length !== expectedSize) {
		throw new Error("备份分片大小不正确，请重新上传");
	}

	if (chunkIndex === 0) {
		cleanupExpiredUploads();
		fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
		const dir = uploadDir(descriptor.uploadId);
		fs.rmSync(dir, { recursive: true, force: true });
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(dataPath(descriptor.uploadId), Buffer.alloc(0));
		writeMeta(descriptor.uploadId, {
			fileSize: descriptor.fileSize,
			chunkCount: descriptor.chunkCount,
			nextIndex: 0,
			updatedAt: Date.now(),
		});
	}

	const meta = readMeta(descriptor.uploadId);
	assertMatchingMeta(meta, descriptor);
	if (chunkIndex < meta.nextIndex) {
		return { receivedChunks: meta.nextIndex };
	}
	if (chunkIndex !== meta.nextIndex) {
		throw new Error(`缺少第 ${meta.nextIndex + 1} 个备份分片`);
	}

	fs.appendFileSync(dataPath(descriptor.uploadId), chunk);
	meta.nextIndex += 1;
	meta.updatedAt = Date.now();
	writeMeta(descriptor.uploadId, meta);
	return { receivedChunks: meta.nextIndex };
}

export function consumeBackupUpload(
	descriptorInput: BackupUploadDescriptor,
): Buffer {
	const descriptor = validateDescriptor(descriptorInput);
	const dir = uploadDir(descriptor.uploadId);
	try {
		const meta = readMeta(descriptor.uploadId);
		assertMatchingMeta(meta, descriptor);
		if (meta.nextIndex !== descriptor.chunkCount) {
			throw new Error(
				`备份上传不完整，还缺少 ${descriptor.chunkCount - meta.nextIndex} 个分片`,
			);
		}
		const file = dataPath(descriptor.uploadId);
		if (fs.statSync(file).size !== descriptor.fileSize) {
			throw new Error("备份上传后的文件大小不一致，请重新上传");
		}
		return fs.readFileSync(file);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}
