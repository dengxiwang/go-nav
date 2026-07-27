import type { NavConfig, SiteAccessProtectionConfig } from "@/types";

/**
 * 前台不需要知道访问保护配置；尤其不能把 passwordHash 序列化进 RSC/HTML。
 */
export function toPublicNavConfig(nav: NavConfig): NavConfig {
	if (!nav.accessProtection) return nav;
	const publicNav = { ...nav };
	delete publicNav.accessProtection;
	return publicNav;
}

/**
 * 后台只接收是否已配置密码的状态，不接收密码哈希本身。
 */
export function toAdminNavConfig(nav: NavConfig): NavConfig {
	const accessProtection = nav.accessProtection;
	if (!accessProtection) return nav;

	return {
		...nav,
		accessProtection: {
			enabled: accessProtection.enabled === true,
			passwordConfigured: Boolean(accessProtection.passwordHash),
		},
	};
}

export function getSafeAccessProtectionConfig(
	config: SiteAccessProtectionConfig | undefined,
): Pick<SiteAccessProtectionConfig, "enabled" | "passwordConfigured"> {
	return {
		enabled: config?.enabled === true,
		passwordConfigured:
			config?.passwordConfigured === true || Boolean(config?.passwordHash),
	};
}
