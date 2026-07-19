/**
 * 存储抽象接口定义。
 *
 * 通过 STORAGE_DRIVER 环境变量切换实现：
 *  - "fs"（默认）：基于本地文件系统，兼容现有 Docker / Node.js 部署。
 *  - "cloudflare"：基于 Cloudflare D1 + R2，用于 Cloudflare Pages 部署。
 */

// ─── 配置数据存取 ────────────────────────────────────────────
// 用于 nav / website / image-host / sync 等 JSON/YAML 配置。
// key 为逻辑名（如 "nav"、"website"），不含扩展名。

export interface ConfigStore {
	/** 读取配置原始字符串，不存在返回 null */
	read(key: string): Promise<string | null>;
	/** 写入配置字符串 */
	write(key: string, content: string): Promise<void>;
	/** 检查配置是否存在 */
	exists(key: string): Promise<boolean>;
	/** 列出所有配置 key */
	list(): Promise<string[]>;
	/** 删除指定配置 */
	delete(key: string): Promise<void>;
}

// ─── 文件存取 ────────────────────────────────────────────────
// 用于 uploads 目录下的图片等二进制文件。
// key 为文件名（如 "icon-p3a5on.svg"），不含目录前缀。

export interface FileStoreEntry {
	data: Uint8Array;
	size: number;
	mtime: number; // Unix 毫秒时间戳
}

export interface FileStore {
	/** 读取文件，不存在返回 null */
	read(key: string): Promise<FileStoreEntry | null>;
	/** 写入文件 */
	write(key: string, data: Uint8Array): Promise<void>;
	/** 删除文件 */
	delete(key: string): Promise<void>;
	/** 检查文件是否存在 */
	exists(key: string): Promise<boolean>;
	/** 列出所有文件名 */
	list(): Promise<string[]>;
}

// ─── Cloudflare 绑定类型 ─────────────────────────────────────
// 避免直接依赖 @cloudflare/workers-types，使用结构类型。

export interface CloudflareBindings {
	DB: {
		prepare(query: string): {
			bind(...values: unknown[]): {
				first<T = unknown>(colName?: string): Promise<T | null>;
				all<T = unknown>(): Promise<{ results: T[] }>;
				run(): Promise<unknown>;
			};
			first<T = unknown>(colName?: string): Promise<T | null>;
			all<T = unknown>(): Promise<{ results: T[] }>;
			run(): Promise<unknown>;
		};
		batch<T = unknown>(statements: ReturnType<CloudflareBindings["DB"]["prepare"]>[]): Promise<T[]>;
		exec(query: string): Promise<unknown>;
	};
	UPLOADS_BUCKET: {
		get(key: string): Promise<{
			body: ReadableStream<Uint8Array>;
			size: number;
			etag: string;
			httpEtag: string;
			httpMetadata: Record<string, string>;
			uploaded: string | Date;
		} | null>;
		put(key: string, value: Uint8Array | ReadableStream<Uint8Array> | string, options?: {
			httpMetadata?: Record<string, string>;
			customMetadata?: Record<string, string>;
		}): Promise<string>;
		delete(key: string): Promise<void>;
		head(key: string): Promise<{ size: number; etag: string } | null>;
		list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
			objects: Array<{ key: string; size: number; uploaded: Date; etag: string }>;
			truncated: boolean;
			cursor?: string;
		}>;
	};
}
