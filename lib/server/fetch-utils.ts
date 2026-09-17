import { lookup } from "node:dns/promises";
import net from "node:net";

const MAX_REDIRECTS = 5;

export interface PublicFetchOptions extends Omit<RequestInit, "redirect" | "signal"> {
	timeoutMs: number;
	maxBytes?: number;
}

function isPrivateIpv4(address: string): boolean {
	const parts = address.split(".").map((part) => Number.parseInt(part, 10));
	if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
		return true;
	}
	const [a, b] = parts;
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		a >= 224 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 198 && (b === 18 || b === 19))
	);
}

function isPrivateIpv6(address: string): boolean {
	const normalized = address.toLowerCase();
	if (
		normalized === "::" ||
		normalized === "::1" ||
		normalized.startsWith("fc") ||
		normalized.startsWith("fd") ||
		normalized.startsWith("fe80:")
	) {
		return true;
	}
	const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
	return mapped ? isPrivateIpv4(mapped[1]) : false;
}

function isPrivateAddress(address: string): boolean {
	const type = net.isIP(address);
	if (type === 4) return isPrivateIpv4(address);
	if (type === 6) return isPrivateIpv6(address);
	return true;
}

function isLocalHostname(hostname: string): boolean {
	const normalized = hostname.toLowerCase().replace(/\.$/, "");
	return normalized === "localhost" || normalized.endsWith(".localhost");
}

export function normalizeHttpUrl(raw: string): URL {
	const trimmed = raw.trim();
	const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	let parsed: URL;
	try {
		parsed = new URL(candidate);
	} catch {
		throw new Error("网址格式不正确，请输入完整网址");
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error("仅支持 http / https 地址");
	}
	if (!parsed.hostname || isLocalHostname(parsed.hostname)) {
		throw new Error("不支持访问本机地址");
	}
	return parsed;
}

export async function assertPublicHttpUrl(url: URL): Promise<void> {
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error("仅支持 http / https 地址");
	}
	if (isLocalHostname(url.hostname)) {
		throw new Error("不支持访问本机地址");
	}
	if (net.isIP(url.hostname)) {
		if (isPrivateAddress(url.hostname)) {
			throw new Error("不支持访问内网或保留地址");
		}
		return;
	}
	const addresses = await lookup(url.hostname, { all: true, verbatim: true });
	if (addresses.length === 0) {
		throw new Error("域名解析失败");
	}
	if (addresses.some((item) => isPrivateAddress(item.address))) {
		throw new Error("不支持访问解析到内网或保留地址的域名");
	}
}

export async function fetchPublicResource(
	rawUrl: string | URL,
	options: PublicFetchOptions,
): Promise<Response> {
	const { timeoutMs, maxBytes, ...fetchOptions } = options;
	void maxBytes;
	let current = rawUrl instanceof URL ? rawUrl : normalizeHttpUrl(rawUrl);
	for (let i = 0; i <= MAX_REDIRECTS; i++) {
		await assertPublicHttpUrl(current);
		const res = await fetch(current, {
			...fetchOptions,
			redirect: "manual",
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (![301, 302, 303, 307, 308].includes(res.status)) return res;
		const location = res.headers.get("location");
		if (!location) return res;
		try {
			current = new URL(location, current);
		} catch {
			throw new Error("跳转地址格式不正确");
		}
	}
	throw new Error("重定向次数过多");
}

export async function readResponseBytes(
	res: Response,
	maxBytes: number,
): Promise<Buffer> {
	const contentLength = Number.parseInt(res.headers.get("content-length") || "", 10);
	if (Number.isFinite(contentLength) && contentLength > maxBytes) {
		throw new Error(`响应内容过大（最大 ${formatBytes(maxBytes)}）`);
	}
	if (!res.body) {
		const bytes = Buffer.from(await res.arrayBuffer());
		if (bytes.length > maxBytes) {
			throw new Error(`响应内容过大（最大 ${formatBytes(maxBytes)}）`);
		}
		return bytes;
	}
	const reader = res.body.getReader();
	const chunks: Buffer[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maxBytes) {
			try {
				await reader.cancel();
			} catch {
				// ignore
			}
			throw new Error(`响应内容过大（最大 ${formatBytes(maxBytes)}）`);
		}
		chunks.push(Buffer.from(value));
	}
	return Buffer.concat(chunks, total);
}

function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)}MB`;
	if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
	return `${bytes}B`;
}
