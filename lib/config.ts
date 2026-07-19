import type { NavCategory, NavConfig, NavSite, WebsiteData } from "@/types";
import { readNav, readWebsiteData } from "@/lib/server/store";

/**
 * 读取最新的网站数据（分类和网址）（每次调用都会重新读文件）。
 * - 静态模式下：next build 期间调用一次并固化到 HTML。
 * - server 模式下：server 组件渲染时调用，配合 revalidatePath 做热更新。
 */
export async function getWebsiteData(): Promise<WebsiteData> {
	return readWebsiteData();
}

/**
 * 读取最新的导航数据（所有后台配置）。
 */
export async function getNav(): Promise<NavConfig> {
	return readNav();
}

/**
 * 递归扁平化全部网站，便于本地搜索。
 */
export function flattenSites(
	categories: NavCategory[],
): Array<NavSite & { categoryId: string; categoryName: string }> {
	const list: Array<NavSite & { categoryId: string; categoryName: string }> = [];
	const walk = (cats: NavCategory[]) => {
		for (const c of cats) {
			if (c.sites) {
				for (const s of c.sites) {
					list.push({ ...s, categoryId: c.id, categoryName: c.name });
				}
			}
			if (c.children && c.children.length > 0) walk(c.children);
		}
	};
	walk(categories);
	return list;
}
