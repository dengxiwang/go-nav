/**
 * 基于本地文件系统的存储驱动。
 * 包装现有的 paths.ts / store.ts 中的 fs 操作，保持行为完全一致。
 */
import fs from "node:fs";
import path from "node:path";
import type { ConfigStore, FileStore, FileStoreEntry } from "./types";
import {
	DATA_DIR,
	getStructuredFileFormat,
	listStructuredDataFileCandidates,
	resolveStructuredDataReadOrder,
	UPLOADS_DIR,
} from "../paths";

// ─── 配置 key ↔ 文件路径映射 ────────────────────────────────

function resolveConfigFilePath(key: string): string | null {
	const extensions = [".json", ".yaml", ".yml"] as const;
	// 按照写入格式优先的顺序查找
	for (const ext of resolveStructuredDataReadOrder()) {
		const file = path.join(DATA_DIR, `${key}${ext}`);
		if (fs.existsSync(file)) return file;
	}
	return null;
}

function resolveConfigFileForWrite(key: string): string {
	const ext = getStructuredFileFormat(key) === "yaml" ? ".yaml" : ".json";
	// 对于已知的 key，使用对应的扩展名
	const writeExt = getWriteExtension(key);
	return path.join(DATA_DIR, `${key}${writeExt}`);
}

function getWriteExtension(key: string): string {
	// 写入格式由 DATA_FILE_FORMAT 环境变量控制
	const format = (process.env.DATA_FILE_FORMAT || "").trim().toLowerCase();
	if (format === "yaml" || format === "yml") return ".yaml";
	return ".json";
}

// ─── ConfigStore (fs) ────────────────────────────────────────

export function createFsConfigStore(): ConfigStore {
	return {
		async read(key: string): Promise<string | null> {
			const file = resolveConfigFilePath(key);
			if (!file) return null;
			try {
				return fs.readFileSync(file, "utf-8");
			} catch {
				return null;
			}
		},

		async write(key: string, content: string): Promise<void> {
			const target = resolveConfigFileForWrite(key);
			fs.mkdirSync(path.dirname(target), { recursive: true });
			// 原子写入：先写临时文件再 rename
			const tmp = `${target}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
			fs.writeFileSync(tmp, content, "utf-8");
			fs.renameSync(tmp, target);
			// 清理同 key 的旧格式文件
			pruneLegacyFiles(key, target);
		},

		async exists(key: string): Promise<boolean> {
			return resolveConfigFilePath(key) !== null;
		},

		async list(): Promise<string[]> {
			try {
				const entries = fs.readdirSync(DATA_DIR);
				const keys = new Set<string>();
				for (const entry of entries) {
					const ext = path.extname(entry);
					if ([".json", ".yaml", ".yml"].includes(ext)) {
						keys.add(path.basename(entry, ext));
					}
				}
				return Array.from(keys);
			} catch {
				return [];
			}
		},

		async delete(key: string): Promise<void> {
			for (const ext of [".json", ".yaml", ".yml"]) {
				const file = path.join(DATA_DIR, `${key}${ext}`);
				try {
					if (fs.existsSync(file)) fs.unlinkSync(file);
				} catch {
					// 忽略
				}
			}
		},
	};
}

function pruneLegacyFiles(baseName: string, keepFile: string) {
	for (const ext of [".json", ".yaml", ".yml"]) {
		const file = path.join(DATA_DIR, `${baseName}${ext}`);
		if (file === keepFile) continue;
		try {
			if (fs.existsSync(file)) fs.unlinkSync(file);
		} catch {
			// 某些挂载目录可能不允许删除
		}
	}
}

// ─── FileStore (fs) ──────────────────────────────────────────

export function createFsFileStore(): FileStore {
	return {
		async read(key: string): Promise<FileStoreEntry | null> {
			const filePath = path.join(UPLOADS_DIR, key);
			try {
				const stat = fs.statSync(filePath);
				if (!stat.isFile()) return null;
				const data = fs.readFileSync(filePath);
				return {
					data: new Uint8Array(data),
					size: stat.size,
					mtime: stat.mtimeMs,
				};
			} catch {
				return null;
			}
		},

		async write(key: string, data: Uint8Array): Promise<void> {
			fs.mkdirSync(UPLOADS_DIR, { recursive: true });
			const filePath = path.join(UPLOADS_DIR, key);
			fs.writeFileSync(filePath, data);
		},

		async delete(key: string): Promise<void> {
			const filePath = path.join(UPLOADS_DIR, key);
			try {
				if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
			} catch {
				// 忽略
			}
		},

		async exists(key: string): Promise<boolean> {
			const filePath = path.join(UPLOADS_DIR, key);
			try {
				return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
			} catch {
				return false;
			}
		},

		async list(): Promise<string[]> {
			try {
				if (!fs.existsSync(UPLOADS_DIR)) return [];
				return fs
					.readdirSync(UPLOADS_DIR)
					.filter((name: string) => {
						if (name.startsWith(".")) return false;
						try {
							return fs.statSync(path.join(UPLOADS_DIR, name)).isFile();
						} catch {
							return false;
						}
					});
			} catch {
				return [];
			}
		},
	};
}
