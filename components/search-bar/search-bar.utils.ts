"use client";

import type { SearchEngine } from "@/types";

export const DROPDOWN_MAX_HEIGHT = "min(20rem, calc(100dvh - 6rem))";

export function buildSearchEngineOptions(
	engines: SearchEngine[],
	enableLocal: boolean,
) {
	const base: SearchEngine[] = [];
	if (enableLocal) {
		base.push({
			id: "local",
			name: "本站",
			icon: "/images/search.svg",
			url: "",
		});
	}

	return [...base, ...engines.filter((engine) => engine.id !== "local")];
}

export function resolveDefaultEngineId(
	engineOptions: SearchEngine[],
	defaultEngine: string,
) {
	return engineOptions.some((engine) => engine.id === defaultEngine)
		? defaultEngine
		: (engineOptions[0]?.id ?? null);
}

export function getLocalSearchScore(
	query: string,
	entry: {
		title: string;
		titlePinyin: string;
		titleInitials: string;
		hay: string;
	},
) {
	if (entry.title === query) return 0;
	if (entry.titleInitials === query) return 1;
	if (entry.titlePinyin === query) return 2;
	if (entry.title.startsWith(query)) return 3;
	if (entry.titleInitials.startsWith(query)) return 4;
	if (entry.titlePinyin.startsWith(query)) return 5;
	if (entry.title.includes(query)) return 6;
	if (entry.titleInitials.includes(query)) return 7;
	if (entry.titlePinyin.includes(query)) return 8;
	if (entry.hay.includes(query)) return 20;
	return Number.POSITIVE_INFINITY;
}
