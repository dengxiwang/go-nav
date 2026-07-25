"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { RuntimeLoadingScreen } from "@/components/runtime-loading-screen";
import { ThemeProvider } from "@/components/theme-provider";
import { AdminStoreProvider } from "@/lib/store/hydrate";
import type { NavConfig, ThemeMode, WebsiteData } from "@/types";

interface RuntimeConfig {
	nav: NavConfig;
	websiteData: WebsiteData;
}

export function HtmlAdminRuntime({ children }: { children: ReactNode }) {
	const [config, setConfig] = useState<RuntimeConfig | null>(null);
	const [error, setError] = useState("");
	const [themeMode, setThemeMode] = useState<ThemeMode>("system");

	useEffect(() => {
		const controller = new AbortController();
		const cacheBuster = Date.now().toString(36);

		const navPromise = fetchRuntimeJson<NavConfig>(
			`/nav.json?v=${cacheBuster}`,
			controller.signal,
		);
		const websitePromise = fetchRuntimeJson<WebsiteData>(
			`/website.json?v=${cacheBuster}`,
			controller.signal,
		);

		void navPromise
			.then((nav) => {
				if (!controller.signal.aborted) {
					setThemeMode(nav.themeMode ?? "light");
				}
			})
			.catch(() => undefined);

		Promise.all([navPromise, websitePromise])
			.then(([nav, websiteData]) => {
				assertRuntimeConfig(nav, websiteData);
				setConfig({ nav, websiteData });
				document.title = `${nav.name || "Go Nav"} 配置后台`;
			})
			.catch((reason: unknown) => {
				if (controller.signal.aborted) return;
				setError(
					reason instanceof Error ? reason.message : "运行时配置加载失败",
				);
			});

		return () => controller.abort();
	}, []);

	if (error) {
		return (
			<ThemeProvider mode={themeMode}>
				<main className="flex min-h-dvh items-center justify-center bg-background px-6 text-foreground">
					<div className="w-full max-w-xl rounded-2xl border border-danger/30 bg-danger-soft p-6 text-danger-soft-foreground">
						<h1 className="text-lg font-semibold">配置后台加载失败</h1>
						<p className="mt-2 break-words text-sm leading-6">{error}</p>
						<p className="mt-3 text-sm leading-6">
							请确认 nav.json 与 website.json 位于网站根目录，并通过
							HTTP/HTTPS 访问。
						</p>
					</div>
				</main>
			</ThemeProvider>
		);
	}

	if (!config) {
		return (
			<ThemeProvider mode={themeMode}>
				<RuntimeLoadingScreen message="正在读取网站配置…" />
			</ThemeProvider>
		);
	}

	return (
		<ThemeProvider mode={themeMode}>
			<AdminStoreProvider initial={config}>
				<AdminShell>{children}</AdminShell>
			</AdminStoreProvider>
		</ThemeProvider>
	);
}

async function fetchRuntimeJson<T>(
	url: string,
	signal: AbortSignal,
): Promise<T> {
	const response = await fetch(url, {
		cache: "no-store",
		headers: {
			Accept: "application/json",
			"Cache-Control": "no-cache",
		},
		signal,
	});
	if (!response.ok) {
		throw new Error(`${url.split("?")[0]} 请求失败（HTTP ${response.status}）`);
	}
	try {
		return (await response.json()) as T;
	} catch {
		throw new Error(`${url.split("?")[0]} 不是有效的 JSON`);
	}
}

function assertRuntimeConfig(nav: NavConfig, websiteData: WebsiteData) {
	if (!nav || typeof nav !== "object" || Array.isArray(nav)) {
		throw new Error("/nav.json 顶层必须是 JSON 对象");
	}
	if (
		!websiteData ||
		typeof websiteData !== "object" ||
		!Array.isArray(websiteData.categories)
	) {
		throw new Error("/website.json 必须包含 categories 数组");
	}
}
