"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAtomValue, useSetAtom } from "jotai";
import {
    activeIdAtom,
    categoriesAtom,
    showSubcategoryTabsAtom,
} from "@/lib/store/site";

/** IntersectionObserver 不可用时的滚动停止兜底延迟。 */
const SCROLL_END_DELAY = 140;
/** 跳转后若长时间持续滚动，保护态的最长保留时间 */
const JUMP_GUARD_MAX_MS = 3600;
/** 跳转滚动停止后多久解除保护 */
const JUMP_GUARD_END_DELAY = 220;
const ACTIVE_TOP_OFFSET = 120;
const SCROLL_SIGNAL_EVENTS = ["scroll", "resize"] as const;

// 模块级共享抑制标志：跳转后短时间内禁用滚动检测，避免把 activeId 冲回去
const jumpGuard = { scrolling: false };
let activeJumpGuardCleanup: (() => void) | null = null;

function listenWindowScrollSignals(listener: () => void) {
	if (typeof window === "undefined") return () => {};

	for (const eventName of SCROLL_SIGNAL_EVENTS) {
		window.addEventListener(eventName, listener, { passive: true });
	}

	return () => {
		for (const eventName of SCROLL_SIGNAL_EVENTS) {
			window.removeEventListener(eventName, listener);
		}
	};
}

/** 优先使用原生 scrollend；旧浏览器才在连续 scroll 上维护兜底定时器。 */
function listenWindowScrollEnd(listener: () => void) {
	if (typeof window === "undefined") return () => {};

	const supportsNativeScrollEnd =
		"onscrollend" in (window as unknown as Record<string, unknown>);
	if (supportsNativeScrollEnd) {
		window.addEventListener("scrollend", listener, { passive: true });
		return () => window.removeEventListener("scrollend", listener);
	}

	let timer: ReturnType<typeof setTimeout> | null = null;
	const schedule = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(listener, SCROLL_END_DELAY);
	};

	window.addEventListener("scroll", schedule, { passive: true });
	return () => {
		window.removeEventListener("scroll", schedule);
		if (timer) clearTimeout(timer);
	};
}

function startJumpGuard() {
	activeJumpGuardCleanup?.();
	jumpGuard.scrolling = true;

	if (typeof window === "undefined") {
		const cleanup = () => {
			if (activeJumpGuardCleanup !== cleanup) return;
			activeJumpGuardCleanup = null;
			jumpGuard.scrolling = false;
		};
		activeJumpGuardCleanup = cleanup;
		return cleanup;
	}

	let guardEndTimer: ReturnType<typeof setTimeout> | null = null;
	let guardMaxTimer: ReturnType<typeof setTimeout> | null = null;
	let cleanupSignals = () => {};

	const release = () => {
		const isCurrentGuard = activeJumpGuardCleanup === release;
		cleanupSignals();
		if (guardEndTimer) clearTimeout(guardEndTimer);
		if (guardMaxTimer) clearTimeout(guardMaxTimer);
		guardEndTimer = null;
		guardMaxTimer = null;
		if (!isCurrentGuard) return;
		activeJumpGuardCleanup = null;
		jumpGuard.scrolling = false;
	};

	const scheduleRelease = () => {
		if (guardEndTimer) clearTimeout(guardEndTimer);
		guardEndTimer = setTimeout(release, JUMP_GUARD_END_DELAY);
	};

	cleanupSignals = listenWindowScrollSignals(scheduleRelease);
	scheduleRelease();
	guardMaxTimer = setTimeout(release, JUMP_GUARD_MAX_MS);
	activeJumpGuardCleanup = release;

	return release;
}

/**
 * 绑定滚动监听并将当前活跃分类 id 写入 activeIdAtom。
 *
 * 订阅 categoriesAtom 以获得顶级分类列表，但不读取 activeIdAtom，
 * 因此滚动带来的 activeId 更新不会重渲染调用者（通常是 AppLayout）。
 */
export function useActiveSectionWriter() {
	const pathname = usePathname();
	const categories = useAtomValue(categoriesAtom);
	const showSubcategoryTabs = useAtomValue(showSubcategoryTabsAtom);
	const setActiveId = useSetAtom(activeIdAtom);

	const parentIds = useMemo(() => categories.map((c) => c.id), [categories]);

	const trackedIds = useMemo(() => {
		if (showSubcategoryTabs) {
			return parentIds;
		}
		const ids: string[] = [];
		const walk = (nodes: typeof categories) => {
			for (const node of nodes) {
				ids.push(node.id);
				if (node.children && node.children.length > 0) {
					walk(node.children);
				}
			}
		};
		walk(categories);
		return ids;
	}, [categories, parentIds, showSubcategoryTabs]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (pathname !== "/") return;
		if (trackedIds.length === 0) return;

		const topIdSet = new Set(trackedIds);
		let elements: HTMLElement[] = [];
		let bootstrapTimer: ReturnType<typeof setTimeout> | null = null;
		let clearHashTimer: ReturnType<typeof setTimeout> | null = null;
		let hashScrollRaf = 0;
		let trackingRaf = 0;
		let cleanupTracking = () => {};

		const collectElements = () => {
			const main = document.querySelector("main");
			if (!main) return [] as HTMLElement[];
			return Array.from(
				main.querySelectorAll<HTMLElement>(".category-anchor"),
			).filter((el) => topIdSet.has(el.id));
		};

		const resolveActiveByPosition = () => {
			if (elements.length === 0) return undefined;
			const currentScrollY = window.scrollY;
			const doc = document.documentElement;
			const nearBottom =
				currentScrollY + window.innerHeight >= doc.scrollHeight - 6;
			if (nearBottom && currentScrollY > ACTIVE_TOP_OFFSET) {
				return elements[elements.length - 1]?.id;
			}

			let current = elements[0]?.id;
			for (const el of elements) {
				const rect = el.getBoundingClientRect();
				if (rect.top <= ACTIVE_TOP_OFFSET) {
					current = el.id;
				} else {
					break;
				}
			}
			return current;
		};

		const writeActive = (next: string | undefined) => {
			if (!next || jumpGuard.scrolling) return;
			setActiveId((prev) => (prev === next ? prev : next));
		};

		const syncActiveByPosition = () => {
			writeActive(resolveActiveByPosition());
		};

		const startScrollEndTracking = () => {
			const cleanupScrollEnd = listenWindowScrollEnd(syncActiveByPosition);
			let resizeRaf = 0;
			const handleResize = () => {
				if (resizeRaf) return;
				resizeRaf = requestAnimationFrame(() => {
					resizeRaf = 0;
					syncActiveByPosition();
				});
			};
			window.addEventListener("resize", handleResize, { passive: true });
			return () => {
				cleanupScrollEnd();
				window.removeEventListener("resize", handleResize);
				if (resizeRaf) cancelAnimationFrame(resizeRaf);
			};
		};

		const applyInitialState = () => {
			const rawHash = window.location.hash.startsWith("#")
				? window.location.hash.slice(1)
				: "";
			let initialHashId = rawHash;
			try {
				initialHashId = decodeURIComponent(rawHash);
			} catch {
				initialHashId = rawHash;
			}

			// 首页刷新且位于顶部时，默认选中第一个父级分类。
			if (!rawHash && window.scrollY <= 8) {
				const firstParentId = parentIds[0];
				if (firstParentId) {
					setActiveId((prev) => (prev === firstParentId ? prev : firstParentId));
					return;
				}
			}

			const hasInitialHashTarget =
				initialHashId.length > 0 &&
				elements.some((el) => el.id === initialHashId);

			const clearUrlHash = () => {
				if (!window.location.hash) return;
				const cleanUrl = `${window.location.pathname}${window.location.search}`;
				window.history.replaceState(window.history.state, "", cleanUrl);
			};

			if (hasInitialHashTarget) {
				setActiveId((prev) => (prev === initialHashId ? prev : initialHashId));
				// 某些客户端跳转下 hash 定位时机会偏晚，主动补一次定位。
				hashScrollRaf = requestAnimationFrame(() => {
					elements
						.find((el) => el.id === initialHashId)
						?.scrollIntoView({ behavior: "auto", block: "start" });
				});
				// 使用 hash 定位完成后，清理 URL 中的 #锚点，避免刷新后持续携带。
				clearHashTimer = setTimeout(
					clearUrlHash,
					SCROLL_END_DELAY * 2 + 60,
				);
			} else {
				syncActiveByPosition();
				// 无效 hash 也清掉，保持地址整洁。
				if (rawHash) clearUrlHash();
			}
		};

		const bootstrap = () => {
			elements = collectElements();
			if (elements.length === 0) {
				bootstrapTimer = setTimeout(bootstrap, 80);
				return;
			}
			applyInitialState();
			trackingRaf = requestAnimationFrame(() => {
				cleanupTracking = startScrollEndTracking();
			});
		};
		bootstrap();

		return () => {
			cleanupTracking();
			if (bootstrapTimer) clearTimeout(bootstrapTimer);
			if (clearHashTimer) clearTimeout(clearHashTimer);
			if (hashScrollRaf) cancelAnimationFrame(hashScrollRaf);
			if (trackingRaf) cancelAnimationFrame(trackingRaf);
		};
	}, [parentIds, pathname, trackedIds, setActiveId]);
}

/**
 * 返回稳定的跳转函数：设置 activeId，并在跳转滚动完成前抑制滚动检测。
 * 供导航（侧边栏/抽屉）等调用。
 */
export function useJumpToSection() {
	const setActiveId = useSetAtom(activeIdAtom);
	const cleanupGuardRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		return () => {
			cleanupGuardRef.current?.();
		};
	}, []);

	return useCallback(
		(id: string) => {
			cleanupGuardRef.current?.();
			jumpGuard.scrolling = true;
			setActiveId(id || undefined);
			cleanupGuardRef.current = startJumpGuard();
		},
		[setActiveId],
	);
}
