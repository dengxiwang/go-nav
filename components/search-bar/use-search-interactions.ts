"use client";

import type { Key } from "@heroui/react";
import {
	useEffect,
	useRef,
	useState,
	type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { SearchEngine } from "@/types";

export function useSearchInteractions({
	enableTabFocus,
	engineId,
	engineOptions,
	setEngineId,
	keyboardItemCount,
	query,
	onActivateSearchIndex,
}: {
	enableTabFocus: boolean;
	engineId: Key | null;
	engineOptions: SearchEngine[];
	setEngineId: (id: Key | null) => void;
	keyboardItemCount: number;
	query: string;
	onActivateSearchIndex: () => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const inputWrapRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);

	useEffect(() => {
		if (!query.trim() || keyboardItemCount === 0) {
			setActiveIndex(-1);
			return;
		}

		setActiveIndex(0);
	}, [keyboardItemCount, query]);

	useEffect(() => {
		if (activeIndex < 0 || !isOpen) return;

		const element = containerRef.current?.querySelector<HTMLElement>(
			`[data-keyboard-index="${activeIndex}"]`,
		);
		element?.scrollIntoView({ block: "nearest" });
	}, [activeIndex, isOpen]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				event.stopImmediatePropagation();
				onActivateSearchIndex();
				inputRef.current?.focus();
				return;
			}

			if (event.key !== "Tab") return;

			const activeElement = document.activeElement;
			const isSearchInput = activeElement === inputRef.current;

			if (isSearchInput) {
				event.preventDefault();
				event.stopImmediatePropagation();
				const currentIndex = engineOptions.findIndex(
					(option) => option.id === engineId,
				);
				const nextIndex = event.shiftKey
					? currentIndex > 0
						? currentIndex - 1
						: engineOptions.length - 1
					: (currentIndex + 1) % engineOptions.length;
				setEngineId(engineOptions[nextIndex]?.id ?? null);
				return;
			}

			const isSearchArea = inputWrapRef.current?.contains(activeElement) ?? false;
			if (isSearchArea || !enableTabFocus) return;

			// 仅在页面没有交互焦点时，把 Tab 作为“快速聚焦搜索框”。
			// 表单、弹窗、链接或按钮已获得焦点时必须保留浏览器原生 Tab 顺序。
			if (
				activeElement !== document.body &&
				activeElement !== document.documentElement
			) {
				return;
			}

			event.preventDefault();
			event.stopImmediatePropagation();
			onActivateSearchIndex();
			inputRef.current?.focus();
			requestAnimationFrame(() => {
				if (document.activeElement !== inputRef.current) {
					inputRef.current?.focus();
				}
			});
		};

		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [
		enableTabFocus,
		engineId,
		engineOptions,
		onActivateSearchIndex,
		setEngineId,
	]);

	const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
		if (event.nativeEvent.isComposing) return;

		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			setIsOpen(false);
			setActiveIndex(-1);
			event.currentTarget.blur();
			return;
		}

		if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
		if (!query.trim() || keyboardItemCount === 0) return;

		event.preventDefault();
		setIsOpen(true);
		setActiveIndex((current) => {
			if (current < 0) {
				return event.key === "ArrowDown" ? 0 : keyboardItemCount - 1;
			}

			return event.key === "ArrowDown"
				? (current + 1) % keyboardItemCount
				: (current - 1 + keyboardItemCount) % keyboardItemCount;
		});
	};

	const handleInputKeyDownCapture = (
		event: ReactKeyboardEvent<HTMLInputElement>,
	) => {
		if (event.nativeEvent.isComposing) return;
		if (event.key !== "Escape") return;

		event.stopPropagation();
		(
			event.nativeEvent as KeyboardEvent & {
				stopImmediatePropagation?: () => void;
			}
		).stopImmediatePropagation?.();
		setIsOpen(false);
		setActiveIndex(-1);
		requestAnimationFrame(() => {
			inputRef.current?.blur();
		});
	};

	return {
		activeIndex,
		containerRef,
		inputRef,
		inputWrapRef,
		isOpen,
		setIsOpen,
		handleInputKeyDown,
		handleInputKeyDownCapture,
		activateSearch: () => {
			setIsOpen(true);
			onActivateSearchIndex();
		},
	};
}
