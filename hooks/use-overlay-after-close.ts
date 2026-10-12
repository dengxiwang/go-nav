"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

// 跟随 React Aria 的真实退出卸载，避免用固定延时提前清空正文。
export function useOverlayAfterClose(isOpen: boolean, onAfterClose: () => void) {
	const latest = useRef({ isOpen, onAfterClose });
	const node = useRef<HTMLElement | null>(null);

	useLayoutEffect(() => {
		latest.current = { isOpen, onAfterClose };
	}, [isOpen, onAfterClose]);

	return useCallback((element: HTMLElement | null) => {
		node.current = element;
		if (element) return;
		// Ref 解绑先于 layout effect；跳过 Strict Mode 检查和快速重开。
		queueMicrotask(() => {
			if (!node.current && !latest.current.isOpen) {
				latest.current.onAfterClose();
			}
		});
	}, []);
}
