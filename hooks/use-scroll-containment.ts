"use client";

import { useCallback, type RefObject } from "react";

/**
 * 只有真正溢出的纵向视口才阻止滚动传到父级，包括到顶、到底时。
 * 保留浏览器原生滚动，不拦截 wheel / touch，也不影响横向滚动。
 */
export function useScrollContainment<T extends HTMLElement>(
	forwardedRef?: RefObject<T | null>,
) {
	return useCallback((element: T | null) => {
		if (forwardedRef) forwardedRef.current = element;
		if (!element) return;

		const previousBehavior = element.style.overscrollBehaviorY;
		let frame = 0;
		const observedChildren = new Set<Element>();
		const measure = () => {
			frame = 0;
			const behavior = element.clientHeight > 0
				&& element.scrollHeight > element.clientHeight
				? "none"
				: "auto";
			if (element.style.overscrollBehaviorY !== behavior) {
				element.style.overscrollBehaviorY = behavior;
			}
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		const resizeObserver = new ResizeObserver(schedule);
		const observeChildren = () => {
			for (const child of observedChildren) {
				if (child.parentElement !== element) {
					resizeObserver.unobserve(child);
					observedChildren.delete(child);
				}
			}
			for (const child of element.children) {
				if (!observedChildren.has(child)) {
					resizeObserver.observe(child);
					observedChildren.add(child);
				}
			}
		};
		const mutationObserver = new MutationObserver((records) => {
			if (records.some((record) => record.type === "childList" && record.target === element)) {
				observeChildren();
			}
			// 不因自身写入的边界样式再触发一次测量。
			if (records.some((record) => record.target !== element || record.attributeName !== "style")) {
				schedule();
			}
		});
		resizeObserver.observe(element);
		observeChildren();
		mutationObserver.observe(element, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: ["class", "style", "hidden"],
		});
		measure();

		return () => {
			cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			mutationObserver.disconnect();
			element.style.overscrollBehaviorY = previousBehavior;
			if (forwardedRef) forwardedRef.current = null;
		};
	}, [forwardedRef]);
}
