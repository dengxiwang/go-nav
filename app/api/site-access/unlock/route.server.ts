import { NextResponse } from "next/server";
import {
	SITE_ACCESS_COOKIE,
	SITE_ACCESS_TTL_MS,
	createSiteAccessSession,
} from "@/lib/server/auth";
import { readNav } from "@/lib/server/store";
import { verifySiteAccessPassword } from "@/lib/server/site-access";

const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;
const failures = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: Request) {
	const key = getRequestKey(req);
	const retryAfter = getRetryAfter(key);
	if (retryAfter > 0) {
		return NextResponse.json(
			{ error: "尝试次数过多，请稍后再试" },
			{
				status: 429,
				headers: { "Retry-After": String(retryAfter) },
			},
		);
	}

	let password = "";
	try {
		const body = (await req.json()) as { password?: string };
		password = typeof body.password === "string" ? body.password : "";
	} catch {
		return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
	}

	const accessProtection = readNav().accessProtection;
	if (accessProtection?.enabled !== true) {
		failures.delete(key);
		const response = NextResponse.json({ ok: true });
		clearAccessCookie(response);
		return response;
	}

	const passwordHash = accessProtection.passwordHash;
	if (!passwordHash) {
		return NextResponse.json(
			{ error: "站点访问保护尚未配置完成，请联系管理员" },
			{ status: 503 },
		);
	}

	if (
		password.length === 0 ||
		password.length > 128 ||
		!verifySiteAccessPassword(password, passwordHash)
	) {
		recordFailure(key);
		return NextResponse.json({ error: "访问密码错误" }, { status: 401 });
	}

	failures.delete(key);
	const response = NextResponse.json({ ok: true });
	response.cookies.set(
		SITE_ACCESS_COOKIE,
		createSiteAccessSession(passwordHash),
		{
			httpOnly: true,
			sameSite: "lax",
			secure: isSecureRequest(req),
			path: "/",
			maxAge: Math.floor(SITE_ACCESS_TTL_MS / 1000),
		},
	);
	return response;
}

function getRequestKey(req: Request): string {
	const forwarded = req.headers.get("x-forwarded-for");
	return (
		forwarded?.split(",")[0]?.trim() ||
		req.headers.get("x-real-ip")?.trim() ||
		"unknown"
	);
}

function getRetryAfter(key: string): number {
	const entry = failures.get(key);
	if (!entry) return 0;
	if (entry.resetAt <= Date.now()) {
		failures.delete(key);
		return 0;
	}
	if (entry.count < MAX_FAILURES) return 0;
	return Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000));
}

function recordFailure(key: string) {
	const now = Date.now();
	const entry = failures.get(key);
	if (!entry || entry.resetAt <= now) {
		failures.set(key, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
		return;
	}
	entry.count += 1;
}

function isSecureRequest(req: Request): boolean {
	const forwardedProto = req.headers
		.get("x-forwarded-proto")
		?.split(",")[0]
		?.trim()
		.toLowerCase();
	if (forwardedProto) return forwardedProto === "https";

	const forwarded = req.headers.get("forwarded")?.toLowerCase();
	if (forwarded?.includes("proto=https")) return true;

	try {
		return new URL(req.url).protocol === "https:";
	} catch {
		return false;
	}
}

function clearAccessCookie(response: NextResponse) {
	response.cookies.set(SITE_ACCESS_COOKIE, "", {
		path: "/",
		maxAge: 0,
	});
}
