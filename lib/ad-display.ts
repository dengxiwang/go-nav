import type { AdConfig, AdDisplayPosition, NavConfig } from "@/types";

export const DEFAULT_HOME_AD_ASPECT_RATIO = "16/9";
export const DEFAULT_SIDEBAR_AD_ASPECT_RATIO = "4/3";
export const DEFAULT_HOME_AD_VISIBLE_COUNT = 3;
export const DEFAULT_SIDEBAR_AD_VISIBLE_COUNT = 1;
export const DEFAULT_HOME_AD_GAP = 6;
export const DEFAULT_AD_AUTOPLAY_INTERVAL = 5000;
export const AD_AUTOPLAY_INTERVAL_OPTIONS = [3000, 5000, 8000, 10000] as const;

export function resolveAdDisplayPosition(
	value: unknown,
): AdDisplayPosition {
	return value === "home-top" ? "home-top" : "sidebar";
}

export function resolveAdPlacement(
	ad: Pick<AdConfig, "placement">,
	legacyPosition?: unknown,
): AdDisplayPosition {
	if (ad.placement === "home-top" || ad.placement === "sidebar") {
		return ad.placement;
	}
	return resolveAdDisplayPosition(legacyPosition);
}

export function resolveAdVisibleCount(
	value: unknown,
	fallback = DEFAULT_SIDEBAR_AD_VISIBLE_COUNT,
): number {
	const parsed = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(1, Math.round(parsed));
}

export function resolveAdsAutoplayInterval(value: unknown): number {
	const parsed = typeof value === "number" ? value : Number(value);
	return AD_AUTOPLAY_INTERVAL_OPTIONS.includes(
		parsed as (typeof AD_AUTOPLAY_INTERVAL_OPTIONS)[number],
	)
		? parsed
		: DEFAULT_AD_AUTOPLAY_INTERVAL;
}

export function resolveHomeAdsAutoplayInterval(nav: NavConfig): number {
	return resolveAdsAutoplayInterval(
		nav.homeAdsAutoplayInterval ?? nav.adsAutoplayInterval,
	);
}

export function resolveSidebarAdsAutoplayInterval(nav: NavConfig): number {
	return resolveAdsAutoplayInterval(
		nav.sidebarAdsAutoplayInterval ?? nav.adsAutoplayInterval,
	);
}

export function resolveHomeAdsEnabled(nav: NavConfig): boolean {
	return nav.homeAdsEnabled ?? nav.showAds ?? true;
}

export function resolveSidebarAdsEnabled(nav: NavConfig): boolean {
	return nav.sidebarAdsEnabled ?? nav.showAds ?? true;
}

export function resolveHomeAdsGap(value: unknown): number {
	const parsed = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(parsed)) return DEFAULT_HOME_AD_GAP;
	return Math.min(48, Math.max(0, Math.round(parsed)));
}

export function resolveAdAspectRatio(value: unknown, fallback: string): string {
	if (typeof value !== "string") return fallback;
	const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*[/:]\s*(\d+(?:\.\d+)?)$/);
	if (!match) return fallback;
	const width = Number(match[1]);
	const height = Number(match[2]);
	if (!(width > 0) || !(height > 0)) return fallback;
	return `${width}/${height}`;
}

export function resolveHomeAdsAspectRatio(nav: NavConfig): string {
	const legacyRatio =
		resolveAdDisplayPosition(nav.adsDisplayPosition) === "home-top"
			? nav.adsAspectRatio
			: undefined;
	return resolveAdAspectRatio(
		nav.homeAdsAspectRatio ?? legacyRatio,
		DEFAULT_HOME_AD_ASPECT_RATIO,
	);
}

export function resolveSidebarAdsAspectRatio(nav: NavConfig): string {
	const legacyRatio =
		resolveAdDisplayPosition(nav.adsDisplayPosition) === "sidebar"
			? nav.adsAspectRatio
			: undefined;
	return resolveAdAspectRatio(
		nav.sidebarAdsAspectRatio ?? legacyRatio,
		DEFAULT_SIDEBAR_AD_ASPECT_RATIO,
	);
}

export function resolveHomeAdsVisibleCount(nav: NavConfig): number {
	const legacyCount =
		resolveAdDisplayPosition(nav.adsDisplayPosition) === "home-top"
			? nav.adsVisibleCount
			: undefined;
	return resolveAdVisibleCount(
		nav.homeAdsVisibleCount ?? legacyCount,
		DEFAULT_HOME_AD_VISIBLE_COUNT,
	);
}
