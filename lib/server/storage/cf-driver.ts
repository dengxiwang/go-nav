/**
 * 基于 Cloudflare D1 + R2 的存储驱动。
 *
 * 通过 @opennextjs/cloudflare 的 getCloudflareContext() 获取绑定。
 * D1 存储 JSON/YAML 配置数据，R2 存储上传的图片文件。
 */
import type { CloudflareBindings, ConfigStore, FileStore, FileStoreEntry } from "./types";

// ─── 绑定获取 ────────────────────────────────────────────────

let _bindings: CloudflareBindings | null = null;
let _tableReady = false;

function getBindings(): CloudflareBindings {
	if (_bindings) return _bindings;

	// 同步初始化：绑定必须在首次调用前已就绪
	throw new Error("[cf-driver] 请先调用 await initCfBindings() 初始化 Cloudflare 绑定");
}

export async function initCfBindings(): Promise<CloudflareBindings> {
	if (_bindings) return _bindings;

	// @opennextjs/cloudflare 通过 getCloudflareContext 暴露绑定
	try {
		// 使用动态 import() 避免 TS 编译期解析
		const mod = await import("@opennextjs/cloudflare");
		const getCloudflareContext = mod.getCloudflareContext as unknown as (opts?: { async?: boolean }) => { env: Record<string, unknown> };
		const ctx = getCloudflareContext();
		const env = ctx.env as Record<string, unknown>;
		if (!env.DB || !env.UPLOADS_BUCKET) {
			throw new Error(
				"[cf-driver] 缺少 Cloudflare 绑定：请检查 wrangler.toml 中是否配置了 DB (D1) 和 UPLOADS_BUCKET (R2)",
			);
		}
		_bindings = {
			DB: env.DB as CloudflareBindings["DB"],
			UPLOADS_BUCKET: env.UPLOADS_BUCKET as CloudflareBindings["UPLOADS_BUCKET"],
		};
		return _bindings;
	} catch (e) {
		throw new Error(
			`[cf-driver] 获取 Cloudflare 绑定失败：${(e as Error).message}。确保 STORAGE_DRIVER=cloudflare 仅在 Cloudflare Pages 环境下使用。`,
		);
	}
}

// ─── D1 表初始化 ─────────────────────────────────────────────

async function ensureTableReady(db: CloudflareBindings["DB"]): Promise<void> {
	if (_tableReady) return;
	await db.exec(`
		CREATE TABLE IF NOT EXISTS config_store (
			key TEXT PRIMARY KEY,
			content TEXT NOT NULL,
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);
	_tableReady = true;
}

// ─── ConfigStore (D1) ────────────────────────────────────────

export function createCfConfigStore(): ConfigStore {
	return {
		async read(key: string): Promise<string | null> {
			const db = getBindings().DB;
			await ensureTableReady(db);
			const row = await db
				.prepare("SELECT content FROM config_store WHERE key = ?")
				.bind(key)
				.first<{ content: string }>();
			return row?.content ?? null;
		},

		async write(key: string, content: string): Promise<void> {
			const db = getBindings().DB;
			await ensureTableReady(db);
			await db
				.prepare(
					"INSERT OR REPLACE INTO config_store (key, content, updated_at) VALUES (?, ?, datetime('now'))",
				)
				.bind(key, content)
				.run();
		},

		async exists(key: string): Promise<boolean> {
			const db = getBindings().DB;
			await ensureTableReady(db);
			const row = await db
				.prepare("SELECT 1 FROM config_store WHERE key = ? LIMIT 1")
				.bind(key)
				.first();
			return row !== null;
		},

		async list(): Promise<string[]> {
			const db = getBindings().DB;
			await ensureTableReady(db);
			const { results } = await db
				.prepare("SELECT key FROM config_store")
				.all<{ key: string }>();
			return results.map((r) => r.key);
		},

		async delete(key: string): Promise<void> {
			const db = getBindings().DB;
			await ensureTableReady(db);
			await db.prepare("DELETE FROM config_store WHERE key = ?").bind(key).run();
		},
	};
}

// ─── FileStore (R2) ──────────────────────────────────────────

export function createCfFileStore(): FileStore {
	return {
		async read(key: string): Promise<FileStoreEntry | null> {
			const bucket = getBindings().UPLOADS_BUCKET;
			const obj = await bucket.get(key);
			if (!obj) return null;
			// 通过 Response 包装读取 ReadableStream 为 ArrayBuffer
			const response = new Response(obj.body as unknown as BodyInit);
			const arrayBuffer = await response.arrayBuffer();
			const data = new Uint8Array(arrayBuffer);
			// R2 对象的 uploaded 属性可作为 mtime
			const mtime = obj.uploaded
				? new Date(obj.uploaded as string).getTime()
				: Date.now();
			return { data, size: obj.size, mtime };
		},

		async write(key: string, data: Uint8Array): Promise<void> {
			const bucket = getBindings().UPLOADS_BUCKET;
			await bucket.put(key, data);
		},

		async delete(key: string): Promise<void> {
			const bucket = getBindings().UPLOADS_BUCKET;
			await bucket.delete(key);
		},

		async exists(key: string): Promise<boolean> {
			const bucket = getBindings().UPLOADS_BUCKET;
			const head = await bucket.head(key);
			return head !== null;
		},

		async list(): Promise<string[]> {
			const bucket = getBindings().UPLOADS_BUCKET;
			const keys: string[] = [];
			let cursor: string | undefined;
			do {
				const result = await bucket.list({ cursor, limit: 1000 });
				for (const obj of result.objects) {
					keys.push(obj.key);
				}
				cursor = result.truncated ? result.cursor : undefined;
			} while (cursor);
			return keys;
		},
	};
}

/** 重置绑定缓存（测试用） */
export function resetCfBindings() {
	_bindings = null;
	_tableReady = false;
}
