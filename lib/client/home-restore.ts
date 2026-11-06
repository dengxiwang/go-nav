const HOME_SNAPSHOT_KEY = "go-nav:home-snapshot";
const HOME_RESTORE_FLAG_KEY = "go-nav:home-restore";
const PAGE_SNAPSHOT_KEY = "goNavPageSnapshot";

export interface HomeSnapshot {
	scrollY: number;
	activeId?: string;
	selectedSubcategoryIds?: Partial<Record<string, string>>;
	detailSlug?: string;
	anchorId?: string;
}

function parseSnapshot(value: unknown): HomeSnapshot | null {
	if (!value || typeof value !== "object") return null;
	const parsed = value as Partial<HomeSnapshot>;
	if (typeof parsed.scrollY !== "number" || !Number.isFinite(parsed.scrollY)) {
		return null;
	}
	const selectedSubcategoryIds: Partial<Record<string, string>> = {};
	if (parsed.selectedSubcategoryIds && typeof parsed.selectedSubcategoryIds === "object") {
		for (const [categoryId, tabId] of Object.entries(parsed.selectedSubcategoryIds)) {
			if (typeof tabId === "string") selectedSubcategoryIds[categoryId] = tabId;
		}
	}
	return {
		scrollY: Math.max(0, parsed.scrollY),
		activeId: typeof parsed.activeId === "string" ? parsed.activeId : undefined,
		selectedSubcategoryIds,
		detailSlug: typeof parsed.detailSlug === "string" ? parsed.detailSlug : undefined,
		anchorId: typeof parsed.anchorId === "string" ? parsed.anchorId : undefined,
	};
}

export function saveHomeSnapshot(snapshot: HomeSnapshot) {
	if (typeof window === "undefined") return;
	try {
		sessionStorage.setItem(HOME_SNAPSHOT_KEY, JSON.stringify(snapshot));
	} catch {
		// 浏览器禁用存储时仍允许正常导航。
	}
}

export function readHomeSnapshot(): HomeSnapshot | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = sessionStorage.getItem(HOME_SNAPSHOT_KEY);
		return raw ? parseSnapshot(JSON.parse(raw)) : null;
	} catch {
		return null;
	}
}

// 每条历史记录单独保存位置，合并原有 state，保留 Next.js 的路由信息。
export function savePageSnapshot(routeKey: string, snapshot: HomeSnapshot) {
	if (typeof window === "undefined") return;
	try {
		window.history.replaceState(
			{ ...window.history.state, [PAGE_SNAPSHOT_KEY]: { ...snapshot, routeKey } },
			"",
		);
	} catch {
		// 无法更新历史状态时交由浏览器处理滚动恢复。
	}
}

export function readPageSnapshot(routeKey: string): HomeSnapshot | null {
	if (typeof window === "undefined") return null;
	try {
		const snapshot = window.history.state?.[PAGE_SNAPSHOT_KEY];
		return snapshot?.routeKey === routeKey ? parseSnapshot(snapshot) : null;
	} catch {
		return null;
	}
}

export function getCurrentPageRouteKey(): string {
	const url = new URL(window.location.href);
	if (url.pathname === "/") {
		const slug = url.searchParams.get("site");
		return slug ? `site:${slug}` : "/";
	}
	const slug = url.pathname.startsWith("/site/")
		? url.pathname.slice("/site/".length).split("/")[0]
		: null;
	if (!slug) return url.pathname;
	try {
		return `site:${decodeURIComponent(slug)}`;
	} catch {
		return `site:${slug}`;
	}
}

export function requestHomeRestore() {
	if (typeof window === "undefined") return;
	try {
		sessionStorage.setItem(HOME_RESTORE_FLAG_KEY, "1");
	} catch {
		// 同一站点内的返回还会由路由切换识别。
	}
}

export function consumeHomeRestoreRequest(): boolean {
	if (typeof window === "undefined") return false;
	try {
		const flagged = sessionStorage.getItem(HOME_RESTORE_FLAG_KEY) === "1";
		if (flagged) sessionStorage.removeItem(HOME_RESTORE_FLAG_KEY);
		return flagged;
	} catch {
		return false;
	}
}
