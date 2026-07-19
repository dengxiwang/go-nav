/**
 * 极简 ZIP 读写实现，用于备份 / 还原。
 *
 * 仅支持 store(0) 与 deflate(8) 两种压缩方法，足以处理
 * 文本（json）与图片（uploads/*）混合场景。
 *
 * 不依赖第三方库，只用 Node 内置 zlib。
 */
import { deflateRawSync, inflateRawSync } from "node:zlib";

export interface ZipEntry {
	name: string;
	data: Buffer;
}

export interface ParseZipOptions {
	maxEntries?: number;
	maxEntryUncompressedBytes?: number;
	maxTotalUncompressedBytes?: number;
}

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		t[i] = c >>> 0;
	}
	return t;
})();

function crc32(buf: Buffer): number {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) {
		c = (CRC_TABLE[(c ^ buf[i]) & 0xff] ?? 0) ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
}

function dosTime(date: Date): { time: number; date: number } {
	const time =
		(date.getHours() << 11) |
		(date.getMinutes() << 5) |
		Math.floor(date.getSeconds() / 2);
	const dateOut =
		((Math.max(1980, date.getFullYear()) - 1980) << 9) |
		((date.getMonth() + 1) << 5) |
		date.getDate();
	return { time, date: dateOut };
}

/** 将多个文件打包为 ZIP。 */
export function createZip(entries: ZipEntry[]): Buffer {
	const now = new Date();
	const dt = dosTime(now);
	const localParts: Buffer[] = [];
	const cdParts: Buffer[] = [];
	let offset = 0;

	for (const entry of entries) {
		const nameBuf = Buffer.from(entry.name, "utf8");
		const uncompressed = entry.data;
		const crc = crc32(uncompressed);

		const deflated = deflateRawSync(uncompressed);
		let method: number;
		let compressed: Buffer;
		if (uncompressed.length > 0 && deflated.length < uncompressed.length) {
			method = 8;
			compressed = deflated;
		} else {
			method = 0;
			compressed = uncompressed;
		}

		const lfh = Buffer.alloc(30);
		lfh.writeUInt32LE(0x04034b50, 0);
		lfh.writeUInt16LE(20, 4);
		lfh.writeUInt16LE(0x0800, 6); // utf-8 文件名
		lfh.writeUInt16LE(method, 8);
		lfh.writeUInt16LE(dt.time, 10);
		lfh.writeUInt16LE(dt.date, 12);
		lfh.writeUInt32LE(crc, 14);
		lfh.writeUInt32LE(compressed.length, 18);
		lfh.writeUInt32LE(uncompressed.length, 22);
		lfh.writeUInt16LE(nameBuf.length, 26);
		lfh.writeUInt16LE(0, 28);

		localParts.push(lfh, nameBuf, compressed);

		const cdh = Buffer.alloc(46);
		cdh.writeUInt32LE(0x02014b50, 0);
		cdh.writeUInt16LE(20, 4);
		cdh.writeUInt16LE(20, 6);
		cdh.writeUInt16LE(0x0800, 8);
		cdh.writeUInt16LE(method, 10);
		cdh.writeUInt16LE(dt.time, 12);
		cdh.writeUInt16LE(dt.date, 14);
		cdh.writeUInt32LE(crc, 16);
		cdh.writeUInt32LE(compressed.length, 20);
		cdh.writeUInt32LE(uncompressed.length, 24);
		cdh.writeUInt16LE(nameBuf.length, 28);
		cdh.writeUInt16LE(0, 30);
		cdh.writeUInt16LE(0, 32);
		cdh.writeUInt16LE(0, 34);
		cdh.writeUInt16LE(0, 36);
		cdh.writeUInt32LE(0, 38);
		cdh.writeUInt32LE(offset, 42);

		cdParts.push(cdh, nameBuf);

		offset += lfh.length + nameBuf.length + compressed.length;
	}

	const cdBuf = Buffer.concat(cdParts);
	const cdOffset = offset;
	const cdSize = cdBuf.length;

	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0);
	eocd.writeUInt16LE(0, 4);
	eocd.writeUInt16LE(0, 6);
	eocd.writeUInt16LE(entries.length, 8);
	eocd.writeUInt16LE(entries.length, 10);
	eocd.writeUInt32LE(cdSize, 12);
	eocd.writeUInt32LE(cdOffset, 16);
	eocd.writeUInt16LE(0, 20);

	return Buffer.concat([...localParts, cdBuf, eocd]);
}

/** 解析 ZIP 二进制内容，返回所有文件。 */
export function parseZip(
	buf: Buffer,
	options: ParseZipOptions = {},
): ZipEntry[] {
	const maxEntries = options.maxEntries ?? Number.POSITIVE_INFINITY;
	const maxEntryBytes =
		options.maxEntryUncompressedBytes ?? Number.POSITIVE_INFINITY;
	const maxTotalBytes =
		options.maxTotalUncompressedBytes ?? Number.POSITIVE_INFINITY;
	if (buf.length < 22) throw new Error("不是有效的 ZIP 文件");

	let eocdOffset = -1;
	const minStart = Math.max(0, buf.length - 22 - 65535);
	for (let i = buf.length - 22; i >= minStart; i--) {
		if (buf.readUInt32LE(i) === 0x06054b50) {
			eocdOffset = i;
			break;
		}
	}
	if (eocdOffset < 0) {
		throw new Error("不是有效的 ZIP 文件");
	}

	const totalEntries = buf.readUInt16LE(eocdOffset + 10);
	const cdOffset = buf.readUInt32LE(eocdOffset + 16);
	if (totalEntries > maxEntries) {
		throw new Error(`ZIP 文件数量不能超过 ${maxEntries}`);
	}
	if (cdOffset > eocdOffset) throw new Error("ZIP 中央目录位置无效");

	const entries: ZipEntry[] = [];
	let totalUncompressedBytes = 0;
	let p = cdOffset;
	for (let i = 0; i < totalEntries; i++) {
		if (p < 0 || p + 46 > buf.length) {
			throw new Error("ZIP 中央目录已损坏");
		}
		if (buf.readUInt32LE(p) !== 0x02014b50) {
			throw new Error("ZIP 中央目录签名错误");
		}
		const method = buf.readUInt16LE(p + 10);
		const expectedCrc = buf.readUInt32LE(p + 16);
		const compressedSize = buf.readUInt32LE(p + 20);
		const uncompressedSize = buf.readUInt32LE(p + 24);
		const nameLen = buf.readUInt16LE(p + 28);
		const extraLen = buf.readUInt16LE(p + 30);
		const commentLen = buf.readUInt16LE(p + 32);
		const lfhOffset = buf.readUInt32LE(p + 42);
		const nextEntryOffset = p + 46 + nameLen + extraLen + commentLen;
		if (nextEntryOffset > buf.length) {
			throw new Error("ZIP 中央目录条目已损坏");
		}
		const name = buf
			.subarray(p + 46, p + 46 + nameLen)
			.toString("utf8");
		p = nextEntryOffset;

		if (uncompressedSize > maxEntryBytes) {
			throw new Error("ZIP 中的单个文件解压后过大");
		}
		totalUncompressedBytes += uncompressedSize;
		if (totalUncompressedBytes > maxTotalBytes) {
			throw new Error("ZIP 解压后的总大小超出限制");
		}

		if (lfhOffset + 30 > buf.length) {
			throw new Error("ZIP 本地文件头位置无效");
		}
		if (buf.readUInt32LE(lfhOffset) !== 0x04034b50) {
			throw new Error("ZIP 本地文件头签名错误");
		}
		const lfhNameLen = buf.readUInt16LE(lfhOffset + 26);
		const lfhExtraLen = buf.readUInt16LE(lfhOffset + 28);
		const dataStart = lfhOffset + 30 + lfhNameLen + lfhExtraLen;
		if (dataStart > buf.length || dataStart + compressedSize > buf.length) {
			throw new Error("ZIP 文件内容已截断");
		}
		const compressedData = buf.subarray(
			dataStart,
			dataStart + compressedSize,
		);

		if (name.endsWith("/")) continue; // 跳过目录条目

		let data: Buffer;
		if (method === 0) {
			if (compressedSize !== uncompressedSize) {
				throw new Error("ZIP 未压缩条目的大小无效");
			}
			data = Buffer.from(compressedData);
		} else if (method === 8) {
			data = inflateRawSync(compressedData, {
				maxOutputLength: Math.max(1, uncompressedSize),
			});
		} else {
			throw new Error(`不支持的 ZIP 压缩方法: ${method}`);
		}
		if (data.length !== uncompressedSize) {
			throw new Error("ZIP 条目解压后的大小不一致");
		}
		if (crc32(data) !== expectedCrc) {
			throw new Error("ZIP 条目校验失败，文件可能已损坏");
		}
		entries.push({ name, data });
	}
	return entries;
}
