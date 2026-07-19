import type { MetadataRoute } from "next";
import { getNav, getWebsiteData } from "@/lib/config";
import { collectSiteDetailEntries } from "@/lib/site-detail";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const origin = resolveSiteOrigin();
	const nav = await getNav();
	const detailEnabled = nav.layout?.enableSiteDetailPage === true;
	const websiteData = await getWebsiteData();
	const detailEntries = detailEnabled
		? collectSiteDetailEntries(websiteData.categories)
		: [];
	const now = new Date();

	const urls: MetadataRoute.Sitemap = [
		{
			url: `${origin}/`,
			lastModified: now,
			changeFrequency: "daily",
			priority: 1,
		},
	];

	for (const entry of detailEntries) {
		urls.push({
			url: `${origin}${entry.path}/`,
			lastModified: now,
			changeFrequency: "weekly",
			priority: 0.7,
		});
	}

	return urls;
}

function resolveSiteOrigin(): string {
	const raw =
		process.env.NEXT_PUBLIC_SITE_URL ||
		process.env.SITE_URL ||
		"https://nav.gotab.cn";
	try {
		const url = new URL(raw);
		return url.origin;
	} catch {
		return "https://nav.gotab.cn";
	}
}
