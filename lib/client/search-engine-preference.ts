const SEARCH_ENGINE_STORAGE_KEY = "go-nav-search-engine";

export function getStoredSearchEngineId(): string | null {
	if (typeof window === "undefined") return null;

	try {
		const value = window.localStorage.getItem(SEARCH_ENGINE_STORAGE_KEY)?.trim();
		return value || null;
	} catch {
		return null;
	}
}

export function setStoredSearchEngineId(id: string): void {
	if (typeof window === "undefined") return;

	try {
		window.localStorage.setItem(SEARCH_ENGINE_STORAGE_KEY, id);
	} catch {
		// 浏览器禁用本地存储时不影响搜索功能。
	}
}

export function clearStoredSearchEngineId(): void {
	if (typeof window === "undefined") return;

	try {
		window.localStorage.removeItem(SEARCH_ENGINE_STORAGE_KEY);
	} catch {
		// ignore
	}
}
