import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths";

/** 登录 cookie 名称 */
export const SESSION_COOKIE = "nav_session";

/** 会话有效期（毫秒）：7 天 */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 前台访问授权 cookie 名称 */
export const SITE_ACCESS_COOKIE = "nav_site_access";

/** 前台访问授权有效期（毫秒）：7 天 */
export const SITE_ACCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

function getSecret(): string {
	if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
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

function hmac(data: string): string {
	return toBase64Url(crypto.createHmac("sha256", getSecret()).update(data).digest());
}

/**
 * 生成 session token。结构：`base64url(json).base64url(hmac)`
 */
export function createSession(username: string): string {
	const payload = JSON.stringify({
		k: "admin",
		u: username,
		e: Date.now() + SESSION_TTL_MS,
	});
	const payloadB64 = toBase64Url(Buffer.from(payload));
	const mac = hmac(payloadB64);
	return `${payloadB64}.${mac}`;
}

/**
 * 校验 session token，失败返回 null。
 */
export function verifySession(token?: string | null): { u: string; e: number } | null {
	if (!token) return null;
	const [payloadB64, mac] = token.split(".");
	if (!payloadB64 || !mac) return null;
	const expected = hmac(payloadB64);
	// 防止时序攻击
	const a = Buffer.from(mac);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
	try {
		const payload = JSON.parse(fromBase64Url(payloadB64).toString("utf-8")) as {
			k?: string;
			u: string;
			e: number;
		};
		if (
			(payload.k !== undefined && payload.k !== "admin") ||
			typeof payload.u !== "string" ||
			payload.u.length === 0 ||
			typeof payload.e !== "number" ||
			payload.e < Date.now()
		) {
			return null;
		}
		return payload;
	} catch {
		return null;
	}
}

function siteAccessFingerprint(passwordHash: string): string {
	return crypto
		.createHash("sha256")
		.update(passwordHash)
		.digest("base64url")
		.slice(0, 24);
}

/**
 * 生成前台访问授权。令牌绑定当前密码哈希，修改密码后旧授权会立即失效。
 */
export function createSiteAccessSession(passwordHash: string): string {
	const payload = JSON.stringify({
		k: "site-access",
		v: siteAccessFingerprint(passwordHash),
		e: Date.now() + SITE_ACCESS_TTL_MS,
	});
	const payloadB64 = toBase64Url(Buffer.from(payload));
	return `${payloadB64}.${hmac(payloadB64)}`;
}

export function verifySiteAccessSession(
	token: string | null | undefined,
	passwordHash: string,
): boolean {
	if (!token || !passwordHash) return false;
	const [payloadB64, mac] = token.split(".");
	if (!payloadB64 || !mac) return false;

	const expectedMac = hmac(payloadB64);
	const actualMacBuffer = Buffer.from(mac);
	const expectedMacBuffer = Buffer.from(expectedMac);
	if (
		actualMacBuffer.length !== expectedMacBuffer.length ||
		!crypto.timingSafeEqual(actualMacBuffer, expectedMacBuffer)
	) {
		return false;
	}

	try {
		const payload = JSON.parse(
			fromBase64Url(payloadB64).toString("utf-8"),
		) as {
			k?: string;
			v?: string;
			e?: number;
		};
		return (
			payload.k === "site-access" &&
			payload.v === siteAccessFingerprint(passwordHash) &&
			typeof payload.e === "number" &&
			payload.e >= Date.now()
		);
	} catch {
		return false;
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
