"use client";

import {
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type SetStateAction,
} from "react";
import type { NavCategory } from "@/types";
import {
	clearHomeSnapshot,
	consumeHomeRestoreRequest,
	readHomeSnapshot,
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
	const restoredFromDetailRef = useRef(false);

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
	const detailEntries = useMemo(
		() => collectSiteDetailEntries(categories),
		[categories],
	);
	const selectedEntry = useMemo<SiteDetailEntry | null>(() => {
		if (!detailEnabled || !detailSlug) return null;
		return findSiteDetailEntryBySlug(detailEntries, detailSlug);
	}, [detailEnabled, detailEntries, detailSlug]);

	useLayoutEffect(() => {
		if (!isDetailRoute) return;
		window.scrollTo({ top: 0, behavior: "auto" });
	}, [isDetailRoute, pathname]);

	useLayoutEffect(() => {
		if (!isHomeRoute) return;

		const shouldRestore = consumeHomeRestoreRequest();
		if (!shouldRestore) {
			restoredFromDetailRef.current = false;
			return;
		}

		restoredFromDetailRef.current = true;
		setDisableRecentVisitsEntrance(true);

		const snapshot = readHomeSnapshot();
		if (!snapshot) return;

		if (snapshot.activeId) {
			setActiveId(snapshot.activeId);
		}

		const restoreScroll = () => {
			// 恢复时不要使用 smooth：页面刚从详情页切回时，平滑滚动会和
			// React/Next 的布局提交以及近期访问区挂载同时发生，造成明显的
			// “追着页面滚”的感觉。内容还在补齐时只做瞬时、可重复的定位。
			const maxScrollY = Math.max(
				0,
				document.documentElement.scrollHeight - window.innerHeight,
			);
			const nextScrollY = Math.min(Math.max(0, snapshot.scrollY), maxScrollY);
			window.scrollTo(0, nextScrollY);
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
			if (settleTimer !== null) window.clearTimeout(settleTimer);
			settleTimer = null;
			resizeObserver?.disconnect();
			resizeObserver = null;
			mutationObserver?.disconnect();
			mutationObserver = null;
		};

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
		clearHomeSnapshot();

		return () => {
			if (firstRestoreRaf) cancelAnimationFrame(firstRestoreRaf);
			if (secondRestoreRaf) cancelAnimationFrame(secondRestoreRaf);
			stopObservingLayout();
		};
	}, [isHomeRoute, setActiveId]);

	useLayoutEffect(() => {
		if (!isHomeRoute) return;
		if (restoredFromDetailRef.current) return;

		const navEntry = performance.getEntriesByType("navigation")[0] as
			| PerformanceNavigationTiming
			| undefined;
		if (navEntry?.type !== "reload") return;

		window.scrollTo({ top: 0, behavior: "auto" });
		const firstParentId = categories[0]?.id;
		if (firstParentId) {
			setActiveId((prev) => (prev === firstParentId ? prev : firstParentId));
		}
	}, [categories, isHomeRoute, setActiveId]);

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
