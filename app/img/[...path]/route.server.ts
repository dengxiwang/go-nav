import { NextResponse } from "next/server";
import { joinImagePublicUrl, readImageHostConfig } from "@/lib/server/image-hosting";

async function redirectToImageHost(segs: string[]) {
	const clean = segs
		.map((seg) => seg.trim())
		.filter(Boolean)
		.join("/");
	if (
		!clean ||
		clean.split("/").some((part) => part === "." || part === "..")
	) {
		return NextResponse.json({ error: "forbidden" }, { status: 403 });
	}

	const config = await readImageHostConfig();
	if (!config.publicUrlPrefix) {
		return NextResponse.json({ error: "image host prefix not configured" }, { status: 404 });
	}

	const target = joinImagePublicUrl(config.publicUrlPrefix, `/img/${clean}`);
	const res = NextResponse.redirect(target, 307);
	res.headers.set("Cache-Control", "no-store");
	return res;
}

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path } = await params;
	return await redirectToImageHost(path);
}

export async function HEAD(
	_req: Request,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path } = await params;
	return await redirectToImageHost(path);
}
