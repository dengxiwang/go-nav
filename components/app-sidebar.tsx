"use client";

import { memo } from "react";
import { useAtomValue } from "jotai";
import { CategorySidebar } from "./category-sidebar";
import { AdBanner } from "./ad-banner";
import type { AdConfig, CardStyle } from "@/types";
import { categoriesAtom } from "@/lib/store/site";
import { useJumpToSection } from "@/hooks/use-active-section";

/**
 * 侧边栏容器（Jotai 订阅版）。
 *
 * 订阅 categoriesAtom + 使用 useJumpToSection，layout / ads 仍作为 props 接收。
 * 由于不订阅 activeIdAtom，滚动导致 activeId 变化时本组件跳过重渲染，
 * 只有内部的 CategorySidebar 重渲染。
 */
export const AppSidebar = memo(function AppSidebar({
	width = "224px",
	ads = [],
	showAds = true,
	adsAspectRatio,
	autoplayInterval,
	cardStyle,
	showSubmissionAction = false,
}: {
	width?: string;
	ads?: AdConfig[];
	showAds?: boolean;
	adsAspectRatio?: string;
	autoplayInterval?: number;
	cardStyle?: CardStyle;
	showSubmissionAction?: boolean;
}) {
	const categories = useAtomValue(categoriesAtom);
	const onItemClick = useJumpToSection();

	return (
		<aside
			className="sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 overflow-y-auto overscroll-none md:flex md:flex-col"
			style={{ width }}
		>
			<div className="flex-1 min-h-0 overflow-y-auto">
				<CategorySidebar
					categories={categories}
					onItemClick={onItemClick}
					showSubmissionAction={showSubmissionAction}
					context="desktop"
				/>
			</div>

			{showAds && ads.length > 0 ? (
				<div className="shrink-0 p-2 pt-3">
					<AdBanner
						ads={ads}
						aspectRatio={adsAspectRatio}
						autoplayInterval={autoplayInterval}
						cardStyle={cardStyle}
						placement="sidebar"
					/>
				</div>
			) : (
				<div className="h-4" />
			)}
		</aside>
	);
});
