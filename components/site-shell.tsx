import { Suspense } from "react";
import type { PluginConfig } from "@/types";
import { AppLayout } from "@/components/app-layout";
import { RuntimeSiteShell } from "@/components/runtime-site-shell";
import { SiteHeadInsertions } from "@/components/site-head-insertions";
import { SiteStoreProvider } from "@/lib/store/hydrate";
import { getNav, getWebsiteData } from "@/lib/config";
import { pluginHasRenderablePayload } from "@/lib/plugin-config";
import { toPublicNavConfig } from "@/lib/site-access-config";

export function SiteShell() {
	if ((process.env.BUILD_MODE || "server").toLowerCase() === "html") {
		return <RuntimeSiteShell />;
	}

	const websiteData = getWebsiteData();
	const nav = toPublicNavConfig(getNav());
	const plugins = (nav.plugins ?? [])
		.filter(pluginHasRenderablePayload)
		.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
	const headPlugins = plugins.filter(
		(p) => p.type === "css" || p.type === "resource-hint",
	);
	const footerPlugins = plugins.filter(
		(p) => p.type === "js" || p.type === "external-script",
	);
	const deploymentMode =
		(process.env.BUILD_MODE || "server").toLowerCase() === "static"
			? "static"
			: "server";

	return (
		<SiteStoreProvider initial={{ websiteData, nav }}>
			<SiteHeadInsertions plugins={headPlugins} />
			<Suspense fallback={null}>
				<AppLayout deploymentMode={deploymentMode} />
			</Suspense>
			{footerPlugins.map((p) => (
				<PluginScript key={p.id} plugin={p} />
			))}
		</SiteStoreProvider>
	);
}

function PluginScript({ plugin }: { plugin: PluginConfig }) {
	const mode = plugin.loading ?? "sync";
	const scriptProps = {
		"data-plugin-id": plugin.id,
		"data-plugin-name": plugin.name,
		crossOrigin:
			plugin.type === "external-script" ? plugin.crossOrigin || undefined : undefined,
	};
	const inlineCode = plugin.code?.trim() ?? "";

	if (plugin.type === "external-script") {
		if (plugin.src?.trim() && inlineCode && mode !== "sync") {
			return (
				<script
					{...scriptProps}
					dangerouslySetInnerHTML={{
						__html: buildExternalScriptBootstrap(plugin, inlineCode, mode),
					}}
				/>
			);
		}

		return (
			<>
				{plugin.src?.trim() ? (
					<script
						{...scriptProps}
						src={plugin.src.trim()}
						defer={mode === "defer" ? true : undefined}
						async={mode === "async" ? true : undefined}
					/>
				) : null}
				{inlineCode ? (
					<script
						{...scriptProps}
						dangerouslySetInnerHTML={{ __html: inlineCode }}
					/>
				) : null}
			</>
		);
	}

	const inlineProps = {
		"data-plugin-id": plugin.id,
		"data-plugin-name": plugin.name,
		dangerouslySetInnerHTML: { __html: plugin.code },
	};
	if (mode === "defer") {
		return <script defer {...inlineProps} />;
	}
	if (mode === "async") {
		return <script async {...inlineProps} />;
	}
	return <script {...inlineProps} />;
}

function buildExternalScriptBootstrap(
	plugin: PluginConfig,
	inlineCode: string,
	mode: "sync" | "defer" | "async",
) {
	const src = JSON.stringify(plugin.src?.trim() ?? "");
	const crossOrigin = JSON.stringify(plugin.crossOrigin || "");
	return `(function(){var s=document.createElement("script");s.src=${src};${
		mode === "async" ? "s.async=true;" : "s.async=false;"
	}var c=${crossOrigin};if(c){s.crossOrigin=c;}s.onload=function(){${inlineCode}};document.body.appendChild(s);})();`;
}
