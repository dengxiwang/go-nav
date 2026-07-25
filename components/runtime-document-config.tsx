"use client";

import { useEffect } from "react";
import type { NavConfig, PluginConfig } from "@/types";
import { pluginHasRenderablePayload } from "@/lib/plugin-config";

const RUNTIME_NODE_ATTRIBUTE = "data-go-nav-runtime";

export function RuntimeDocumentConfig({ nav }: { nav: NavConfig }) {
	useEffect(() => {
		document.title = nav.title?.trim() || nav.name?.trim() || "Go Nav";
		setNamedMeta("description", nav.description);
		setNamedMeta("keywords", nav.keywords?.join(", "));
		setNamedMeta("author", nav.author);
		setNamedMeta("copyright", nav.copyright);
		setFavicon(nav.favicon);
	}, [nav]);

	useEffect(() => {
		const plugins = (nav.plugins ?? [])
			.filter(pluginHasRenderablePayload)
			.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
		const nodes = plugins.flatMap(injectPlugin);

		return () => {
			for (const node of nodes) node.remove();
		};
	}, [nav.plugins]);

	return null;
}

function setNamedMeta(name: string, rawValue: string | undefined) {
	const value = rawValue?.trim() ?? "";
	let element = document.head.querySelector<HTMLMetaElement>(
		`meta[name="${name}"]`,
	);

	if (!value) {
		element?.remove();
		return;
	}

	if (!element) {
		element = document.createElement("meta");
		element.name = name;
		document.head.appendChild(element);
	}
	element.content = value;
}

function setFavicon(rawValue: string | undefined) {
	const value = rawValue?.trim() ?? "";
	let element = document.head.querySelector<HTMLLinkElement>(
		'link[rel~="icon"]',
	);

	if (!value) {
		element?.remove();
		return;
	}

	if (!element) {
		element = document.createElement("link");
		element.rel = "icon";
		document.head.appendChild(element);
	}
	element.href = value;
}

function injectPlugin(plugin: PluginConfig): HTMLElement[] {
	if (plugin.type === "css") {
		const style = document.createElement("style");
		markPluginNode(style, plugin);
		style.textContent = plugin.code;
		document.head.appendChild(style);
		return [style];
	}

	if (plugin.type === "resource-hint" && plugin.href?.trim()) {
		const link = document.createElement("link");
		markPluginNode(link, plugin);
		link.rel = plugin.resourceHintRel ?? "preconnect";
		link.href = plugin.href.trim();
		if (link.rel === "preconnect" && plugin.crossOrigin) {
			link.crossOrigin = plugin.crossOrigin;
		}
		document.head.appendChild(link);
		return [link];
	}

	if (plugin.type === "external-script") {
		return injectExternalScript(plugin);
	}

	const script = document.createElement("script");
	markPluginNode(script, plugin);
	applyScriptLoading(script, plugin.loading);
	script.textContent = plugin.code;
	document.body.appendChild(script);
	return [script];
}

function injectExternalScript(plugin: PluginConfig): HTMLElement[] {
	const nodes: HTMLElement[] = [];
	const source = plugin.src?.trim() ?? "";
	const inlineCode = plugin.code?.trim() ?? "";

	if (source) {
		const script = document.createElement("script");
		markPluginNode(script, plugin);
		applyScriptLoading(script, plugin.loading);
		script.src = source;
		if (plugin.crossOrigin) script.crossOrigin = plugin.crossOrigin;
		if (inlineCode) {
			script.addEventListener(
				"load",
				() => {
					const inlineScript = document.createElement("script");
					markPluginNode(inlineScript, plugin);
					inlineScript.textContent = inlineCode;
					document.body.appendChild(inlineScript);
				},
				{ once: true },
			);
		}
		document.body.appendChild(script);
		nodes.push(script);
		return nodes;
	}

	if (inlineCode) {
		const script = document.createElement("script");
		markPluginNode(script, plugin);
		script.textContent = inlineCode;
		document.body.appendChild(script);
		nodes.push(script);
	}
	return nodes;
}

function applyScriptLoading(
	script: HTMLScriptElement,
	loading: PluginConfig["loading"],
) {
	if (loading === "async") script.async = true;
	if (loading === "defer") script.defer = true;
}

function markPluginNode(element: HTMLElement, plugin: PluginConfig) {
	element.setAttribute(RUNTIME_NODE_ATTRIBUTE, "plugin");
	element.dataset.pluginId = plugin.id;
	element.dataset.pluginName = plugin.name;
}
