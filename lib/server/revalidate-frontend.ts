import { revalidatePath } from "next/cache";

/**
 * 统一触发前台可见页面的缓存失效：
 * - 首页
 * - sitemap
 * - 详情页（启用详情模式时）
 *
 * 说明：Route Handler 中调用 revalidatePath 只会在“下次访问”时生效。
 */
export function revalidateFrontendPaths() {
	revalidatePath("/");
	revalidatePath("/sitemap.xml");

	// 路由模式可以一次标记全部详情页，不需要遍历站点数据并逐页调用。
	// 新增的 slug 也会在首次访问时使用最新配置生成。
	revalidatePath("/site/[slug]", "page");
}
