"use client";

import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useState,
} from "react";
import type { PinyinSearchIndexEntry } from "@/lib/client/pinyin-search";
import { getLocalSearchScore } from "./search-bar.utils";
import type { SearchBarSite } from "./search-bar.types";

export function useLocalSearch({
	enableLocal,
	isLocal,
	query,
	sites,
}: {
	enableLocal: boolean;
	isLocal: boolean;
	query: string;
	sites: SearchBarSite[];
}) {
	const [searchIndexReady, setSearchIndexReady] = useState(false);
	const [searchIndex, setSearchIndex] = useState<
		Array<{ site: SearchBarSite } & PinyinSearchIndexEntry>
	>([]);

	useEffect(() => {
		if (!isLocal || !query.trim()) return;
		setSearchIndexReady(true);
	}, [isLocal, query]);

	useEffect(() => {
		if (!enableLocal || !searchIndexReady) {
			setSearchIndex([]);
			return;
		}

		// 动态块还在下载时，普通文本搜索仍然可立即使用。
		setSearchIndex(
			sites.map((site) => {
				const title = (site.title ?? "").toLowerCase();
				return {
					site,
					title,
					titlePinyin: "",
					titleInitials: "",
					hay: [
						title,
						site.description ?? "",
						site.url ?? "",
						site.tags?.join(" ") ?? "",
						site.categoryName ?? "",
					]
						.join("\u0001")
						.toLowerCase(),
				};
			}),
		);

		let cancelled = false;
		void import("@/lib/client/pinyin-search")
			.then(({ buildPinyinSearchIndexEntry }) => {
				if (cancelled) return;
				setSearchIndex(
					sites.map((site) => ({
						site,
						...buildPinyinSearchIndexEntry(site),
					})),
				);
			})
			.catch(() => {
				// 动态块加载失败时保留上面的普通文本索引。
			});

		return () => {
			cancelled = true;
		};
	}, [enableLocal, searchIndexReady, sites]);

	const deferredQuery = useDeferredValue(query);
	const results = useMemo(() => {
		if (!isLocal) return [] as SearchBarSite[];

		const normalizedQuery = deferredQuery.trim().toLowerCase();
		if (!normalizedQuery) return [] as SearchBarSite[];

		return searchIndex
			.map((entry, index) => ({
				site: entry.site,
				score: getLocalSearchScore(normalizedQuery, entry),
				index,
			}))
			.filter((entry) => Number.isFinite(entry.score))
			.sort((a, b) => a.score - b.score || a.index - b.index)
			.slice(0, 10)
			.map((entry) => entry.site);
	}, [deferredQuery, isLocal, searchIndex]);
	const markSearchIndexReady = useCallback(
		() => {
			if (isLocal) setSearchIndexReady(true);
		},
		[isLocal],
	);

	return {
		results,
		markSearchIndexReady,
	};
}
