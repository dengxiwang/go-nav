import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import { saveImageAsset } from "@/lib/server/image-hosting";
import { readNav } from "@/lib/server/store";

const ALLOWED_UPLOAD_TYPES = new Map([
	["image/png", [".png"]],
	["image/jpeg", [".jpg", ".jpeg"]],
	["image/gif", [".gif"]],
	["image/webp", [".webp"]],
	["image/svg+xml", [".svg"]],
	["image/x-icon", [".ico"]],
	["image/vnd.microsoft.icon", [".ico"]],
]);

function getFileExtension(name: string) {
	const dot = name.lastIndexOf(".");
	return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function isAllowedUpload(type: string, name: string) {
	const ext = getFileExtension(name);
	if (!ext) return false;
	if (type) {
		return ALLOWED_UPLOAD_TYPES.get(type)?.includes(ext) ?? false;
	}
	for (const exts of ALLOWED_UPLOAD_TYPES.values()) {
		if (exts.includes(ext)) return true;
	}
	return false;
}

/**
 * 上传文件到当前配置的素材存储，返回 { url }。
 * 默认存入 data/uploads；启用图床后会上传到远端并返回 /img/... 或完整 URL。
 * 鉴权。支持 multipart/form-data（字段名 file）。
 */
export async function POST(req: Request) {
	const store = await cookies();
	if (!verifySession(store.get(SESSION_COOKIE)?.value)) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}
	const contentType = req.headers.get("content-type") || "";
	if (!contentType.includes("multipart/form-data")) {
		return NextResponse.json({ error: "需要 multipart/form-data" }, { status: 400 });
	}
	try {
		const form = await req.formData();
		const file = form.get("file");
		if (!(file instanceof Blob)) {
			return NextResponse.json({ error: "缺少 file 字段" }, { status: 400 });
		}
		const originalName =
			(file as unknown as { name?: string }).name || `upload-${Date.now()}.bin`;
		if (!isAllowedUpload(file.type, originalName)) {
			return NextResponse.json(
				{ error: "仅支持 png / jpg / gif / webp / svg / ico 图片" },
				{ status: 415 },
			);
		}
		const bytes = Buffer.from(await file.arrayBuffer());
		const imageUpload = readNav().imageUpload;
		const url = await saveImageAsset(originalName, bytes, {
			contentType: file.type,
			compress: imageUpload?.compress === true,
			forceWebp: imageUpload?.convertToWebp === true,
		});
		return NextResponse.json({ url });
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
