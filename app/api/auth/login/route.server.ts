import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_MS, checkCredentials, createSession } from "@/lib/server/auth";

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

/**
 * 登录接口：POST { username, password } → 设置 httpOnly cookie
 */
export async function POST(req: Request) {
	let username = "";
	let password = "";
	try {
		const body = (await req.json()) as { username?: string; password?: string };
		username = body.username ?? "";
		password = body.password ?? "";
	} catch {
		return NextResponse.json({ error: "invalid body" }, { status: 400 });
	}

	if (!checkCredentials(username, password)) {
		return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
	}

	const token = await createSession(username);
	const res = NextResponse.json({ ok: true });
	res.cookies.set(SESSION_COOKIE, token, {
		httpOnly: true,
		sameSite: "lax",
		secure: isSecureRequest(req),
		path: "/",
		maxAge: Math.floor(SESSION_TTL_MS / 1000),
	});
	return res;
}
