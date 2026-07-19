"use client";

import type { Selection } from "@heroui/react";
import {
	Chip,
	EmptyState,
	ListBox,
	ListBoxItem,
	SearchField,
} from "@heroui/react";
import type { Key } from "@heroui/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import type { NavCategory } from "@/types";
import {
	activeIdAtom,
	showCategorySearchAtom,
	showSubcategoryTabsAtom,
} from "@/lib/store/site";
import { IconView } from "./icon-view";
import { SubmissionSidebarButton } from "./submission-trigger";

function countSites(category: NavCategory): number {
	let count = category.sites?.length ?? 0;
	if (category.children) {
		for (const child of category.children) {
			count += countSites(child);
		}
	}
	return count;
}

function flattenCategoriesForTree(categories: NavCategory[]): NavCategory[] {
	const result: NavCategory[] = [];
	for (const cat of categories) {
		result.push(cat);
		if (cat.children && cat.children.length > 0) {
			result.push(...cat.children);
		}
	}
	return result;
}

interface CategorySearchEntry {
	category: NavCategory;
	text: string;
	pinyin: string;
	pinyinInitials: string;
}

export const CategorySidebar = memo(function CategorySidebar({
	categories,
	onItemClick,
	showSubmissionAction = false,
}: {
	categories: NavCategory[];
	onItemClick?: (id: string) => void;
	showSubmissionAction?: boolean;
}) {
	const activeId = useAtomValue(activeIdAtom);
	const showSubcategoryTabs = useAtomValue(showSubcategoryTabsAtom);
	const showCategorySearch = useAtomValue(showCategorySearchAtom);
	const pathname = usePathname();
	const router = useRouter();
	const [searchQuery, setSearchQuery] = useState("");
	const [searchHighlightIndex, setSearchHighlightIndex] = useState(-1);
	const [searchEntries, setSearchEntries] = useState<CategorySearchEntry[]>([]);
	const [searchIndexReady, setSearchIndexReady] = useState(false);
	const searchInputRef = useRef<HTMLInputElement>(null);

	const displayCategories = useMemo(
		() =>
			showSubcategoryTabs ? categories : flattenCategoriesForTree(categories),
		[categories, showSubcategoryTabs],
	);

	useEffect(() => {
		if (!showCategorySearch) {
			setSearchEntries([]);
			return;
		}

		// 先提供中文/描述文本匹配，拼音索引在后台按需补全。
		setSearchEntries(
			displayCategories.map((category) => ({
				category,
				text: `${category.name}\u0001${category.description ?? ""}`.toLowerCase(),
				pinyin: "",
				pinyinInitials: "",
			})),
		);
		if (!searchIndexReady) return;

		let cancelled = false;
		void import("@/lib/client/pinyin-search")
			.then(({ createPinyinVariants }) => {
				if (cancelled) return;
				setSearchEntries(
					displayCategories.map((category) => {
						const variants = createPinyinVariants(category.name);
						return {
							category,
							text: `${category.name}\u0001${category.description ?? ""}`.toLowerCase(),
							pinyin: variants.full,
							pinyinInitials: variants.initials,
						};
					}),
				);
			})
			.catch(() => {
				// 动态块加载失败时保留普通文本搜索。
			});

		return () => {
			cancelled = true;
		};
	}, [displayCategories, searchIndexReady, showCategorySearch]);

	const filteredCategories = useMemo(() => {
		if (!showCategorySearch || !searchQuery.trim()) return displayCategories;
		const q = searchQuery.trim().toLowerCase();
		return searchEntries
			.filter(
				(entry) =>
					entry.text.includes(q) ||
					entry.pinyin.includes(q) ||
					entry.pinyinInitials.includes(q),
			)
			.map((entry) => entry.category);
	}, [displayCategories, searchEntries, searchQuery, showCategorySearch]);

	const allCategoryIds = useMemo(() => {
		const ids = new Set<string>(categories.map((c) => c.id));
		for (const cat of categories) {
			if (cat.children) {
				for (const child of cat.children) {
					ids.add(child.id);
				}
			}
		}
		return ids;
	}, [categories]);

	const parentIdByCategoryId = useMemo(() => {
		const map = new Map<string, string>();
		for (const cat of categories) {
			map.set(cat.id, cat.id);
			if (!cat.children) continue;
			for (const child of cat.children) {
				map.set(child.id, cat.id);
			}
		}
		return map;
	}, [categories]);

	const inDetailPage = pathname.startsWith("/site/");

	const selectedId = useMemo(() => {
		if (inDetailPage) return null;
		if (!activeId) {
			return categories[0]?.id ?? null;
		}
		if (showSubcategoryTabs) {
			return parentIdByCategoryId.get(activeId) ?? (categories[0]?.id ?? null);
		}
		if (!allCategoryIds.has(activeId)) {
			return categories[0]?.id ?? null;
		}
		return activeId;
	}, [
		activeId,
		allCategoryIds,
		categories,
		inDetailPage,
		parentIdByCategoryId,
		showSubcategoryTabs,
	]);

	const selectedKeys: Selection = useMemo(() => {
		if (!selectedId) return new Set();
		return new Set([selectedId]);
	}, [selectedId]);

	const hasAnyIcon = useMemo(
		() => categories.some((c) => !!c.icon),
		[categories],
	);

	const siteCounts = useMemo(() => {
		const map = new Map<string, number>();
		const cats = showSubcategoryTabs ? categories : displayCategories;
		for (const c of cats) {
			map.set(c.id, countSites(c));
		}
		return map;
	}, [categories, displayCategories, showSubcategoryTabs]);

	const childIds = useMemo(() => {
		const ids = new Set<string>();
		for (const cat of categories) {
			if (cat.children) {
				for (const child of cat.children) {
					ids.add(child.id);
				}
			}
		}
		return ids;
	}, [categories]);

	const jumpTo = useCallback(
		(key: Key) => {
			const id = String(key);
			if (inDetailPage) {
				if (id === "home") {
					onItemClick?.("");
					router.push("/");
					return;
				}
				onItemClick?.(id);
				router.push(`/#${encodeURIComponent(id)}`);
				return;
			}

			if (id === "home") {
				if (typeof window !== "undefined") {
					window.scrollTo({ top: 0, behavior: "smooth" });
				}
				onItemClick?.("");
			} else {
				onItemClick?.(id);
				const el = document.getElementById(id);
				if (el) {
					el.scrollIntoView({ behavior: "smooth", block: "start" });
				}
			}
		},
		[inDetailPage, onItemClick, router],
	);

	const listRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!listRef.current) return;
		const selected = listRef.current.querySelector('[data-selected="true"]');
		if (selected) {
			selected.scrollIntoView({ block: "nearest", behavior: "smooth" });
		}
	}, [selectedId]);

	useEffect(() => {
		if (!showCategorySearch || !searchQuery.trim()) {
			setSearchHighlightIndex(-1);
			return;
		}
		setSearchHighlightIndex(filteredCategories.length > 0 ? 0 : -1);
	}, [filteredCategories.length, searchQuery, showCategorySearch]);

	useEffect(() => {
		if (searchHighlightIndex < 0 || !listRef.current) return;
		const items = listRef.current.querySelectorAll("[role=option]");
		const target = items[searchHighlightIndex] as HTMLElement | undefined;
		if (target) {
			target.scrollIntoView({ block: "nearest", behavior: "smooth" });
		}
	}, [searchHighlightIndex]);

	const handleSearchKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				searchInputRef.current?.blur();
				return;
			}
			if (!showCategorySearch || filteredCategories.length === 0) return;
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSearchHighlightIndex((prev) =>
					prev < filteredCategories.length - 1 ? prev + 1 : 0,
				);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSearchHighlightIndex((prev) =>
					prev > 0 ? prev - 1 : filteredCategories.length - 1,
				);
			} else if (e.key === "Enter" && searchHighlightIndex >= 0) {
				e.preventDefault();
				e.stopPropagation();
				(
					e.nativeEvent as KeyboardEvent & {
						stopImmediatePropagation?: () => void;
					}
				).stopImmediatePropagation?.();
				const target = filteredCategories[searchHighlightIndex];
				if (target) jumpTo(target.id);
			}
		},
		[showCategorySearch, filteredCategories, searchHighlightIndex, jumpTo],
	);

	return (
		<div className="h-full flex flex-col">
			{showCategorySearch && (
				<div className="px-3 pt-2 shrink-0 mb-2">
					<SearchField
						value={searchQuery}
						onChange={setSearchQuery}
						className="w-full"
					>
						<SearchField.Group>
							<SearchField.SearchIcon />
							<SearchField.Input
								ref={searchInputRef}
								placeholder="搜索分类..."
								onFocus={() => setSearchIndexReady(true)}
								onKeyDown={handleSearchKeyDown}
							/>
							<SearchField.ClearButton className="absolute right-0 cursor-pointer" />
						</SearchField.Group>
					</SearchField>
				</div>
			)}
			<div ref={listRef} className="flex-1 overflow-y-auto">
				{filteredCategories.length === 0 ? (
					<div className="flex items-center justify-center p-8">
						<EmptyState className="text-center">
							<p className="text-sm text-muted">暂无分类</p>
						</EmptyState>
					</div>
				) : (
					<ListBox
						aria-label="导航菜单"
						selectedKeys={selectedKeys}
						selectionMode="single"
						onSelectionChange={(keys) => {
							const first = [...keys][0];
							if (first) {
								setSearchHighlightIndex(-1);
								jumpTo(first);
							}
						}}
						className="px-2 *:px-4 *:font-medium"
					>
						{filteredCategories.map((c, index) => {
							const isChild = childIds.has(c.id);
							const siteCount = siteCounts.get(c.id) ?? 0;
							const isSearchHighlighted = index === searchHighlightIndex;
							return (
								<ListBoxItem
									key={c.id}
									id={c.id}
									textValue={c.name}
									className={`gap-2.5 rounded-xl data-[selected=true]:bg-(--primary-foreground)! data-[selected=true]:shadow! ${
										isChild ? "pl-8 text-sm" : ""
									} ${isSearchHighlighted ? "bg-default" : ""}`}
								>
									{hasAnyIcon || isChild ? (
										<span
											className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-sm leading-none"
											aria-hidden
										>
											<IconView
												icon={c.icon}
												size={16}
												textClassName="w-full"
											/>
										</span>
									) : (
										<GridIcon />
									)}
									<span className="flex-1 truncate">{c.name}</span>
									{siteCount > 0 && (
										<Chip size="sm" variant="soft" className="ml-auto">
											{siteCount}
										</Chip>
									)}
								</ListBoxItem>
							);
						})}
					</ListBox>
				)}
			</div>
			{showSubmissionAction && <SubmissionSidebarButton />}
		</div>
	);
});

function GridIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			aria-hidden
			className="shrink-0"
		>
			<rect
				x="2"
				y="2"
				width="5"
				height="5"
				rx="1"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<rect
				x="9"
				y="2"
				width="5"
				height="5"
				rx="1"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<rect
				x="2"
				y="9"
				width="5"
				height="5"
				rx="1"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<rect
				x="9"
				y="9"
				width="5"
				height="5"
				rx="1"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
		</svg>
	);
}
