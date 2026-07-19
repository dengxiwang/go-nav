import path from "node:path";
import { NextResponse } from "next/server";
import { getFileStore } from "@/lib/server/storage/driver";

const MIME: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};

/**
 * 提供 uploads 文件的访问能力：GET /uploads/xxx.png
 * 通过 FileStore 抽象层读取，兼容 fs 和 Cloudflare R2 两种实现。
 */
export async function GET(
	req: Request,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path: segs } = await params;
	const fileName = segs.join("/");
	// 安全检查：防止路径越界
	if (!fileName || fileName.includes("..") || path.isAbsolute(fileName)) {
		return NextResponse.json({ error: "forbidden" }, { status: 403 });
	}

	const fileStore = getFileStore();
	const entry = await fileStore.read(fileName);
	if (!entry) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}

	const ext = path.extname(fileName).toLowerCase();
	const etag = `"${entry.size.toString(16)}-${Math.floor(entry.mtime).toString(16)}"`;
	const lastModified = new Date(entry.mtime).toUTCString();

	if (req.headers.get("if-none-match") === etag) {
		return new Response(null, { status: 304, headers: { ETag: etag } });
	}
	const ifModifiedSince = req.headers.get("if-modified-since");
	if (ifModifiedSince && Number.isFinite(Date.parse(ifModifiedSince))) {
		if (entry.mtime <= Date.parse(ifModifiedSince)) {
			return new Response(null, { status: 304, headers: { ETag: etag } });
		}
	}

	const headers = new Headers({
		"Content-Type": MIME[ext] || "application/octet-stream",
		"Content-Length": String(entry.size),
		"Cache-Control": "public, max-age=31536000, immutable",
		ETag: etag,
		"Last-Modified": lastModified,
		"X-Content-Type-Options": "nosniff",
	});
	if (ext === ".svg") {
		headers.set("Content-Security-Policy", "script-src 'none'; sandbox");
	}

	return new Response(entry.data as unknown as BodyInit, { headers });
}

export async function HEAD(
	req: Request,
	ctx: { params: Promise<{ path: string[] }> },
) {
	const res = await GET(req, ctx);
	return new Response(null, {
		status: res.status,
		headers: res.headers,
	});
}
