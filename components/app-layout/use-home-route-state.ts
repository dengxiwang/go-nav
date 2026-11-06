"use client";

import {
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type SetStateAction,
} from "react";
import { useStore } from "jotai";
import type { NavCategory } from "@/types";
import {
	activeIdAtom,
	selectedSubcategoryIdsAtom,
	showSubcategoryTabsAtom,
} from "@/lib/store/site";
import {
	consumeHomeRestoreRequest,
	getCurrentPageRouteKey,
	readHomeSnapshot,
	readPageSnapshot,
	saveHomeSnapshot,
	savePageSnapshot,
	type HomeSnapshot,
} from "@/lib/client/home-restore";
import {
	collectSiteDetailEntries,
	findSiteDetailEntryBySlug,
	type SiteDetailEntry,
} from "@/lib/site-detail";

export function useHomeRouteState({
	pathname,
	categories,
	detailEnabled,
	detailSlugOverride,
	setActiveId,
}: {
	pathname: string;
	categories: NavCategory[];
	detailEnabled: boolean;
	detailSlugOverride?: string | null;
	setActiveId: (value: SetStateAction<string | undefined>) => void;
}) {
	const [disableRecentVisitsEntrance, setDisableRecentVisitsEntrance] =
		useState(false);
	const store = useStore();
	const [historyRevision, setHistoryRevision] = useState(0);
	const historyPendingRef = useRef(false);
	const restoringScrollRef = useRef(false);
	const previousDetailSlugRef = useRef<string | null>(null);
	const returnSnapshotRef = useRef<HomeSnapshot | null>(null);
	const initialRouteRef = useRef(true);

	const detailSlug = useMemo(() => {
		if (detailSlugOverride) return detailSlugOverride;
		if (!pathname.startsWith("/site/")) return null;
		const rawSlug = pathname.slice("/site/".length).split("/")[0];
		if (!rawSlug) return null;
		try {
			return decodeURIComponent(rawSlug);
		} catch {
			return rawSlug;
		}
	}, [detailSlugOverride, pathname]);

	const isDetailRoute = detailSlug !== null;
	const isHomeRoute = pathname === "/" && !isDetailRoute;
	const routeKey = detailSlug ? `site:${detailSlug}` : pathname;
	const detailEntries = useMemo(
		() =>
			detailEnabled && detailSlug ? collectSiteDetailEntries(categories) : [],
		[categories, detailEnabled, detailSlug],
	);
	const selectedEntry = useMemo<SiteDetailEntry | null>(() => {
		if (!detailEnabled || !detailSlug) return null;
		return findSiteDetailEntryBySlug(detailEntries, detailSlug);
	}, [detailEnabled, detailEntries, detailSlug]);

	useLayoutEffect(() => {
		const handlePopState = () => {
			// URL 已切换而 React 尚未提交时，不能把旧页面的位置写进新历史记录。
			historyPendingRef.current = true;
			setHistoryRevision((value) => value + 1);
		};
		window.addEventListener("popstate", handlePopState, true);
		return () => window.removeEventListener("popstate", handlePopState, true);
	}, []);

	useLayoutEffect(() => {
		if (getCurrentPageRouteKey() !== routeKey) return;
		const isInitialRoute = initialRouteRef.current;
		initialRouteRef.current = false;
		const returningFromDetail = previousDetailSlugRef.current !== null;
		previousDetailSlugRef.current = detailSlug;
		historyPendingRef.current = false;

		if (selectedEntry) {
			const savedHome = readHomeSnapshot();
			if (savedHome?.detailSlug === selectedEntry.slug) {
				returnSnapshotRef.current = savedHome;
			} else {
				// 直接打开或刷新详情页时，也能根据卡片所属分类找到正确标签。
				const path = findCategoryPath(categories, selectedEntry.categoryId);
				const root = path[0];
				const fallback: HomeSnapshot = {
					scrollY: 0,
					activeId: root?.id,
					anchorId: root && store.get(showSubcategoryTabsAtom)
						? root.id
						: selectedEntry.categoryId,
					selectedSubcategoryIds: root && path[1] ? { [root.id]: path[1].id } : {},
					detailSlug: selectedEntry.slug,
				};
				returnSnapshotRef.current = fallback;
				saveHomeSnapshot(fallback);
			}
		}

		const shouldRestoreHome = isHomeRoute
			? consumeHomeRestoreRequest() || returningFromDetail
			: false;
		const savedPage = readPageSnapshot(routeKey);
		const navigation = performance.getEntriesByType("navigation")[0] as
			| PerformanceNavigationTiming
			| undefined;
		// 首页整页刷新固定在顶部；只在首次挂载判断，避免影响之后的前进后退。
		const resetHomeOnReload = isInitialRoute && isHomeRoute && navigation?.type === "reload";
		const snapshot: HomeSnapshot | null = resetHomeOnReload
			? { ...savedPage, scrollY: 0, anchorId: undefined, activeId: categories[0]?.id }
			: savedPage
				?? (shouldRestoreHome ? readHomeSnapshot() ?? returnSnapshotRef.current : null)
				?? (isDetailRoute ? { scrollY: 0 } : null);
		if (!snapshot) return;

		if (isHomeRoute) {
			setDisableRecentVisitsEntrance(true);
			if (snapshot.selectedSubcategoryIds) {
				store.set(selectedSubcategoryIdsAtom, snapshot.selectedSubcategoryIds);
			}
			if (snapshot.activeId) setActiveId(snapshot.activeId);
		}

		restoringScrollRef.current = true;
		const restoreScroll = () => {
			// 恢复时不要使用 smooth：页面刚从详情页切回时，平滑滚动会和
			// React/Next 的布局提交以及近期访问区挂载同时发生，造成明显的
			// “追着页面滚”的感觉。内容还在补齐时只做瞬时、可重复的定位。
			const maxScrollY = Math.max(
				0,
				document.documentElement.scrollHeight - window.innerHeight,
			);
			const anchor = snapshot.anchorId ? document.getElementById(snapshot.anchorId) : null;
			const targetY = anchor
				? window.scrollY + anchor.getBoundingClientRect().top - 80
				: snapshot.scrollY;
			const nextScrollY = Math.min(Math.max(0, targetY), maxScrollY);
			window.scrollTo(0, nextScrollY);
			// 首页初始化可能先按尚未恢复的顶部位置选中首项，重定位时同步纠正。
			if (isHomeRoute && snapshot.activeId) setActiveId(snapshot.activeId);
		};

		let firstRestoreRaf = 0;
		let secondRestoreRaf = 0;
		let settleTimer: number | null = null;
		let resizeObserver: ResizeObserver | null = null;
		let mutationObserver: MutationObserver | null = null;
		restoreScroll();
		// 近期访问区从 localStorage 水合、图片完成布局等都可能发生在
		// 当前提交之后。最多补两帧；若页面高度仍在变化，则只在变化时
		// 瞬时重定位，直到短暂稳定后解除监听。
		firstRestoreRaf = requestAnimationFrame(() => {
			restoreScroll();
			secondRestoreRaf = requestAnimationFrame(restoreScroll);
		});

		const stopObservingLayout = () => {
			if (firstRestoreRaf) cancelAnimationFrame(firstRestoreRaf);
			if (secondRestoreRaf) cancelAnimationFrame(secondRestoreRaf);
			if (settleTimer !== null) window.clearTimeout(settleTimer);
			settleTimer = null;
			resizeObserver?.disconnect();
			resizeObserver = null;
			mutationObserver?.disconnect();
			mutationObserver = null;
			restoringScrollRef.current = false;
			if (!historyPendingRef.current && getCurrentPageRouteKey() === routeKey) {
				savePageSnapshot(routeKey, {
					scrollY: window.scrollY,
					activeId: store.get(activeIdAtom),
					selectedSubcategoryIds: store.get(selectedSubcategoryIdsAtom),
				});
			}
			for (const event of ["wheel", "touchstart", "pointerdown", "keydown"] as const) {
				window.removeEventListener(event, stopObservingLayout, true);
			}
		};
		for (const event of ["wheel", "touchstart", "pointerdown", "keydown"] as const) {
			window.addEventListener(event, stopObservingLayout, { capture: true, passive: true });
		}

		const scheduleStop = () => {
			if (settleTimer !== null) window.clearTimeout(settleTimer);
			settleTimer = window.setTimeout(stopObservingLayout, 180);
		};
		const handleLayoutChange = () => {
			restoreScroll();
			scheduleStop();
		};

		if (typeof ResizeObserver !== "undefined") {
			resizeObserver = new ResizeObserver(handleLayoutChange);
			resizeObserver.observe(document.documentElement);
			resizeObserver.observe(document.body);
		}
		if (typeof MutationObserver !== "undefined") {
			mutationObserver = new MutationObserver(handleLayoutChange);
			mutationObserver.observe(
				document.querySelector("main") ?? document.body,
				{
					attributes: true,
					childList: true,
					subtree: true,
				},
			);
		}
		scheduleStop();

		return stopObservingLayout;
	}, [categories, detailSlug, historyRevision, isDetailRoute, isHomeRoute, routeKey, selectedEntry, setActiveId, store]);

	useEffect(() => {
		let saveRaf = 0;
		let scrollSaveTimer: number | null = null;
		const savePosition = () => {
			saveRaf = 0;
			if (historyPendingRef.current || restoringScrollRef.current) return;
			if (getCurrentPageRouteKey() !== routeKey) return;
			savePageSnapshot(routeKey, {
				scrollY: window.scrollY,
				activeId: store.get(activeIdAtom),
				selectedSubcategoryIds: store.get(selectedSubcategoryIdsAtom),
			});
		};
		const scheduleSave = () => {
			if (!saveRaf) saveRaf = requestAnimationFrame(savePosition);
		};
		const flushPosition = () => {
			if (saveRaf) cancelAnimationFrame(saveRaf);
			if (scrollSaveTimer !== null) window.clearTimeout(scrollSaveTimer);
			scrollSaveTimer = null;
			savePosition();
		};
		const scheduleScrollSave = () => {
			if (scrollSaveTimer !== null) window.clearTimeout(scrollSaveTimer);
			// scrollend 不可用时的兜底，避免持续滚动期间频繁复制路由历史状态。
			scrollSaveTimer = window.setTimeout(flushPosition, 100);
		};
		window.addEventListener("scroll", scheduleScrollSave, { passive: true });
		window.addEventListener("scrollend", flushPosition);
		window.addEventListener("pagehide", flushPosition);
		const unsubscribeTabs = store.sub(selectedSubcategoryIdsAtom, scheduleSave);
		const unsubscribeCategory = store.sub(activeIdAtom, scheduleSave);
		scheduleSave();
		return () => {
			if (saveRaf) cancelAnimationFrame(saveRaf);
			if (scrollSaveTimer !== null) window.clearTimeout(scrollSaveTimer);
			window.removeEventListener("scroll", scheduleScrollSave);
			window.removeEventListener("scrollend", flushPosition);
			window.removeEventListener("pagehide", flushPosition);
			unsubscribeTabs();
			unsubscribeCategory();
		};
	}, [routeKey, store]);

	useEffect(() => {
		if (!isHomeRoute) {
			setDisableRecentVisitsEntrance(false);
		}
	}, [isHomeRoute]);

	return {
		disableRecentVisitsEntrance,
		isDetailRoute,
		selectedEntry,
	};
}

function findCategoryPath(categories: NavCategory[], targetId: string): NavCategory[] {
	for (const category of categories) {
		if (category.id === targetId) return [category];
		const children = findCategoryPath(category.children ?? [], targetId);
		if (children.length > 0) return [category, ...children];
	}
	return [];
}
