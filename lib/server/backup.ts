import fs from "node:fs";
import path from "node:path";
import { isExecutablePlugin } from "@/lib/plugin-config";
import {
	resolveNavFilePathForWrite,
	resolveWebsiteFilePathForWrite,
	UPLOADS_DIR,
} from "@/lib/server/paths";
import {
	readSubmissionData,
	writeSubmissionData,
} from "@/lib/server/submissions";
import {
	parseStructuredContent,
	readNav,
	readWebsiteData,
	stringifyStructuredContent,
	writeNav,
	writeWebsiteData,
} from "@/lib/server/store";
import { createZip, parseZip, type ZipEntry } from "@/lib/server/zip";
import type { NavConfig, SubmissionData, WebsiteData } from "@/types";

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".svg",
	".ico",
]);
const WEBSITE_BACKUP_IMPORT_FILES = ["website.yaml", "website.yml", "website.json"] as const;
const NAV_BACKUP_IMPORT_FILES = ["nav.yaml", "nav.yml", "nav.json"] as const;
const MAX_BACKUP_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_BACKUP_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
export interface BackupRestoreResult {
	website: boolean;
	nav: boolean;
	uploads: number;
	submissions?: number;
	disabledJsPlugins: number;
}

function safeUploadName(name: string): string | null {
	const base = path.basename(name);
	if (!base || base.startsWith(".")) return null;
	if (base !== name) return null;
	if (!ALLOWED_UPLOAD_EXTENSIONS.has(path.extname(base).toLowerCase())) return null;
	return base;
}

function readAllUploads(): ZipEntry[] {
	if (!fs.existsSync(UPLOADS_DIR)) return [];
	const entries: ZipEntry[] = [];
	for (const file of fs.readdirSync(UPLOADS_DIR)) {
		const full = path.join(UPLOADS_DIR, file);
		try {
			const stat = fs.statSync(full);
			if (!stat.isFile()) continue;
			entries.push({
				name: `uploads/${file}`,
				data: fs.readFileSync(full),
			});
		} catch {
			// 单个素材读取失败不应中断整包导出。
		}
	}
	return entries;
}

export function createDataBackupZip(): Buffer {
	const websiteData = readWebsiteData();
	const nav = readNav();
	const submissionData = readSubmissionData();
	const meta = {
		version: "2.0",
		scope: "go-nav-data",
		exportTime: new Date().toISOString(),
	};
	const entries: ZipEntry[] = [
		{
			name: "meta.json",
			data: Buffer.from(JSON.stringify(meta, null, 2), "utf8"),
		},
		createStructuredBackupEntry("website", websiteData),
		createStructuredBackupEntry("nav", nav),
		{
			name: "submissions.json",
			data: Buffer.from(JSON.stringify(submissionData, null, 2), "utf8"),
		},
		...readAllUploads(),
	];
	return createZip(entries);
}

export function createBackupFileName(date = new Date()): string {
	return `go-nav-backup-${date.toISOString().slice(0, 10)}.zip`;
}

export function restoreDataBackupZip(buf: Buffer): BackupRestoreResult {
	let entries: ZipEntry[];
	try {
		entries = parseZip(buf, {
			maxEntries: 4096,
			maxEntryUncompressedBytes: MAX_BACKUP_ENTRY_BYTES,
			maxTotalUncompressedBytes: MAX_BACKUP_UNCOMPRESSED_BYTES,
		});
	} catch (e) {
		throw new Error(`解析 zip 失败：${(e as Error).message}`);
	}

	let websiteData: WebsiteData | null = null;
	let nav: NavConfig | null = null;
	let submissionData: SubmissionData | null = null;
	let disabledJsPlugins = 0;
	const uploads: { name: string; data: Buffer }[] = [];
	const websiteEntry = findBackupEntry(entries, WEBSITE_BACKUP_IMPORT_FILES);
	const navEntry = findBackupEntry(entries, NAV_BACKUP_IMPORT_FILES);
	const submissionsEntry = entries.find(
		(entry) => entry.name === "submissions.json",
	);

	for (const ent of entries) {
		if (ent.name.startsWith("uploads/")) {
			const safe = safeUploadName(ent.name.slice("uploads/".length));
			if (safe) uploads.push({ name: safe, data: ent.data });
		}
	}

	if (websiteEntry) {
		try {
			websiteData = parseStructuredContent<WebsiteData>(
				websiteEntry.data.toString("utf8"),
			);
		} catch {
			throw new Error(`${websiteEntry.name} 解析失败`);
		}
	}
	if (navEntry) {
		try {
			nav = parseStructuredContent<NavConfig>(navEntry.data.toString("utf8"));
			const result = disableJsPluginsForRestore(nav);
			nav = result.nav;
			disabledJsPlugins = result.disabled;
		} catch {
			throw new Error(`${navEntry.name} 解析失败`);
		}
	}
	if (submissionsEntry) {
		try {
			const parsed = JSON.parse(
				submissionsEntry.data.toString("utf8"),
			) as SubmissionData;
			if (!Array.isArray(parsed.submissions)) throw new Error("invalid list");
			submissionData = parsed;
		} catch {
			throw new Error("submissions.json 解析失败");
		}
	}

	if (!websiteData && !nav && !submissionData && uploads.length === 0) {
		throw new Error(
			"压缩包中未找到 website/nav/submissions 配置文件或 uploads/",
		);
	}

	if (websiteData) writeWebsiteData(websiteData);
	if (nav) writeNav(nav);
	if (submissionData) writeSubmissionData(submissionData);
	if (uploads.length > 0) {
		fs.mkdirSync(UPLOADS_DIR, { recursive: true });
		for (const u of uploads) {
			fs.writeFileSync(path.join(UPLOADS_DIR, u.name), u.data);
		}
	}

	return {
		website: !!websiteData,
		nav: !!nav,
		uploads: uploads.length,
		submissions: submissionData?.submissions.length ?? 0,
		disabledJsPlugins,
	};
}

function createStructuredBackupEntry(
	baseName: "website" | "nav",
	value: unknown,
): ZipEntry {
	const targetFile =
		baseName === "website"
			? resolveWebsiteFilePathForWrite()
			: resolveNavFilePathForWrite();
	const name = path.basename(targetFile);
	return {
		name,
		data: Buffer.from(
			name.endsWith(".json")
				? JSON.stringify(value, null, 2)
				: stringifyStructuredContent(value, `${baseName}.yaml`),
			"utf8",
		),
	};
}

export function disableJsPluginsForRestore(nav: NavConfig): {
	nav: NavConfig;
	disabled: number;
} {
	const plugins = nav.plugins ?? [];
	let disabled = 0;
	const nextPlugins = plugins.map((plugin) => {
		if (!isExecutablePlugin(plugin) || !plugin.enabled) return plugin;
		disabled += 1;
		return { ...plugin, enabled: false };
	});
	return disabled > 0
		? { nav: { ...nav, plugins: nextPlugins }, disabled }
		: { nav, disabled: 0 };
}

function findBackupEntry(
	entries: ZipEntry[],
	names: readonly string[],
): ZipEntry | null {
	for (const name of names) {
		const matched = entries.find((entry) => entry.name === name);
		if (matched) return matched;
	}
	return null;
}
