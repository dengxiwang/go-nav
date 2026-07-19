"use client";

import { useOverlayState, type Key } from "@heroui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { AppHeader } from "./app-header";
import { CategorySidebar } from "./category-sidebar";
import { EngineDrawer } from "./engine-drawer";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import type { HeaderBranding, HeaderSearchModel } from "./header.types";
import {
	categoriesAtom,
	flatSitesAtom,
	layoutAtom,
	navLogoAtom,
	navNameAtom,
	searchConfigAtom,
	submissionConfigAtom,
} from "@/lib/store/site";
import { useJumpToSection } from "@/hooks/use-active-section";

/**
 * 头部聚合组件：AppHeader + 移动端导航抽屉 + 搜索引擎抽屉。
 *
 * Jotai 订阅版：
 * - 顶层只订阅 name/logo；搜索关闭时不再构建 flatSites 搜索索引。
 * - 分类列表只在移动抽屉打开后订阅，降低 Header 的常驻客户端负担。
 * - 抽屉状态和断点关闭逻辑都收敛在 Header 相关小组件内，
 *   避免 AppLayout 被这类瞬时交互牵着一起重渲染。
 */
export function HeaderBundle({ showSearch }: { showSearch: boolean }) {
	const name = useAtomValue(navNameAtom);
	const logo = useAtomValue(navLogoAtom);
	const onNavigate = useJumpToSection();
	const menuDrawerState = useResponsiveDrawerState(768);
	const branding = useMemo<HeaderBranding>(
		() => ({ name, logo }),
		[name, logo],
	);

	const openMenu = useCallback(() => menuDrawerState.open(), [menuDrawerState]);

	// 移动端导航点击后除了跳转还要关掉抽屉
	const handleDrawerNavigate = useCallback(
		(id: string) => {
			onNavigate(id);
			menuDrawerState.close();
		},
		[menuDrawerState, onNavigate],
	);

	const header = showSearch ? (
		<SearchHeader branding={branding} onMenuOpen={openMenu} />
	) : (
		<AppHeader branding={branding} onMenuOpen={openMenu} />
	);

	return (
		<>
			{header}

			<MobileNavDrawerHost
				open={menuDrawerState.isOpen}
				onOpenChange={menuDrawerState.setOpen}
				onItemClick={handleDrawerNavigate}
				title={name}
				logo={logo}
			/>
		</>
	);
}

function MobileNavDrawerHost({
	open,
	onOpenChange,
	onItemClick,
	title,
	logo,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onItemClick: (id: string) => void;
	title: string;
	logo: string;
}) {
	return (
		<MobileNavDrawer
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			logo={logo}
		>
			{open ? (
				<MobileNavDrawerContent onItemClick={onItemClick} />
			) : null}
		</MobileNavDrawer>
	);
}

function MobileNavDrawerContent({
	onItemClick,
}: {
	onItemClick: (id: string) => void;
}) {
	const categories = useAtomValue(categoriesAtom);
	const submission = useAtomValue(submissionConfigAtom);

	return (
		<CategorySidebar
			categories={categories}
			onItemClick={onItemClick}
			showSubmissionAction={
				submission.enabled && submission.showSidebarButton
			}
		/>
	);
}

function SearchHeader({
	branding,
	onMenuOpen,
}: {
	branding: HeaderBranding;
	onMenuOpen: () => void;
}) {
	const search = useAtomValue(searchConfigAtom);
	const flatSites = useAtomValue(flatSitesAtom);
	const layout = useAtomValue(layoutAtom);
	const engineDrawerState = useResponsiveDrawerState(480);

	const engineOptions = useMemo(() => {
		const base = search.enableLocalSearch
			? [{ id: "local" }, ...search.engines]
			: search.engines.filter((engine) => engine.id !== "local");
		return base.map((engine) => engine.id);
	}, [search.enableLocalSearch, search.engines]);
	const resolvedDefaultEngine = useMemo(
		() =>
			engineOptions.includes(search.defaultEngine)
				? search.defaultEngine
				: (engineOptions[0] ?? null),
		[engineOptions, search.defaultEngine],
	);
	const [engineId, setEngineId] = useState<Key | null>(resolvedDefaultEngine);

	useEffect(() => {
		if (engineId !== null && engineOptions.includes(String(engineId))) return;
		setEngineId(resolvedDefaultEngine);
	}, [engineId, engineOptions, resolvedDefaultEngine]);

	const openEngineDrawer = useCallback(
		() => engineDrawerState.open(),
		[engineDrawerState],
	);
	const searchModel = useMemo<HeaderSearchModel>(
		() => ({
			config: {
				engines: search.engines,
				defaultEngine: resolvedDefaultEngine ?? "",
				enableLocal: search.enableLocalSearch,
				enableSuggestion: search.enableSuggestion !== false,
				enableTabFocus: search.enableTabFocus !== false,
				placeholder: search.placeholder,
				sites: flatSites,
				showEngineSelector: search.showEngineSelector !== false,
				layout,
			},
			engineState: {
				value: engineId,
				onChange: setEngineId,
			},
			onDrawerOpen: openEngineDrawer,
		}),
		[
			engineId,
			flatSites,
			layout,
			openEngineDrawer,
			resolvedDefaultEngine,
			search.enableLocalSearch,
			search.enableSuggestion,
			search.enableTabFocus,
			search.engines,
			search.placeholder,
			search.showEngineSelector,
		],
	);

	return (
		<>
			<AppHeader branding={branding} onMenuOpen={onMenuOpen} search={searchModel} />

			<EngineDrawer
				open={engineDrawerState.isOpen}
				onOpenChange={engineDrawerState.setOpen}
				engines={search.engines}
				enableLocal={search.enableLocalSearch}
				currentEngine={engineId}
				onEngineChange={setEngineId}
			/>
		</>
	);
}

function useResponsiveDrawerState(closeAtMinWidth: number) {
	const drawerState = useOverlayState();

	useEffect(() => {
		const media = window.matchMedia(`(min-width: ${closeAtMinWidth}px)`);
		const onChange = (event: MediaQueryListEvent) => {
			if (event.matches) drawerState.close();
		};

		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, [closeAtMinWidth, drawerState]);

	return drawerState;
}
