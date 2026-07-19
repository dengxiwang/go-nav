import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths";
import { getConfigStore, getStorageDriverName } from "./storage/driver";

/** 登录 cookie 名称 */
export const SESSION_COOKIE = "nav_session";

/** 会话有效期（毫秒）：7 天 */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let fileSecret: string | null | undefined;

function readFileSecret(secretFile: string): string | null {
	try {
		const value = fs.readFileSync(secretFile, "utf-8").trim();
		return value.length >= 32 ? value : null;
	} catch {
		return null;
	}
}

function createPersistentSecret(secretFile: string): string {
	const secret = crypto.randomBytes(32).toString("hex");
	fs.mkdirSync(path.dirname(secretFile), { recursive: true });
	try {
		fs.writeFileSync(secretFile, `${secret}\n`, {
			encoding: "utf-8",
			flag: "wx",
			mode: 0o600,
		});
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === "EEXIST") {
			const existing = readFileSecret(secretFile);
			if (existing) return existing;
		}
		throw e;
	}
	return secret;
}

async function getSecretAsync(): Promise<string> {
	if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;

	if (getStorageDriverName() === "cloudflare") {
		// Cloudflare 下通过 ConfigStore 存取 session secret
		const store = getConfigStore();
		const existing = await store.read(".session-secret");
		if (existing && existing.trim().length >= 32) return existing.trim();
		// 首次启动，自动生成并保存
		const secret = crypto.randomBytes(32).toString("hex");
		await store.write(".session-secret", secret);
		return secret;
	}

	// fs driver：使用文件系统
	if (fileSecret !== undefined) return fileSecret ?? createPersistentSecret(path.join(DATA_DIR, ".session-secret"));
	const secretFile = path.join(DATA_DIR, ".session-secret");
	const secret = readFileSecret(secretFile) ?? createPersistentSecret(secretFile);
	fileSecret = secret;
	return secret;
}

function toBase64Url(buf: Buffer): string {
	return buf
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

function fromBase64Url(s: string): Buffer {
	const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
	return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

async function hmacAsync(data: string): Promise<string> {
	const secret = await getSecretAsync();
	return toBase64Url(crypto.createHmac("sha256", secret).update(data).digest());
}

/**
 * 生成 session token。结构：`base64url(json).base64url(hmac)`
 */
export async function createSession(username: string): Promise<string> {
	const payload = JSON.stringify({ u: username, e: Date.now() + SESSION_TTL_MS });
	const payloadB64 = toBase64Url(Buffer.from(payload));
	const mac = await hmacAsync(payloadB64);
	return `${payloadB64}.${mac}`;
}

/**
 * 校验 session token，失败返回 null。
 */
export async function verifySession(token?: string | null): Promise<{ u: string; e: number } | null> {
	if (!token) return null;
	const [payloadB64, mac] = token.split(".");
	if (!payloadB64 || !mac) return null;
	const expected = await hmacAsync(payloadB64);
	// 防止时序攻击
	const a = Buffer.from(mac);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
	try {
		const payload = JSON.parse(fromBase64Url(payloadB64).toString("utf-8")) as {
			u: string;
			e: number;
		};
		if (typeof payload.e !== "number" || payload.e < Date.now()) return null;
		return payload;
	} catch {
		return null;
	}
}

/**
 * 校验登录用户名/密码（来自 .env）。
 */
export function checkCredentials(username: string, password: string): boolean {
	const U = process.env.ADMIN_USER || "admin";
	const P = process.env.ADMIN_PASS || "admin123";
	// 定长比较
	const a = Buffer.from(`${username}:${password}`);
	const b = Buffer.from(`${U}:${P}`);
	if (a.length !== b.length) return false;
	return crypto.timingSafeEqual(a, b);
}
