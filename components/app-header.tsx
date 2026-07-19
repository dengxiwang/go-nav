"use client";
import { Button } from "@heroui/react";
import { memo } from "react";
import { getIconImageSrc } from "@/lib/icon";
import { SearchBar } from "./search-bar";
import type { HeaderBranding, HeaderSearchModel } from "./header.types";
import { BiMenuAltLeft, BiGlobe } from "react-icons/bi";

/**
 * 头部只负责布局与触发器展示。
 * 交互状态由 HeaderBundle 编排后，以 branding / search 两组模型传入，
 * 避免零散 props 横向蔓延。
 */
export const AppHeader = memo(function AppHeader({
	branding,
	onMenuOpen,
	search,
}: {
	branding: HeaderBranding;
	onMenuOpen: () => void;
	search?: HeaderSearchModel;
}) {
	const logoSrc = getIconImageSrc(branding.logo);
	const showSearch = !!search;
	const showEngineSelector = search?.config.showEngineSelector !== false;
	return (
		<header className="sticky top-0 z-30 flex h-16 items-center gap-3 px-4 sm:px-6 min-[860px]:grid min-[860px]:grid-cols-[minmax(0,1fr)_minmax(0,36rem)_minmax(0,1fr)] pointer-events-none *:pointer-events-auto">
			<div className="flex min-w-0 items-center gap-2 min-[860px]:col-start-1 min-[860px]:justify-self-start">
				<Button
					variant="tertiary"
					size="md"
					isIconOnly
					aria-label="打开菜单"
					aria-haspopup="dialog"
					className="shrink-0 touch-manipulation select-none shadow bg-(--primary-foreground) md:hidden"
					onPressStart={onMenuOpen}
				>
					<BiMenuAltLeft className="scale-150" />
				</Button>
				<div className="max-md:hidden flex min-w-0 items-center gap-2">
					{logoSrc ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={logoSrc}
							alt={branding.name}
							className="h-6 w-6 object-contain"
						/>
					) : null}
					<span className="text-base! max-w-32 truncate font-semibold">
						{branding.name}
					</span>
				</div>
			</div>
			{search && (
				<div className="ml-auto w-full flex-1 max-w-xl min-[860px]:col-start-2 min-[860px]:max-w-none">
					<SearchBar config={search.config} engineState={search.engineState} />
				</div>
			)}
			{showSearch && showEngineSelector && (
				<div className="flex max-[479px]:flex min-[480px]:hidden">
					<Button
						variant="tertiary"
						size="md"
						isIconOnly
						aria-label="切换搜索引擎"
						className="shrink-0 shadow bg-(--primary-foreground)"
						onPress={search?.onDrawerOpen}
					>
						<BiGlobe className="scale-150" />
					</Button>
				</div>
			)}
		</header>
	);
});
