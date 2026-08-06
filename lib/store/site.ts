/**
 * 前台 Jotai 原子定义。
 *
 * 服务端获取的 nav / websiteData 通过 SiteStoreProvider 水合进只读根原子；
 * 组件按需订阅衍生 atom，配合 Provider 隔离保证每次请求独立。
 */
import { atom } from "jotai";
import type { Key } from "@heroui/react";
import type { LayoutConfig, NavCategory, NavConfig, NavSite, WebsiteData } from "@/types";
import { pluginHasRenderablePayload } from "@/lib/plugin-config";
import { resolveSubmissionConfig } from "@/lib/submission";
import {
	resolveAdPlacement,
	resolveHomeAdsAspectRatio,
	resolveHomeAdsAutoplayInterval,
	resolveHomeAdsEnabled,
	resolveHomeAdsGap,
	resolveHomeAdsVisibleCount,
	resolveSidebarAdsAspectRatio,
	resolveSidebarAdsAutoplayInterval,
	resolveSidebarAdsEnabled,
} from "@/lib/ad-display";

/** 站点默认布局配置，和原 AppLayout 中保持一致 */
export const DEFAULT_LAYOUT: Required<LayoutConfig> = {
	maxWidth: "1400px",
	contentPaddingLeft: "8px",
	contentPaddingRight: "16px",
	sectionGap: "16px",
	showSidebar: true,
	sidebarWidth: "224px",
	showFloatingActions: true,
	showFloatingQrCode: true,
	showFooterQrCode: true,
	showFooter: true,
	showSearch: true,
	showCategoryTitle: true,
	showCategoryDescription: true,
	cardMinWidth: "160px",
	cardHeight: "64px",
	cardStyle: "compact",
	cardGridPadding: "8px",
	iconBorderRadius: "full",
	defaultIconPadding: "",
	linkTarget: "new",
	autoUseIntranet: false,
	enableSiteDetailPage: false,
	showSiteDetailUrl: true,
	showSubcategoryTabs: true,
	showCategorySearch: false,
};

const EMPTY_WEBSITE: WebsiteData = { categories: [] };
const EMPTY_FOOTER_LINKS: NavConfig["footerLinks"] = [];
const EMPTY_NAV: NavConfig = {
	title: "",
	name: "",
	description: "",
	keywords: [],
	logo: "",
	favicon: "",
	author: "",
	copyright: "",
	icp: "",
	beian: "",
	qrCode: "",
	qrCodeText: "",
	footerLinks: [],
	search: {
		defaultEngine: "",
		enableLocalSearch: false,
		rememberLastEngine: false,
		placeholder: "",
		engines: [],
	},
	ads: [],
	imageUpload: {
		compress: false,
		convertToWebp: false,
	},
};

// ─── 根原子（只读） ──────────────────────────────────────────────────────

export const siteNavAtom = atom<NavConfig>(EMPTY_NAV);
export const siteWebsiteDataAtom = atom<WebsiteData>(EMPTY_WEBSITE);

// ─── 派生原子 ────────────────────────────────────────────────────────────

export const layoutAtom = atom<Required<LayoutConfig>>((get) => ({
	...DEFAULT_LAYOUT,
	...(get(siteNavAtom).layout ?? {}),
}));

export const categoriesAtom = atom((get) => get(siteWebsiteDataAtom).categories ?? []);

export const enabledAdsAtom = atom((get) =>
	(get(siteNavAtom).ads ?? [])
		.filter((a) => a.enabled)
		.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
);

export const homeAdsAtom = atom((get) => {
	const nav = get(siteNavAtom);
	return get(enabledAdsAtom).filter(
		(ad) => resolveAdPlacement(ad, nav.adsDisplayPosition) === "home-top",
	);
});

export const sidebarAdsAtom = atom((get) => {
	const nav = get(siteNavAtom);
	return get(enabledAdsAtom).filter(
		(ad) => resolveAdPlacement(ad, nav.adsDisplayPosition) === "sidebar",
	);
});

export const flatSitesAtom = atom((get) => {
	const result: Array<NavSite & { categoryId: string; categoryName: string }> =
		[];
	const walk = (cats: NavCategory[]) => {
		for (const cat of cats) {
			if (cat.sites) {
				for (const s of cat.sites) {
					result.push({
						...s,
						categoryId: cat.id,
						categoryName: cat.name,
					});
				}
			}
			if (cat.children) walk(cat.children);
		}
	};
	walk(get(siteWebsiteDataAtom).categories);
	return result;
});

/** 是否存在至少一个配置了内网地址的网址 */
export const hasIntranetSitesAtom = atom((get) =>
	get(flatSitesAtom).some(
		(site) => typeof site.intranetUrl === "string" && site.intranetUrl.trim().length > 0,
	),
);

// 一些常用的细粒度派生，避免组件订阅整个 nav
export const navNameAtom = atom((get) => get(siteNavAtom).name);
export const navLogoAtom = atom((get) => get(siteNavAtom).logo);
export const navCopyrightAtom = atom((get) => get(siteNavAtom).copyright);
export const navIcpAtom = atom((get) => get(siteNavAtom).icp);
export const navBeianAtom = atom((get) => get(siteNavAtom).beian);
export const navQrCodeAtom = atom((get) => get(siteNavAtom).qrCode);
export const navQrCodeTextAtom = atom((get) => get(siteNavAtom).qrCodeText);
export const footerLinksAtom = atom(
	(get) => get(siteNavAtom).footerLinks ?? EMPTY_FOOTER_LINKS,
);
export const searchConfigAtom = atom((get) => get(siteNavAtom).search ?? EMPTY_NAV.search);
export const homeAdsAspectRatioAtom = atom((get) =>
	resolveHomeAdsAspectRatio(get(siteNavAtom)),
);
export const sidebarAdsAspectRatioAtom = atom((get) =>
	resolveSidebarAdsAspectRatio(get(siteNavAtom)),
);
export const homeAdsEnabledAtom = atom((get) =>
	resolveHomeAdsEnabled(get(siteNavAtom)),
);
export const sidebarAdsEnabledAtom = atom((get) =>
	resolveSidebarAdsEnabled(get(siteNavAtom)),
);
export const homeAdsAutoplayIntervalAtom = atom((get) =>
	resolveHomeAdsAutoplayInterval(get(siteNavAtom)),
);
export const sidebarAdsAutoplayIntervalAtom = atom((get) =>
	resolveSidebarAdsAutoplayInterval(get(siteNavAtom)),
);
export const homeAdsVisibleCountAtom = atom((get) =>
	resolveHomeAdsVisibleCount(get(siteNavAtom)),
);
export const homeAdsGapAtom = atom((get) =>
	resolveHomeAdsGap(get(siteNavAtom).homeAdsGap),
);
export const showRecentVisitsAtom = atom(
	(get) => get(siteNavAtom).showRecentVisits !== false,
);
export const recentVisitsMaxAtom = atom(
	(get) => get(siteNavAtom).recentVisitsMax ?? 20,
);

export const showSubcategoryTabsAtom = atom(
	(get) => get(layoutAtom).showSubcategoryTabs !== false,
);

export const showCategorySearchAtom = atom(
	(get) => get(layoutAtom).showCategorySearch === true,
);

export const submissionConfigAtom = atom((get) =>
	resolveSubmissionConfig(get(siteNavAtom).submission),
);

/** 启用的插件列表（按 sort 排序），供 layout 注入使用 */
export const enabledPluginsAtom = atom((get) => {
	const plugins = get(siteNavAtom).plugins ?? [];
	return plugins
		.filter(pluginHasRenderablePayload)
		.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
});

// ─── 交互状态 ────────────────────────────────────────────────────────────

/** 当前滚动位置对应的活跃分类 id，由 useActiveSection 写入 */
export const activeIdAtom = atom<string | undefined>(undefined);

/** 移动端导航抽屉开关 */
export const navDrawerOpenAtom = atom(false);
/** 搜索引擎抽屉开关 */
export const engineDrawerOpenAtom = atom(false);
/** 当前选中的搜索引擎 id */
export const engineIdAtom = atom<Key | null>(null);

/** 投稿弹窗由侧栏入口和悬浮入口共同控制 */
export const submissionDialogOpenAtom = atom(false);
