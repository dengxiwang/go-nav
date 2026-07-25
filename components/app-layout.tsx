"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useAtomValue, useSetAtom } from "jotai";
import { HeaderBundle } from "./header-bundle";
import { AppSidebar } from "./app-sidebar";
import { AppFooter } from "./app-footer";
import { FloatingActions } from "./floating-actions";
import {
    SubmissionDialogHost,
    type SubmissionDeploymentMode,
} from "./submission-dialog-host";
import { useActiveSectionWriter } from "@/hooks/use-active-section";
import {
    activeIdAtom,
    categoriesAtom,
    homeAdsAspectRatioAtom,
    homeAdsAtom,
    homeAdsAutoplayIntervalAtom,
    homeAdsEnabledAtom,
    homeAdsGapAtom,
    homeAdsVisibleCountAtom,
    layoutAtom,
    recentVisitsMaxAtom,
    sidebarAdsAspectRatioAtom,
    sidebarAdsAtom,
    sidebarAdsAutoplayIntervalAtom,
    sidebarAdsEnabledAtom,
    showRecentVisitsAtom,
    showSubcategoryTabsAtom,
    submissionConfigAtom,
} from "@/lib/store/site";
import { AppLayoutHomeContent } from "./app-layout/app-layout-home-content";
import { SiteDetailPage } from "./app-layout/site-detail-page";
import { useAppLayoutView } from "./app-layout/use-app-layout-view";
import { useHomeRouteState } from "./app-layout/use-home-route-state";
import { PageEmptyState } from "./ui/empty-state-blocks";

/**
 * 顶层布局组件（Jotai 订阅版）。
 *
 * 设计要点：
 * - 不再接收 props，websiteData / nav 已通过 SiteStoreProvider 水合到 atom。
 * - activeId 改由 useActiveSectionWriter 直接写入 activeIdAtom，
 *   AppLayout 本身不再订阅 activeId，滚动时不会重渲染。
 * - 抽屉开关 / 搜索引擎等状态下沉到 HeaderBundle。
 */
export function AppLayout({
	deploymentMode,
}: {
	deploymentMode: SubmissionDeploymentMode;
}) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const layout = useAtomValue(layoutAtom);
	const categories = useAtomValue(categoriesAtom);
	const homeAds = useAtomValue(homeAdsAtom);
	const sidebarAds = useAtomValue(sidebarAdsAtom);
	const homeAdsAutoplayInterval = useAtomValue(homeAdsAutoplayIntervalAtom);
	const sidebarAdsAutoplayInterval = useAtomValue(
		sidebarAdsAutoplayIntervalAtom,
	);
	const homeAdsAspectRatio = useAtomValue(homeAdsAspectRatioAtom);
	const sidebarAdsAspectRatio = useAtomValue(sidebarAdsAspectRatioAtom);
	const homeAdsEnabled = useAtomValue(homeAdsEnabledAtom);
	const sidebarAdsEnabled = useAtomValue(sidebarAdsEnabledAtom);
	const homeAdsGap = useAtomValue(homeAdsGapAtom);
	const homeAdsVisibleCount = useAtomValue(homeAdsVisibleCountAtom);
	const showRecentVisits = useAtomValue(showRecentVisitsAtom);
	const recentVisitsMax = useAtomValue(recentVisitsMaxAtom);
	const showSubcategoryTabs = useAtomValue(showSubcategoryTabsAtom);
	const submission = useAtomValue(submissionConfigAtom);
	const setActiveId = useSetAtom(activeIdAtom);

	// 滚动监听：只写入 activeIdAtom，不触发本组件重渲染
	useActiveSectionWriter();
	const {
		appShellStyle,
		cardGrid,
		categorySectionView,
		displayCategories,
		mainStyle,
		sectionsStyle,
		sidebarWidth,
	} = useAppLayoutView({
		layout,
		categories,
		showSubcategoryTabs,
	});
	const { disableRecentVisitsEntrance, isDetailRoute, selectedEntry } =
		useHomeRouteState({
			pathname,
			categories,
			detailEnabled: layout.enableSiteDetailPage,
			detailSlugOverride:
				deploymentMode === "html" ? searchParams.get("site") : null,
			setActiveId,
		});
	const hasDesktopSidebar = layout.showSidebar && displayCategories.length > 0;
	const hasVisibleHomeAds =
		!selectedEntry && !isDetailRoute && homeAdsEnabled && homeAds.length > 0;

	return (
		<div className="flex min-h-dvh flex-col">
			<HeaderBundle showSearch={layout.showSearch} />

			<div className="flex min-w-0 flex-1">
				{layout.showSidebar && displayCategories.length > 0 && (
					<AppSidebar
						width={sidebarWidth}
						ads={sidebarAds}
						showAds={sidebarAdsEnabled}
						adsAspectRatio={sidebarAdsAspectRatio}
						autoplayInterval={sidebarAdsAutoplayInterval}
						cardStyle={layout.cardStyle}
						showSubmissionAction={
							submission.enabled && submission.showSidebarButton
						}
					/>
				)}

				<div
					className={`mx-auto flex min-w-0 flex-1 flex-col w-full px-(--content-pad-mobile) md:pl-(--content-pad-left) md:pr-(--content-pad-right) ${
						!layout.showSearch && hasDesktopSidebar ? "md:-mt-12" : ""
					}`}
					style={appShellStyle}
				>
					<main
						className={`min-w-0 flex-1 ${hasVisibleHomeAds ? "pt-0 pb-2" : "py-2"}`}
						style={mainStyle}
					>
						{selectedEntry ? (
							<SiteDetailPage entry={selectedEntry} layout={layout} />
						) : isDetailRoute ? (
							<PageEmptyState
								title="未找到该网址"
								description="当前详情页地址无效，请返回首页重新选择。"
							/>
						) : (
							<AppLayoutHomeContent
								displayCategories={displayCategories}
								layout={layout}
								recentVisitsMax={recentVisitsMax}
								showRecentVisits={showRecentVisits}
								disableRecentVisitsEntrance={disableRecentVisitsEntrance}
								cardGrid={cardGrid}
								categorySectionView={categorySectionView}
								sectionsStyle={sectionsStyle}
								ads={homeAds}
								adsAspectRatio={homeAdsAspectRatio}
								adsGap={homeAdsGap}
								adsVisibleCount={homeAdsVisibleCount}
								autoplayInterval={homeAdsAutoplayInterval}
								showHomeAds={hasVisibleHomeAds}
							/>
						)}
					</main>

					{layout.showFooter && (
						<AppFooter showQrCode={layout.showFooterQrCode} />
					)}
				</div>
			</div>

			{(layout.showFloatingActions ||
				(submission.enabled && submission.showFloatingButton)) && (
				<FloatingActions
					showActions={layout.showFloatingActions}
					showQrCode={layout.showFloatingQrCode}
					showSubmission={submission.enabled && submission.showFloatingButton}
				/>
			)}
			<SubmissionDialogHost deploymentMode={deploymentMode} />
		</div>
	);
}
