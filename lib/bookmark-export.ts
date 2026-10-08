import type { NavCategory, WebsiteData } from "@/types";

// Keep each entry on one line for bookmark importers that parse line by line.
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
		.replace(/\r/g, "&#13;")
		.replace(/\n/g, "&#10;");
}

function resolveBookmarkUrl(rawUrl: string, baseUrl?: string): string {
	const value = rawUrl.trim();
	if (!value) return value;
	if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(value)) {
		return `http://${value}`;
	}
	if (/^[a-z][a-z\d+\-.]*:/i.test(value)) return value;
	if (!/^(\/|\.\/|\.\.\/|#|\?)/.test(value) && /^[^\s/]+\.[^\s/]+/.test(value)) {
		return `https://${value}`;
	}
	// Relative links must point at the site, never at the downloaded local file.
	if (baseUrl) return new URL(value, baseUrl).href;
	return value.startsWith("//") ? `https:${value}` : value;
}

/** Export the current category tree in the Netscape bookmark file format. */
export function exportBookmarksHtml(websiteData: WebsiteData, baseUrl?: string): string {
	const lines = [
		"<!DOCTYPE NETSCAPE-Bookmark-file-1>",
		'<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
		"<TITLE>Bookmarks</TITLE>",
		"<H1>Bookmarks</H1>",
		"<DL><p>",
	];

	const appendCategory = (category: NavCategory, depth: number) => {
		const indent = "    ".repeat(depth);
		lines.push(`${indent}<DT><H3>${escapeHtml(category.name)}</H3>`);
		if (category.description) {
			lines.push(`${indent}<DD>${escapeHtml(category.description)}</DD>`);
		}
		lines.push(`${indent}<DL><p>`);
		for (const site of category.sites ?? []) {
			lines.push(
				`${indent}    <DT><A HREF="${escapeHtml(resolveBookmarkUrl(site.url, baseUrl))}">${escapeHtml(site.title || site.url)}</A>`,
			);
			if (site.description) {
				lines.push(`${indent}    <DD>${escapeHtml(site.description)}</DD>`);
			}
		}
		for (const child of category.children ?? []) {
			appendCategory(child, depth + 1);
		}
		lines.push(`${indent}</DL><p>`);
	};

	for (const category of websiteData.categories) {
		appendCategory(category, 1);
	}
	lines.push("</DL><p>");
	return `${lines.join("\n")}\n`;
}

export function downloadBookmarksHtml(websiteData: WebsiteData): void {
	const homepageUrl = new URL("/", window.location.href).href;
	const blob = new Blob([exportBookmarksHtml(websiteData, homepageUrl)], {
		type: "text/html;charset=utf-8",
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = `go-nav-bookmarks-${new Date().toISOString().slice(0, 10)}.html`;
	try {
		document.body.appendChild(anchor);
		anchor.click();
	} finally {
		anchor.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
}
