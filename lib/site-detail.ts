import type { NavCategory, NavSite } from "@/types";

export interface SiteDetailEntry {
	slug: string;
	path: string;
	site: NavSite;
	categoryId: string;
	categoryName: string;
	categoryPath: string[];
}

const SITE_DETAIL_BASE_PATH = "/site";

export const MAX_SITE_DETAIL_PREVIEW_IMAGES = 8;

/**
 * 清理详情页多图配置。运行时 JSON 可能绕过 TypeScript，因此这里仍做类型检查。
 */
export function normalizeSitePreviewImages(value: unknown): string[] {
	if (!Array.isArray(value)) return [];

	const result: string[] = [];
	const seen = new Set<string>();
	for (const item of value) {
		if (typeof item !== "string") continue;
		const url = item.trim();
		if (!url || seen.has(url)) continue;
		seen.add(url);
		result.push(url);
		if (result.length >= MAX_SITE_DETAIL_PREVIEW_IMAGES) break;
	}
	return result;
}

/**
 * 详情页优先展示 previewImages；没有有效数组时兼容旧的 previewImage 单图。
 */
export function resolveSiteDetailPreviewImages(
	site: Pick<NavSite, "previewImage" | "previewImages">,
): string[] {
	const images = normalizeSitePreviewImages(site.previewImages);
	if (images.length > 0) return images;

	const legacyImage =
		typeof site.previewImage === "string" ? site.previewImage.trim() : "";
	return legacyImage ? [legacyImage] : [];
}

export function buildSiteDetailSlug(
	site: Pick<NavSite, "id" | "title" | "url">,
): string {
	const base =
		slugify(site.id || "") ||
		slugify(site.title || "") ||
		slugify(extractUrlHost(site.url)) ||
		"site";
	const hash = stableHash(site.url || `${site.id || ""}-${site.title || ""}`);
	return `${base}-${hash}`;
}

export function buildSiteDetailPath(
	site: Pick<NavSite, "id" | "title" | "url">,
): string {
	const slug = buildSiteDetailSlug(site);
	if (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === "html") {
		return `/?site=${encodeURIComponent(slug)}`;
	}
	return `${SITE_DETAIL_BASE_PATH}/${slug}`;
}

export function collectSiteDetailEntries(
	categories: NavCategory[],
): SiteDetailEntry[] {
	const list: SiteDetailEntry[] = [];
	const seen = new Set<string>();

	const walk = (nodes: NavCategory[], parents: string[]) => {
		for (const node of nodes) {
			const currentPath = [...parents, node.name];
			if (node.sites && node.sites.length > 0) {
				for (const site of node.sites) {
					const slug = buildSiteDetailSlug(site);
					if (seen.has(slug)) continue;
					seen.add(slug);
					list.push({
						slug,
						path: buildSiteDetailPath(site),
						site,
						categoryId: node.id,
						categoryName: node.name,
						categoryPath: currentPath,
					});
				}
			}
			if (node.children && node.children.length > 0) {
				walk(node.children, currentPath);
			}
		}
	};

	walk(categories, []);
	return list;
}

export function findSiteDetailEntryBySlug(
	entries: SiteDetailEntry[],
	slug: string,
): SiteDetailEntry | null {
	const exact = entries.find((item) => item.slug === slug);
	if (exact) return exact;

	const hash = extractSlugHash(slug);
	if (!hash) return null;

	const matches = entries.filter((item) => extractSlugHash(item.slug) === hash);
	if (matches.length === 1) return matches[0];
	return null;
}

function extractUrlHost(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

function slugify(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

function extractSlugHash(slug: string): string {
	const idx = slug.lastIndexOf("-");
	if (idx <= 0 || idx >= slug.length - 1) return "";
	return slug.slice(idx + 1);
}

function stableHash(value: string): string {
	let hash = 2166136261;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash +=
			(hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
	}
	return (hash >>> 0).toString(36);
}
