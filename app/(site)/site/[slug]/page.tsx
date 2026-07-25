import { notFound, redirect } from "next/navigation";
import { getNav, getWebsiteData } from "@/lib/config";
import {
	collectSiteDetailEntries,
	findSiteDetailEntryBySlug,
} from "@/lib/site-detail";

interface SiteDetailRouteProps {
	params: Promise<{ slug: string }>;
}

const STATIC_PLACEHOLDER_SLUG = "__placeholder__";
const isHtmlDeployment =
	(process.env.BUILD_MODE || "server").toLowerCase() === "html";

export function generateStaticParams() {
	if (isHtmlDeployment) {
		return [{ slug: STATIC_PLACEHOLDER_SLUG }];
	}

	const nav = getNav();
	const websiteData = getWebsiteData();
	const entries = collectSiteDetailEntries(websiteData.categories);

	// Next.js static export requires at least one prerendered param for dynamic routes.
	// When detail pages are disabled or there is no site data, keep a placeholder route.
	if (nav.layout?.enableSiteDetailPage !== true || entries.length === 0) {
		return [{ slug: STATIC_PLACEHOLDER_SLUG }];
	}

	return entries.map((item) => ({
		slug: item.slug,
	}));
}

export default async function SiteDetailRoute(props: SiteDetailRouteProps) {
	const { slug } = await props.params;
	if (isHtmlDeployment) {
		notFound();
	}

	const nav = getNav();
	const detailEnabled = nav.layout?.enableSiteDetailPage === true;
	if (!detailEnabled || slug === STATIC_PLACEHOLDER_SLUG) {
		notFound();
	}

	const websiteData = getWebsiteData();
	const entries = collectSiteDetailEntries(websiteData.categories);
	const matched = findSiteDetailEntryBySlug(entries, slug);
	if (!matched) notFound();
	if (matched.slug !== slug) {
		redirect(matched.path);
	}

	return null;
}
