"use client";

const COMPRESSIBLE_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/svg+xml",
]);

export interface UploadImageOptions {
	maxEdge: number;
	quality: number;
	minCompressBytes?: number;
	compress?: boolean;
	forceWebp?: boolean;
	fileNamePrefix?: string;
}

function buildWebpName(fileName: string) {
	const dot = fileName.lastIndexOf(".");
	const base = dot > 0 ? fileName.slice(0, dot) : fileName;
	return `${base || "upload"}.webp`;
}

async function compressImageIfNeeded(
	file: File,
	options: UploadImageOptions,
): Promise<File> {
	if (typeof window === "undefined") return file;
	if (!options.compress && !options.forceWebp) return file;
	if (!COMPRESSIBLE_TYPES.has(file.type)) return file;
	if (
		!options.forceWebp &&
		file.size < (options.minCompressBytes ?? 120 * 1024)
	) {
		return file;
	}

	let bitmap: ImageBitmap | null = null;
	try {
		bitmap = await createImageBitmap(file);
		const maxEdge = Math.max(1, options.maxEdge);
		const longerEdge = Math.max(bitmap.width, bitmap.height);
		const scale = longerEdge > maxEdge ? maxEdge / longerEdge : 1;
		const width = Math.max(1, Math.round(bitmap.width * scale));
		const height = Math.max(1, Math.round(bitmap.height * scale));

		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return file;

		ctx.drawImage(bitmap, 0, 0, width, height);
		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, "image/webp", options.quality);
		});
		if (!blob) return file;

		const compressed = new File([blob], buildWebpName(file.name), {
			type: "image/webp",
		});
		if (!options.forceWebp && compressed.size >= file.size * 0.95) return file;
		return compressed;
	} catch {
		return file;
	} finally {
		bitmap?.close();
	}
}

function applyFileNamePrefix(file: File, prefix: string | undefined): File {
	const normalized = (prefix ?? "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 28);
	if (!normalized) return file;

	const dot = file.name.lastIndexOf(".");
	const rawExtension = dot > 0 ? file.name.slice(dot).toLowerCase() : "";
	const extension = /^\.[a-z0-9]+$/.test(rawExtension) ? rawExtension : "";
	return new File([file], `${normalized}${extension}`, {
		type: file.type,
		lastModified: file.lastModified,
	});
}

export async function uploadImageWithCompression(
	file: File,
	options: UploadImageOptions,
): Promise<string> {
	const prepared = applyFileNamePrefix(
		await compressImageIfNeeded(file, options),
		options.fileNamePrefix,
	);
	const form = new FormData();
	form.append("file", prepared);

	const res = await fetch("/api/upload/", { method: "POST", body: form });
	if (!res.ok) {
		const data = (await res.json().catch(() => ({}))) as { error?: string };
		throw new Error(data.error || `上传失败 (${res.status})`);
	}
	const data = (await res.json()) as { url: string };
	return data.url;
}
