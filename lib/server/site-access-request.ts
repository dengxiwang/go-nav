import { cookies } from "next/headers";
import type { NavConfig } from "@/types";
import {
	SITE_ACCESS_COOKIE,
	verifySiteAccessSession,
} from "@/lib/server/auth";
import { readNav } from "@/lib/server/store";

export interface SiteAccessStatus {
	allowed: boolean;
	nav: NavConfig;
	passwordConfigured: boolean;
}

/**
 * 服务端请求级访问校验。
 *
 * 即使保护未开启也读取 cookies，确保 Server 模式的站点路由始终按请求执行，
 * 后台打开保护后无需重新构建即可立即生效。
 */
export async function readSiteAccessStatus(): Promise<SiteAccessStatus> {
	const cookieStore = await cookies();
	const nav = readNav();
	const accessProtection = nav.accessProtection;
	const passwordHash = accessProtection?.passwordHash;
	const passwordConfigured = Boolean(passwordHash);

	if (accessProtection?.enabled !== true) {
		return { allowed: true, nav, passwordConfigured };
	}

	return {
		allowed:
			Boolean(passwordHash) &&
			verifySiteAccessSession(
				cookieStore.get(SITE_ACCESS_COOKIE)?.value,
				passwordHash ?? "",
			),
		nav,
		passwordConfigured,
	};
}
