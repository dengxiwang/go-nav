import { SiteShell } from "@/components/site-shell";
import { SiteAccessForm } from "@/components/site-access-form";
import { readSiteAccessStatus } from "@/lib/server/site-access-request";

const isServerDeployment =
	(process.env.BUILD_MODE || "server").toLowerCase() === "server";

export default async function SiteLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	if (isServerDeployment) {
		const status = await readSiteAccessStatus();
		if (!status.allowed) {
			return (
				<SiteAccessForm
					siteName={status.nav.name || status.nav.title || "Go Nav"}
					siteLogo={status.nav.logo}
					siteDescription={status.nav.description}
					isConfigured={status.passwordConfigured}
				/>
			);
		}
	}

	return (
		<>
			<SiteShell />
			{children}
		</>
	);
}
