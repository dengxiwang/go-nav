"use client";

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { NavConfig, WebsiteData } from "@/types";

export const isHtmlDeployment =
	process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === "html";

const MAX_ZIP_SIZE = 10 * 1024 * 1024;
const MAX_CONFIG_SIZE = 20 * 1024 * 1024;

function downloadBlob(fileName: string, blob: Blob) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = fileName;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function configJson(value: unknown) {
	return `${JSON.stringify(value, null, 2)}\n`;
}

export function downloadConfigZip(nav: NavConfig, websiteData: WebsiteData) {
	const bytes = zipSync(
		{
			"nav.json": strToU8(configJson(nav)),
			"website.json": strToU8(configJson(websiteData)),
		},
		{ level: 6 },
	);
	const arrayBuffer = bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength,
	) as ArrayBuffer;
	const date = new Date().toISOString().slice(0, 10);
	downloadBlob(
		`go-nav-config-${date}.zip`,
		new Blob([arrayBuffer], { type: "application/zip" }),
	);
}

function findZipEntry(
	files: Record<string, Uint8Array>,
	fileName: "nav.json" | "website.json",
) {
	const direct = files[fileName];
	if (direct) return direct;
	const entry = Object.entries(files).find(
		([name]) => name.split("/").filter(Boolean).at(-1) === fileName,
	);
	return entry?.[1];
}

function parseConfigEntry<T>(bytes: Uint8Array, fileName: string): T {
	if (bytes.byteLength > MAX_CONFIG_SIZE) {
		throw new Error(`${fileName} 解压后超过 20 MB`);
	}
	try {
		return JSON.parse(strFromU8(bytes)) as T;
	} catch {
		throw new Error(`${fileName} 不是有效的 JSON`);
	}
}

export async function readConfigZip(file: File): Promise<{
	nav: NavConfig;
	websiteData: WebsiteData;
}> {
	if (file.size > MAX_ZIP_SIZE) {
		throw new Error("ZIP 文件不能超过 10 MB");
	}

	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(new Uint8Array(await file.arrayBuffer()));
	} catch {
		throw new Error("无法解压该文件，请选择有效的 ZIP 配置包");
	}

	const navBytes = findZipEntry(files, "nav.json");
	const websiteBytes = findZipEntry(files, "website.json");
	if (!navBytes || !websiteBytes) {
		throw new Error("ZIP 中必须同时包含 nav.json 和 website.json");
	}

	const nav = parseConfigEntry<NavConfig>(navBytes, "nav.json");
	const websiteData = parseConfigEntry<WebsiteData>(
		websiteBytes,
		"website.json",
	);
	if (!nav || typeof nav !== "object" || Array.isArray(nav)) {
		throw new Error("nav.json 的内容格式不正确");
	}
	if (!websiteData || !Array.isArray(websiteData.categories)) {
		throw new Error("website.json 缺少 categories 数组");
	}
	return { nav, websiteData };
}
