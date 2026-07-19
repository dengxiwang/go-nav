import { revalidatePath } from "next/cache";
import { getNav, getWebsiteData } from "@/lib/config";
import { collectSiteDetailEntries } from "@/lib/site-detail";

/**
 * 统一触发前台可见页面的缓存失效：
 * - 首页
 * - sitemap
 * - 详情页（启用详情模式时）
 *
 * 说明：Route Handler 中调用 revalidatePath 只会在“下次访问”时生效。
 */
export async function revalidateFrontendPaths() {
	revalidatePath("/");
	revalidatePath("/sitemap.xml");

	const nav = await getNav();
	if (nav.layout?.enableSiteDetailPage !== true) return;

	const websiteData = await getWebsiteData();
	const entries = collectSiteDetailEntries(websiteData.categories);
	for (const entry of entries) {
		// 兼容 trailingSlash 配置，两个路径都标记一次。
		revalidatePath(entry.path);
		revalidatePath(`${entry.path}/`);
	}
}
