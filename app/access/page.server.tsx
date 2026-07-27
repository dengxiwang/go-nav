import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteAccessForm } from "@/components/site-access-form";
import { readSiteAccessStatus } from "@/lib/server/site-access-request";

export const metadata: Metadata = {
	title: "访问验证",
	robots: {
		index: false,
		follow: false,
	},
};

export default async function SiteAccessPage({
	searchParams,
}: {
	searchParams: Promise<{ next?: string | string[] }>;
}) {
	const status = await readSiteAccessStatus();
	const nav = status.nav;
	const accessProtection = nav.accessProtection;
	const requestedNext = (await searchParams).next;
	const nextPath = getSafeNextPath(
		Array.isArray(requestedNext) ? requestedNext[0] : requestedNext,
	);

	if (accessProtection?.enabled !== true) {
		redirect(nextPath);
	}

	if (status.allowed) {
		redirect(nextPath);
	}

	return (
		<SiteAccessForm
			siteName={nav.name || nav.title || "Go Nav"}
			siteLogo={nav.logo}
			siteDescription={nav.description}
			nextPath={nextPath}
			isConfigured={status.passwordConfigured}
		/>
	);
}

function getSafeNextPath(value: string | undefined): string {
	if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
	try {
		const url = new URL(value, "http://local");
		if (url.origin !== "http://local") return "/";
		if (url.pathname !== "/" && !url.pathname.startsWith("/site/")) return "/";
		return `${url.pathname}${url.search}`;
	} catch {
		return "/";
	}
}
