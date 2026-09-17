"use client";

import { useEffect } from "react";

/**
 * 全局焦点环守卫。
 *
 * 浏览器/组件库的 :focus-visible 在鼠标点击、弹窗开合与程序化焦点还原等场景
 * 可能误报键盘焦点，导致按钮、菜单上出现蓝色焦点环。这里在 <html> 上维护
 * data-focus-ring：
 * - "off"：非键盘导航交互（鼠标点击、字母/空格/回车/Esc 等键按下）时置位，
 *   配合 globals.css 中的规则抑制焦点环；
 * - "on"：Tab / 方向键等键盘导航键按下时置位，恢复焦点环。
 * 输入框等可编辑控件不参与抑制，保留自身焦点样式。
 */
const NAVIGATION_KEYS = new Set([
	"Tab",
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"Home",
	"End",
	"PageUp",
	"PageDown",
]);

export function FocusRingGuard() {
	useEffect(() => {
		const root = document.documentElement;

		const enableRing = () => {
			root.dataset.focusRing = "on";
		};
		const disableRing = () => {
			root.dataset.focusRing = "off";
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (NAVIGATION_KEYS.has(event.key)) enableRing();
			else disableRing();
		};
		const onPointerDown = () => disableRing();

		window.addEventListener("keydown", onKeyDown, true);
		window.addEventListener("pointerdown", onPointerDown, true);
		return () => {
			window.removeEventListener("keydown", onKeyDown, true);
			window.removeEventListener("pointerdown", onPointerDown, true);
		};
	}, []);

	return null;
}
