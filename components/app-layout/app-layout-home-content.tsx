"use client";

import type { AdConfig, LayoutConfig } from "@/types";
import { AdBanner } from "../ad-banner";
import { CategorySection } from "../category-section";
import { RecentVisits } from "../recent-visits";
import { PageEmptyState } from "../ui/empty-state-blocks";
import type { AppLayoutViewModel } from "./app-layout.types";

export function AppLayoutHomeContent({
	displayCategories,
	layout,
	recentVisitsMax,
	showRecentVisits,
	disableRecentVisitsEntrance,
	cardGrid,
	categorySectionView,
	sectionsStyle,
	ads,
	adsAspectRatio,
	adsGap,
	adsVisibleCount,
	autoplayInterval,
	showHomeAds,
}: Pick<
	AppLayoutViewModel,
	"displayCategories" | "cardGrid" | "categorySectionView" | "sectionsStyle"
> & {
	layout: Required<LayoutConfig>;
	recentVisitsMax: number;
	showRecentVisits: boolean;
	disableRecentVisitsEntrance: boolean;
	ads: AdConfig[];
	adsAspectRatio?: string;
	adsGap: number;
	adsVisibleCount: number;
	autoplayInterval: number;
	showHomeAds: boolean;
}) {
	const homeAds =
		showHomeAds && ads.length > 0 ? (
			<section
				aria-label="推荐广告"
				className="mb-2 w-full"
				style={{ padding: `0px ${cardGrid.padding} 8px ${cardGrid.padding}` }}
			>
				<AdBanner
					ads={ads}
					aspectRatio={adsAspectRatio}
					gap={adsGap}
					visibleCount={adsVisibleCount}
					autoplayInterval={autoplayInterval}
					cardStyle={layout.cardStyle}
					placement="home-top"
				/>
			</section>
		) : null;

	if (displayCategories.length === 0) {
		return (
			<>
				{homeAds}
				<PageEmptyState
					title="开始使用 Go Nav"
					description="还没有添加任何网站分类和内容，请先在后台管理中添加分类与网站。"
				/>
			</>
		);
	}

	return (
		<>
			{homeAds}
			{showRecentVisits ? (
				<RecentVisits
					maxItems={recentVisitsMax}
					cards={cardGrid}
					disableEntranceAnimation={disableRecentVisitsEntrance}
					layout={layout}
				/>
			) : null}

			<div style={sectionsStyle}>
				{displayCategories.map((item) => (
					<CategorySection
						key={item.category.id}
						category={item.category}
						isChild={item.isChild}
						view={categorySectionView}
					/>
				))}
			</div>
		</>
	);
}
