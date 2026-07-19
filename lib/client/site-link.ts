"use client";

import { useSyncExternalStore } from "react";
import type { LayoutConfig } from "@/types";
import { withAuthorBaiduTracking } from "@/lib/external-url";

export type SiteLinkMode = "intranet" | "public";

const MODE_STORAGE_KEY = "go-nav-site-link-mode";
const MODE_EVENT_KEY = "go-nav-site-link-mode-update";
const REACHABLE_CACHE_TTL = 60_000;
const REACHABLE_TIMEOUT_MS = 1_500;

const reachabilityCache = new Map<string, { value: boolean; expiresAt: number }>();
const siteLinkModeListeners = new Set<(mode: SiteLinkMode) => void>();
let cleanupSiteLinkModeEvents: (() => void) | null = null;

export interface SiteLinkLike {
	url: string;
	intranetUrl?: string;
}

function isHttpUrl(url: string) {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

function sanitizeUrl(url: string | undefined): string {
	const value = (url ?? "").trim();
	if (!value) return "";
	if (
		value.startsWith("/") ||
		value.startsWith("./") ||
		value.startsWith("../") ||
		value.startsWith("#")
	) {
		return value;
	}
	if (/^[a-z][a-z\d+\-.]*:/i.test(value)) {
		if (/^localhost:\d+$/i.test(value) || /^127\.0\.0\.1:\d+$/i.test(value)) {
			return `http://${value}`;
		}
		return withAuthorBaiduTracking(value);
	}
	if (value.startsWith("//")) return withAuthorBaiduTracking(`https:${value}`);
	if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(value)) {
		return `http://${value}`;
	}
	if (/^[^\s/]+\.[^\s/]+/.test(value)) {
		return withAuthorBaiduTracking(`https://${value}`);
	}
	return value;
}

function hasIntranetUrl(site: SiteLinkLike): boolean {
	return sanitizeUrl(site.intranetUrl).length > 0;
}

export function getStoredSiteLinkMode(): SiteLinkMode {
	if (typeof window === "undefined") return "public";
	try {
		const raw = localStorage.getItem(MODE_STORAGE_KEY);
		return raw === "intranet" ? "intranet" : "public";
	} catch {
		return "public";
	}
}

export function setStoredSiteLinkMode(mode: SiteLinkMode) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(MODE_STORAGE_KEY, mode);
	} catch {
		// ignore
	}
	window.dispatchEvent(new CustomEvent<SiteLinkMode>(MODE_EVENT_KEY, { detail: mode }));
}

export function subscribeSiteLinkMode(listener: (mode: SiteLinkMode) => void) {
	if (typeof window === "undefined") return () => undefined;

	siteLinkModeListeners.add(listener);
	if (!cleanupSiteLinkModeEvents) {
		const notify = (mode: SiteLinkMode) => {
			for (const currentListener of siteLinkModeListeners) {
				currentListener(mode);
			}
		};

		const handleCustomEvent = (event: Event) => {
			const mode = (event as CustomEvent<SiteLinkMode>).detail;
			if (mode === "intranet" || mode === "public") {
				notify(mode);
			}
		};

		const handleStorage = (event: StorageEvent) => {
			if (event.key !== MODE_STORAGE_KEY) return;
			notify(getStoredSiteLinkMode());
		};

		window.addEventListener(MODE_EVENT_KEY, handleCustomEvent);
		window.addEventListener("storage", handleStorage);
		cleanupSiteLinkModeEvents = () => {
			window.removeEventListener(MODE_EVENT_KEY, handleCustomEvent);
			window.removeEventListener("storage", handleStorage);
			cleanupSiteLinkModeEvents = null;
		};
	}

	return () => {
		siteLinkModeListeners.delete(listener);
		if (siteLinkModeListeners.size === 0) cleanupSiteLinkModeEvents?.();
	};
}

function subscribeSiteLinkModeStore(onStoreChange: () => void) {
	return subscribeSiteLinkMode(() => onStoreChange());
}

export function useSiteLinkMode(): SiteLinkMode {
	return useSyncExternalStore(
		subscribeSiteLinkModeStore,
		getStoredSiteLinkMode,
		() => "public",
	);
}

async function isUrlReachable(url: string): Promise<boolean> {
	const controller = new AbortController();
	const timer = window.setTimeout(() => controller.abort(), REACHABLE_TIMEOUT_MS);
	try {
		await fetch(url, {
			method: "HEAD",
			mode: "no-cors",
			cache: "no-store",
			signal: controller.signal,
		});
		return true;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}

async function isUrlReachableWithGet(url: string): Promise<boolean> {
	const controller = new AbortController();
	const timer = window.setTimeout(() => controller.abort(), REACHABLE_TIMEOUT_MS);
	try {
		await fetch(url, {
			method: "GET",
			mode: "no-cors",
			cache: "no-store",
			signal: controller.signal,
		});
		return true;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}

function readReachabilityCache(url: string): boolean | null {
	const now = Date.now();
	const cached = reachabilityCache.get(url);
	if (cached && cached.expiresAt > now) {
		return cached.value;
	}
	return null;
}

function writeReachabilityCache(url: string, value: boolean) {
	reachabilityCache.set(url, {
		value,
		expiresAt: Date.now() + REACHABLE_CACHE_TTL,
	});
}

async function probeIntranetReachability(intranetUrl: string): Promise<boolean> {
	const cached = readReachabilityCache(intranetUrl);
	if (cached !== null) return cached;

	let reachable = false;
	try {
		reachable = await isUrlReachable(intranetUrl);
		if (!reachable) {
			reachable = await isUrlReachableWithGet(intranetUrl);
		}
	} catch {
		reachable = false;
	}
	writeReachabilityCache(intranetUrl, reachable);
	return reachable;
}

function resolveManualModeUrl(site: SiteLinkLike): string {
	const publicUrl = sanitizeUrl(site.url);
	const intranetUrl = sanitizeUrl(site.intranetUrl);
	if (!intranetUrl) return publicUrl;
	return getStoredSiteLinkMode() === "intranet" ? intranetUrl : publicUrl;
}

export function getPreferredSiteHref(
	site: SiteLinkLike,
	layout?: Pick<LayoutConfig, "autoUseIntranet">,
	modeOverride?: SiteLinkMode,
): string {
	const publicUrl = sanitizeUrl(site.url);
	const intranetUrl = sanitizeUrl(site.intranetUrl);
	if (!intranetUrl) return publicUrl;

	if (layout?.autoUseIntranet !== true) {
		if (modeOverride) {
			return modeOverride === "intranet" ? intranetUrl : publicUrl;
		}
		return resolveManualModeUrl(site);
	}

	const cached = readReachabilityCache(intranetUrl);
	return cached === true ? intranetUrl : publicUrl;
}

export async function resolvePreferredSiteUrl(
	site: SiteLinkLike,
	layout?: Pick<LayoutConfig, "autoUseIntranet">,
): Promise<string> {
	const publicUrl = sanitizeUrl(site.url);
	const intranetUrl = sanitizeUrl(site.intranetUrl);
	if (!intranetUrl) return publicUrl;

	const autoUseIntranet = layout?.autoUseIntranet === true;
	if (!autoUseIntranet) {
		return resolveManualModeUrl(site);
	}

	if (!isHttpUrl(intranetUrl)) {
		return publicUrl;
	}

	const reachable = await probeIntranetReachability(intranetUrl);
	return reachable ? intranetUrl : publicUrl;
}

function resolvePreferredSiteUrlSync(
	site: SiteLinkLike,
	layout?: Pick<LayoutConfig, "autoUseIntranet">,
): string | null {
	const publicUrl = sanitizeUrl(site.url);
	const intranetUrl = sanitizeUrl(site.intranetUrl);
	if (!intranetUrl) return publicUrl;
	if (layout?.autoUseIntranet === true) return null;
	return resolveManualModeUrl(site);
}

export async function openSiteWithPreference(
	site: SiteLinkLike,
	layout?: Pick<LayoutConfig, "linkTarget" | "autoUseIntranet">,
	options?: { forceNewTab?: boolean },
) {
	if (typeof window === "undefined") return;

	const publicUrl = sanitizeUrl(site.url);
	if (!publicUrl) return;

	const target =
		options?.forceNewTab || layout?.linkTarget !== "current" ? "new" : "current";
	const syncUrl = resolvePreferredSiteUrlSync(site, layout);
	if (syncUrl) {
		if (target === "current") {
			window.location.href = syncUrl;
		} else {
			window.open(syncUrl, "_blank", "noopener,noreferrer");
		}
		return;
	}

	const shouldOpenBlankFirst = target === "new" && hasIntranetUrl(site);

	let pendingWindow: Window | null = null;
	if (shouldOpenBlankFirst) {
		pendingWindow = window.open("about:blank", "_blank");
	}

	const finalUrl = await resolvePreferredSiteUrl(site, {
		autoUseIntranet: layout?.autoUseIntranet,
	});

	if (target === "current") {
		window.location.href = finalUrl;
		return;
	}

	if (pendingWindow && !pendingWindow.closed) {
		pendingWindow.location.href = finalUrl;
		return;
	}

	window.open(finalUrl, "_blank", "noopener,noreferrer");
}

export function getSiteLinkModeLabel(mode: SiteLinkMode): "内网" | "公网" {
	return mode === "intranet" ? "内网" : "公网";
}
