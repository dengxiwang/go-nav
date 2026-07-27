"use client";

import type { Key } from "@heroui/react";
import {
	Button,
	Checkbox,
	CheckboxGroup,
	Chip,
	InputGroup,
	Label,
	ListBox,
	ProgressBar,
	Select,
	Spinner,
	Table,
	TableLayout,
	TextField,
	toast,
	Virtualizer,
} from "@heroui/react";
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	BiGlobe,
	BiPause,
	BiPlay,
	BiRefresh,
	BiSearch,
	BiTrash,
} from "react-icons/bi";
import { categoriesAtom } from "@/lib/store/admin";
import type { NavCategory, NavSite } from "@/types";
import { getIconImageSrc } from "@/lib/icon";
import { resolveSiteBackgroundColor, toPx } from "@/components/site-icon";
import Loading from "./loading";

type BatchStatus = "idle" | "running" | "pausing" | "paused" | "finished";
type RowStatus = "pending" | "running" | "success" | "failure";
type BatchUpdateField = "title" | "description" | "icon" | "previewImage";

interface BatchStats {
	processed: number;
	success: number;
	failure: number;
}

interface BatchSiteRow {
	key: string;
	statusKey: string;
	categoryId: string;
	categoryPath: string;
	siteIndex: number;
	title: string;
	url: string;
	description?: string;
	icon?: string;
	previewImage?: string;
	bgColor?: string;
	iconPadding?: string;
	hasDescription: boolean;
	hasIcon: boolean;
	hasPreviewImage: boolean;
}

interface CategoryFilterOption {
	id: string;
	name: string;
	path: string;
	level: number;
	siteCount: number;
	categoryIds: string[];
}

type SitePatch = Partial<
	Pick<
		NavSite,
		| "title"
		| "description"
		| "icon"
		| "previewImage"
		| "bgColor"
		| "iconPadding"
	>
>;

const UPDATE_FIELD_OPTIONS: Array<{
	value: BatchUpdateField;
	label: string;
}> = [
	{ value: "title", label: "名称" },
	{ value: "description", label: "描述" },
	{ value: "icon", label: "图标" },
	{ value: "previewImage", label: "预览图" },
];

const DEFAULT_UPDATE_FIELDS = UPDATE_FIELD_OPTIONS.map(
	(option) => option.value,
);

const TABLE_COLUMN_WIDTHS = {
	icon: 60,
	title: 140,
	description: 240,
	previewImage: 112,
	url: 240,
	category: 160,
	fields: 180,
	status: 100,
	actions: 76,
} as const;

const TABLE_MIN_WIDTH = Object.values(TABLE_COLUMN_WIDTHS).reduce(
	(total, width) => total + width,
	0,
);

const DEFAULT_BATCH_CONCURRENCY = 3;
const MIN_BATCH_CONCURRENCY = 1;
const MAX_BATCH_CONCURRENCY = 20;
const ALL_CATEGORY_FILTER_KEY = "__all_categories__";

function normalizeUpdateFields(values: string[]) {
	return UPDATE_FIELD_OPTIONS.filter((option) =>
		values.includes(option.value),
	).map((option) => option.value);
}

const EMPTY_STATS: BatchStats = {
	processed: 0,
	success: 0,
	failure: 0,
};

function createRowKey(categoryId: string, siteIndex: number, url: string) {
	return `${categoryId}:${siteIndex}:${url}`;
}

function createRowStatusKey(categoryId: string, siteIndex: number) {
	return `${categoryId}:${siteIndex}`;
}

function collectSiteRows(categories: NavCategory[]) {
	const rows: BatchSiteRow[] = [];
	const walk = (items: NavCategory[], path: string[]) => {
		for (const category of items) {
			const nextPath = [...path, category.name];
			for (const [siteIndex, site] of (category.sites ?? []).entries()) {
				rows.push({
					key: createRowKey(category.id, siteIndex, site.url),
					statusKey: createRowStatusKey(category.id, siteIndex),
					categoryId: category.id,
					categoryPath: nextPath.join(" / "),
					siteIndex,
					title: site.title,
					url: site.url,
					description: site.description,
					icon: site.icon,
					previewImage: site.previewImage,
					bgColor: site.bgColor,
					iconPadding: site.iconPadding,
					hasDescription: Boolean(site.description?.trim()),
					hasIcon: Boolean(site.icon?.trim()),
					hasPreviewImage: Boolean(site.previewImage?.trim()),
				});
			}
			if (category.children?.length) {
				walk(category.children, nextPath);
			}
		}
	};
	walk(categories, []);
	return rows;
}

function countSitesInCategory(category: NavCategory): number {
	return (
		(category.sites?.length ?? 0) +
		(category.children ?? []).reduce(
			(total, child) => total + countSitesInCategory(child),
			0,
		)
	);
}

function collectCategoryIds(category: NavCategory): string[] {
	return [
		category.id,
		...(category.children ?? []).flatMap((child) => collectCategoryIds(child)),
	];
}

function collectCategoryFilterOptions(categories: NavCategory[]) {
	const options: CategoryFilterOption[] = [];
	const walk = (items: NavCategory[], path: string[], level: number) => {
		for (const category of items) {
			const nextPath = [...path, category.name];
			const siteCount = countSitesInCategory(category);
			if (siteCount > 0) {
				options.push({
					id: category.id,
					name: category.name,
					path: nextPath.join(" / "),
					level,
					siteCount,
					categoryIds: collectCategoryIds(category),
				});
			}
			if (category.children?.length) {
				walk(category.children, nextPath, level + 1);
			}
		}
	};
	walk(categories, [], 0);
	return options;
}

function stringifyKeys(keys: Iterable<Key> | Key[] | null) {
	if (!keys) return [];
	return Array.from(keys, String);
}

function areStringArraysEqual(a: string[], b: string[]) {
	if (a.length !== b.length) return false;
	return a.every((item, index) => item === b[index]);
}

function patchSiteInCategories(
	categories: NavCategory[],
	row: BatchSiteRow,
	patch: SitePatch,
): { categories: NavCategory[]; patched: boolean } {
	let patched = false;
	const nextCategories = categories.map((category) => {
		if (category.id === row.categoryId) {
			const sites = category.sites ?? [];
			if (!sites[row.siteIndex]) return category;
			const nextSites = sites.slice();
			nextSites[row.siteIndex] = {
				...nextSites[row.siteIndex],
				...patch,
			};
			patched = true;
			return { ...category, sites: nextSites };
		}
		if (category.children?.length) {
			const childResult = patchSiteInCategories(category.children, row, patch);
			if (childResult.patched) {
				patched = true;
				return { ...category, children: childResult.categories };
			}
		}
		return category;
	});
	return { categories: nextCategories, patched };
}

async function fetchWebsitePatch(
	url: string,
	updateFields: BatchUpdateField[],
	signal?: AbortSignal,
) {
	if (!url.trim()) {
		throw new Error("缺少网站地址");
	}

	const needsSiteMeta = updateFields.some(
		(field) => field === "title" || field === "description" || field === "icon",
	);
	let data:
		| {
				title?: string;
				iconUrl?: string | null;
				description?: string;
		  }
		| undefined;
	if (needsSiteMeta) {
		const res = await fetch("/api/fetch-website/", {
			method: "POST",
			signal,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				url,
				fetchIcon: updateFields.includes("icon"),
			}),
		});
		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			throw new Error(err.error || "获取失败");
		}
		data = (await res.json()) as {
			title?: string;
			iconUrl?: string | null;
			description?: string;
		};
	}

	const patch: SitePatch = {};
	const fields: string[] = [];
	const title = data?.title?.trim();
	const description = data?.description?.trim();
	const shouldUpdateTitle = updateFields.includes("title");
	const shouldUpdateDescription = updateFields.includes("description");
	const shouldUpdateIcon = updateFields.includes("icon");
	const shouldUpdatePreviewImage = updateFields.includes("previewImage");

	if (shouldUpdateTitle && title) {
		patch.title = title;
		fields.push("名称");
	}
	if (shouldUpdateDescription && description) {
		patch.description = description;
		fields.push("描述");
	}
	if (shouldUpdateIcon && data?.iconUrl) {
		patch.icon = data.iconUrl;
		fields.push("图标");
	}
	if (shouldUpdatePreviewImage) {
		try {
			const previewRes = await fetch("/api/tools/capturePreview/", {
				method: "POST",
				signal,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url }),
			});
			if (previewRes.ok) {
				const previewData = (await previewRes.json()) as { url?: string };
				if (previewData.url) {
					patch.previewImage = previewData.url;
					fields.push("预览图");
				}
			}
		} catch {
			// 预览图抓取失败时仍保留其它已更新字段。
		}
	}

	if (fields.length === 0) {
		throw new Error("未获取到选中字段的可更新信息");
	}

	return { patch, fields };
}

function isAbortError(error: unknown) {
	return (
		(error instanceof DOMException && error.name === "AbortError") ||
		(error instanceof Error && error.name === "AbortError")
	);
}

function clampConcurrency(value: number) {
	if (!Number.isFinite(value)) return DEFAULT_BATCH_CONCURRENCY;
	return Math.min(
		MAX_BATCH_CONCURRENCY,
		Math.max(MIN_BATCH_CONCURRENCY, Math.floor(value)),
	);
}

export function BatchOperationsEditor() {
	const [categories, setCategories] = useAtom(categoriesAtom);
	const allRows = useMemo(() => collectSiteRows(categories), [categories]);
	const allRowsSignature = useMemo(
		() => allRows.map((row) => row.key).join("|"),
		[allRows],
	);
	const [queueRows, setQueueRows] = useState<BatchSiteRow[]>(() =>
		collectSiteRows(categories),
	);
	const [rowStatusMap, setRowStatusMap] = useState<Record<string, RowStatus>>(
		{},
	);
	const [rowErrorMap, setRowErrorMap] = useState<Record<string, string>>({});
	const [status, setStatus] = useState<BatchStatus>("idle");
	const [stats, setStats] = useState<BatchStats>(EMPTY_STATS);
	const [search, setSearch] = useState("");
	const [selectedFields, setSelectedFields] = useState<string[]>(
		DEFAULT_UPDATE_FIELDS,
	);
	const [selectedCategoryKeys, setSelectedCategoryKeys] = useState<string[]>([
		ALL_CATEGORY_FILTER_KEY,
	]);
	const [concurrencyInput, setConcurrencyInput] = useState(
		String(DEFAULT_BATCH_CONCURRENCY),
	);
	const [isClientReady, setIsClientReady] = useState(false);
	const [activeRow, setActiveRow] = useState<BatchSiteRow | null>(null);
	const categoriesRef = useRef(categories);
	const queueRowsRef = useRef(queueRows);
	const rowStatusRef = useRef(rowStatusMap);
	const rowErrorRef = useRef(rowErrorMap);
	const statsRef = useRef<BatchStats>(EMPTY_STATS);
	const pauseRequestedRef = useRef(false);
	const runningRef = useRef(false);
	const requestAbortMapRef = useRef<Map<string, AbortController>>(new Map());
	const sourceSignatureRef = useRef(allRowsSignature);
	const selectedUpdateFields = useMemo(
		() => normalizeUpdateFields(selectedFields),
		[selectedFields],
	);
	const categoryOptions = useMemo(
		() => collectCategoryFilterOptions(categories),
		[categories],
	);
	const categoryOptionIds = useMemo(
		() => categoryOptions.map((option) => option.id),
		[categoryOptions],
	);
	const categoryOptionIdSet = useMemo(
		() => new Set(categoryOptionIds),
		[categoryOptionIds],
	);
	const activeCategoryIdSet = useMemo(() => {
		if (selectedCategoryKeys.includes(ALL_CATEGORY_FILTER_KEY)) return null;
		const selectedCategoryIds = new Set<string>();
		for (const option of categoryOptions) {
			if (!selectedCategoryKeys.includes(option.id)) continue;
			for (const categoryId of option.categoryIds) {
				selectedCategoryIds.add(categoryId);
			}
		}
		return selectedCategoryIds;
	}, [categoryOptions, selectedCategoryKeys]);
	const isAllCategoriesSelected = activeCategoryIdSet === null;
	const selectedCategoryLabel = isAllCategoriesSelected
		? "全部分类"
		: `已选 ${selectedCategoryKeys.length} 个分类`;
	const concurrency = useMemo(
		() => clampConcurrency(Number.parseInt(concurrencyInput, 10)),
		[concurrencyInput],
	);

	useEffect(() => {
		categoriesRef.current = categories;
	}, [categories]);

	useEffect(() => {
		queueRowsRef.current = queueRows;
	}, [queueRows]);

	useEffect(() => {
		rowStatusRef.current = rowStatusMap;
	}, [rowStatusMap]);

	useEffect(() => {
		rowErrorRef.current = rowErrorMap;
	}, [rowErrorMap]);

	useEffect(() => {
		setIsClientReady(true);
	}, []);

	const resetProgress = useCallback(() => {
		rowStatusRef.current = {};
		rowErrorRef.current = {};
		statsRef.current = EMPTY_STATS;
		setRowStatusMap({});
		setRowErrorMap({});
		setStats(EMPTY_STATS);
		setActiveRow(null);
	}, []);

	useEffect(() => {
		if (selectedCategoryKeys.includes(ALL_CATEGORY_FILTER_KEY)) return;
		const validKeys = selectedCategoryKeys.filter((key) =>
			categoryOptionIdSet.has(key),
		);
		const nextKeys =
			validKeys.length > 0 ? validKeys : [ALL_CATEGORY_FILTER_KEY];
		if (areStringArraysEqual(selectedCategoryKeys, nextKeys)) return;
		setSelectedCategoryKeys(nextKeys);
	}, [categoryOptionIdSet, selectedCategoryKeys]);

	const handleCategoryFilterChange = useCallback(
		(keys: Key[] | null) => {
			const incomingKeys = stringifyKeys(keys);
			const specificKeys = incomingKeys.filter((key) =>
				categoryOptionIdSet.has(key),
			);
			const hasAll = incomingKeys.includes(ALL_CATEGORY_FILTER_KEY);
			let nextKeys: string[];

			if (incomingKeys.length === 0) {
				nextKeys = [ALL_CATEGORY_FILTER_KEY];
			} else if (
				hasAll &&
				selectedCategoryKeys.includes(ALL_CATEGORY_FILTER_KEY) &&
				specificKeys.length > 0
			) {
				nextKeys = specificKeys;
			} else if (hasAll) {
				nextKeys = [ALL_CATEGORY_FILTER_KEY];
			} else {
				nextKeys =
					specificKeys.length > 0 ? specificKeys : [ALL_CATEGORY_FILTER_KEY];
			}

			if (areStringArraysEqual(selectedCategoryKeys, nextKeys)) return;
			setSelectedCategoryKeys(nextKeys);
			if (!runningRef.current) {
				setStatus("idle");
				resetProgress();
			}
		},
		[categoryOptionIdSet, resetProgress, selectedCategoryKeys],
	);

	useEffect(() => {
		if (sourceSignatureRef.current === allRowsSignature) return;
		sourceSignatureRef.current = allRowsSignature;
		if (runningRef.current) return;
		queueRowsRef.current = allRows;
		setQueueRows(allRows);
		setSearch("");
		setStatus("idle");
		resetProgress();
	}, [allRows, allRowsSignature, resetProgress]);

	const setRowStatus = useCallback((key: string, nextStatus: RowStatus) => {
		const next = { ...rowStatusRef.current, [key]: nextStatus };
		rowStatusRef.current = next;
		setRowStatusMap(next);
		// Force virtualized row re-render: some table virtualizers only refresh when row item object changes.
		const nextQueue = queueRowsRef.current.map((item) =>
			item.statusKey === key ? { ...item } : item,
		);
		queueRowsRef.current = nextQueue;
		setQueueRows(nextQueue);
	}, []);

	const setRowError = useCallback((key: string, error: string | null) => {
		const next = { ...rowErrorRef.current };
		if (error) {
			next[key] = error;
		} else {
			delete next[key];
		}
		rowErrorRef.current = next;
		setRowErrorMap(next);
	}, []);

	const updateQueueRow = useCallback((row: BatchSiteRow, patch: SitePatch) => {
		const nextQueue = queueRowsRef.current.map((item) => {
			if (item.key !== row.key) return item;
			return {
				...item,
				title: patch.title ?? item.title,
				description: patch.description ?? item.description,
				icon: patch.icon ?? item.icon,
				previewImage: patch.previewImage ?? item.previewImage,
				bgColor: patch.bgColor ?? item.bgColor,
				iconPadding: patch.iconPadding ?? item.iconPadding,
				hasDescription: item.hasDescription || Boolean(patch.description),
				hasIcon: item.hasIcon || Boolean(patch.icon),
				hasPreviewImage: item.hasPreviewImage || Boolean(patch.previewImage),
			};
		});
		queueRowsRef.current = nextQueue;
		setQueueRows(nextQueue);
	}, []);

	const applyPatch = useCallback(
		(row: BatchSiteRow, patch: SitePatch) => {
			const result = patchSiteInCategories(categoriesRef.current, row, patch);
			if (!result.patched) return false;
			categoriesRef.current = result.categories;
			setCategories(result.categories);
			updateQueueRow(row, patch);
			return true;
		},
		[setCategories, updateQueueRow],
	);

	const removeRow = (row: BatchSiteRow) => {
		const nextQueue = queueRowsRef.current.filter(
			(item) => item.key !== row.key,
		);
		const nextStatusMap = { ...rowStatusRef.current };
		const nextErrorMap = { ...rowErrorRef.current };
		delete nextStatusMap[row.statusKey];
		delete nextErrorMap[row.statusKey];
		queueRowsRef.current = nextQueue;
		rowStatusRef.current = nextStatusMap;
		rowErrorRef.current = nextErrorMap;
		setQueueRows(nextQueue);
		setRowStatusMap(nextStatusMap);
		setRowErrorMap(nextErrorMap);
	};

	const restoreAllRows = () => {
		if (runningRef.current) return;
		queueRowsRef.current = allRows;
		setQueueRows(allRows);
		setSearch("");
		setSelectedCategoryKeys([ALL_CATEGORY_FILTER_KEY]);
		setStatus("idle");
		resetProgress();
	};

	const getScopedRows = useCallback(
		(rows: BatchSiteRow[]) => {
			if (!activeCategoryIdSet) return rows;
			return rows.filter((row) => activeCategoryIdSet.has(row.categoryId));
		},
		[activeCategoryIdSet],
	);

	const runBatch = useCallback(
		async (resetBeforeRun: boolean) => {
			if (runningRef.current) return;
			const currentQueue = getScopedRows(queueRowsRef.current);
			if (currentQueue.length === 0) {
				toast.warning(
					isAllCategoriesSelected
						? "待更新列表为空"
						: "当前分类筛选下没有待更新网址",
				);
				return;
			}
			if (selectedUpdateFields.length === 0) {
				toast.warning("请至少选择一项更新信息");
				return;
			}

			runningRef.current = true;
			pauseRequestedRef.current = false;
			setStatus("running");

			if (resetBeforeRun) {
				resetProgress();
			}

			const rows = getScopedRows(queueRowsRef.current);
			let cursor = 0;

			const consumeNextRow = () => {
				while (cursor < rows.length) {
					const row = rows[cursor];
					cursor += 1;
					const currentRowStatus =
						rowStatusRef.current[row.statusKey] ?? "pending";
					if (
						currentRowStatus === "success" ||
						currentRowStatus === "failure"
					) {
						continue;
					}
					return row;
				}
				return null;
			};

			const markStats = (next: BatchStats) => {
				statsRef.current = next;
				setStats(next);
			};

			const worker = async () => {
				while (!pauseRequestedRef.current) {
					const row = consumeNextRow();
					if (!row) return;

					setActiveRow(row);
					setRowStatus(row.statusKey, "running");
					const requestAbort = new AbortController();
					requestAbortMapRef.current.set(row.statusKey, requestAbort);

					try {
						const { patch } = await fetchWebsitePatch(
							row.url,
							selectedUpdateFields,
							requestAbort.signal,
						);
						const patched = applyPatch(row, patch);
						if (!patched) {
							throw new Error("网址位置已变化");
						}
						markStats({
							processed: statsRef.current.processed + 1,
							success: statsRef.current.success + 1,
							failure: statsRef.current.failure,
						});
						setRowError(row.statusKey, null);
						setRowStatus(row.statusKey, "success");
					} catch (e) {
						if (pauseRequestedRef.current && isAbortError(e)) {
							setRowError(row.statusKey, null);
							setRowStatus(row.statusKey, "pending");
							return;
						}
						const message = e instanceof Error ? e.message : "获取失败";
						markStats({
							processed: statsRef.current.processed + 1,
							success: statsRef.current.success,
							failure: statsRef.current.failure + 1,
						});
						setRowError(row.statusKey, message);
						setRowStatus(row.statusKey, "failure");
					} finally {
						requestAbortMapRef.current.delete(row.statusKey);
					}
				}
			};

			const workerCount = Math.min(concurrency, rows.length);
			await Promise.all(Array.from({ length: workerCount }, () => worker()));

			runningRef.current = false;
			setActiveRow(null);

			if (pauseRequestedRef.current) {
				setStatus("paused");
				return;
			}

			setStatus("finished");
			toast.success("批量更新完成，记得点击保存");
		},
		[
			applyPatch,
			concurrency,
			getScopedRows,
			isAllCategoriesSelected,
			resetProgress,
			selectedUpdateFields,
			setRowError,
			setRowStatus,
		],
	);

	const pauseBatch = () => {
		if (!runningRef.current) return;
		pauseRequestedRef.current = true;
		for (const controller of requestAbortMapRef.current.values()) {
			controller.abort();
		}
		requestAbortMapRef.current.clear();
		setStatus("pausing");
	};

	const scopedQueueRows = useMemo(
		() => getScopedRows(queueRows),
		[getScopedRows, queueRows],
	);
	const total = scopedQueueRows.length;
	const removedCount = Math.max(allRows.length - queueRows.length, 0);
	const isRunning = status === "running" || status === "pausing";
	const canEditQueue = status === "idle" || status === "paused";
	const progressValue = total > 0 ? stats.processed : 0;

	const filteredRows = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return scopedQueueRows;
		return scopedQueueRows.filter(
			(row) =>
				row.title.toLowerCase().includes(q) ||
				row.url.toLowerCase().includes(q) ||
				row.categoryPath.toLowerCase().includes(q),
		);
	}, [scopedQueueRows, search]);

	if (!isClientReady) {
		return <Loading />;
	}

	return (
		<div className="flex min-h-[calc(100dvh-106px)] flex-col gap-4">
			<div className="flex items-center gap-2 rounded-lg border border-default bg-default/20 px-3 py-2 text-xs">
				{activeRow ? (
					<>
						<Spinner size="sm" />
						<span className="shrink-0 font-medium">正在更新</span>
						<span className="min-w-0 truncate font-medium">
							{activeRow.title || activeRow.url}
						</span>
						<span className="hidden min-w-0 truncate text-default-500 sm:block">
							{activeRow.categoryPath}
						</span>
						<div className="hidden h-3 w-px shrink-0 bg-default sm:block" />
						<span className="hidden min-w-0 truncate text-default-500 md:block">
							{activeRow.url}
						</span>
					</>
				) : (
					<>
						<BiGlobe className="size-4 shrink-0 text-default-500" />
						<span
							className="shrink-0 font-medium truncate"
							style={{
								width: "calc(100% - 24px)",
							}}
						>
							待开始更新，在更新前，请在下方筛选您要更新的信息范围：名称、描述、图标、预览图！
						</span>
					</>
				)}
			</div>
			<div className="flex flex-col gap-3">
				<div className="flex flex-wrap gap-3 gap-y-2 justify-between items-center">
					<div className="flex flex-wrap items-center gap-2">
						<Chip size="sm" variant="secondary" className="h-7 px-2.5 text-xs!">
							待更新 {total}
						</Chip>
						<Chip size="sm" variant="secondary" className="h-7 px-2.5 text-xs!">
							已移除 {removedCount}
						</Chip>
						<Chip size="sm" variant="secondary" className="h-7 px-2.5 text-xs!">
							已获取 {stats.processed}
						</Chip>
						<Chip
							size="sm"
							variant="soft"
							color="success"
							className="h-7 px-2.5 text-xs!"
						>
							成功 {stats.success}
						</Chip>
						<Chip
							size="sm"
							variant="soft"
							color="danger"
							className="h-7 px-2.5 text-xs!"
						>
							失败 {stats.failure}
						</Chip>
					</div>
					<div className="flex flex-wrap items-center gap-2 pl-1">
						<TextField
							className="w-28 flex flex-row items-center"
							value={concurrencyInput}
							onChange={setConcurrencyInput}
							isDisabled={isRunning}
						>
							<Label className="text-default-500 text-nowrap">并发：</Label>
							<InputGroup className={"flex-1"}>
								<InputGroup.Input
									type="number"
									min={MIN_BATCH_CONCURRENCY}
									max={MAX_BATCH_CONCURRENCY}
								/>
							</InputGroup>
						</TextField>
						{isRunning ? (
							<Button
								variant="outline"
								size="sm"
								className="h-9"
								isDisabled={status === "pausing"}
								onPress={pauseBatch}
							>
								<BiPause className="size-4" />
								<span>{status === "pausing" ? "暂停中..." : "暂停"}</span>
							</Button>
						) : status === "paused" ? (
							<Button
								variant="primary"
								size="sm"
								className="h-9"
								isDisabled={total === 0 || selectedUpdateFields.length === 0}
								onPress={() => void runBatch(false)}
							>
								<BiPlay className="size-4" />
								<span>继续</span>
							</Button>
						) : (
							<Button
								variant="primary"
								size="sm"
								className="h-9"
								isDisabled={total === 0 || selectedUpdateFields.length === 0}
								onPress={() => void runBatch(true)}
							>
								<BiPlay className="size-4" />
								<span>开始更新</span>
							</Button>
						)}
						{(status === "paused" || status === "finished") && (
							<Button
								variant="outline"
								size="sm"
								className="h-9"
								isDisabled={total === 0 || selectedUpdateFields.length === 0}
								onPress={() => void runBatch(true)}
							>
								<BiRefresh className="size-4" />
								<span>重新开始</span>
							</Button>
						)}
					</div>
				</div>

				<div className="flex items-center gap-3 px-1">
					<span className="shrink-0 font-medium text-default-500">进度</span>
					<ProgressBar
						aria-label="批量更新进度"
						className="min-w-0 flex-1"
						value={progressValue}
						maxValue={Math.max(total, 1)}
						valueLabel={`${progressValue}/${total}`}
					>
						<ProgressBar.Track className="h-1.5">
							<ProgressBar.Fill />
						</ProgressBar.Track>
					</ProgressBar>
					<span className="w-14 shrink-0 text-right text-xs tabular-nums text-default-500">
						{progressValue}/{total}
					</span>
				</div>
			</div>

			<section className="flex min-h-0 flex-1 flex-col gap-3 border-t border-gray-100 pt-4 dark:border-neutral-800">
				<div className="flex justify-between items-center flex-wrap gap-3">
					<CheckboxGroup
						name="batch-update-fields"
						value={selectedFields}
						onChange={setSelectedFields}
						isDisabled={isRunning}
						isInvalid={selectedUpdateFields.length === 0}
						className="min-w-0 gap-2 pl-1"
					>
						<div className="flex flex-wrap items-center gap-2">
							<Label className="text-sm font-medium">更新信息</Label>
							{selectedUpdateFields.length === 0 && (
								<Chip
									size="sm"
									variant="soft"
									color="danger"
									className="h-5 px-2 text-xs!"
								>
									至少选择一项
								</Chip>
							)}
						</div>
						<div className="flex flex-wrap gap-x-4 gap-y-2">
							{UPDATE_FIELD_OPTIONS.map((option) => (
								<UpdateFieldCheckbox
									key={option.value}
									value={option.value}
									label={option.label}
								/>
							))}
						</div>
					</CheckboxGroup>
					<div className="flex max-w-full items-center justify-start gap-2">
						<div className="flex min-w-0 flex-1 items-center gap-2 sm:w-auto sm:flex-none">
							<Select
								className="min-w-0 flex-1 sm:w-56 sm:flex-none"
								placeholder="全部分类"
								selectionMode="multiple"
								value={selectedCategoryKeys}
								onChange={handleCategoryFilterChange}
								isDisabled={isRunning || categoryOptions.length === 0}
							>
								<Label className="sr-only">筛选分类</Label>
								<Select.Trigger className="h-9">
									<Select.Value className="truncate">
										{() => selectedCategoryLabel}
									</Select.Value>
									<Select.Indicator />
								</Select.Trigger>
								<Select.Popover>
									<ListBox selectionMode="multiple">
										<ListBox.Item
											id={ALL_CATEGORY_FILTER_KEY}
											textValue="全部分类"
											className="pr-10"
										>
											<span className="flex min-w-0 flex-1 items-center gap-3">
												<span className="truncate font-medium">全部分类</span>
												<Chip size="sm">{queueRows.length}</Chip>
											</span>
											<ListBox.ItemIndicator />
										</ListBox.Item>
										{categoryOptions.map((option) => (
											<ListBox.Item
												key={option.id}
												id={option.id}
												textValue={option.path}
												className="pr-10"
											>
												<span className="flex min-w-0 flex-1 items-center gap-3">
													<span className="min-w-0 truncate">
														{"　".repeat(option.level)}
														{option.name}
													</span>
													<Chip size="sm">{option.siteCount}</Chip>
												</span>
												<ListBox.ItemIndicator />
											</ListBox.Item>
										))}
									</ListBox>
								</Select.Popover>
							</Select>
							<TextField
								className="h-9 min-w-0 flex-1 sm:w-64 sm:flex-none"
								value={search}
								onChange={setSearch}
							>
								<Label className="sr-only">搜索待更新网址</Label>
								<InputGroup>
									<InputGroup.Prefix>
										<BiSearch className="size-4 text-default-500" />
									</InputGroup.Prefix>
									<InputGroup.Input
										placeholder="搜索名称、网址或分类..."
										style={{
											maxWidth: "calc(100% - 40px)",
										}}
									/>
								</InputGroup>
							</TextField>
						</div>
						<Button
							variant="outline"
							size="sm"
							className="h-9 shrink-0"
							isDisabled={isRunning || removedCount === 0}
							onPress={restoreAllRows}
						>
							<BiRefresh className="size-4" />
							<span>恢复全部</span>
						</Button>
					</div>
				</div>

				<Virtualizer
					layout={TableLayout}
					layoutOptions={{
						headingHeight: 36,
						rowHeight: 42,
					}}
				>
					<Table
						aria-label="待更新网址列表"
						className="overflow-hidden rounded-xl border border-default"
					>
						<Table.ScrollContainer>
							<Table.Content
								aria-label="待更新网址列表"
								className="h-full min-h-96 max-h-[calc(100dvh-324px)] w-full overflow-y-scroll"
								style={{ minWidth: TABLE_MIN_WIDTH }}
							>
								<Table.Header className="h-full w-full">
									<Table.Column id="icon" width={TABLE_COLUMN_WIDTHS.icon}>
										图标
									</Table.Column>
									<Table.Column
										isRowHeader
										id="title"
										minWidth={TABLE_COLUMN_WIDTHS.title}
									>
										名称
									</Table.Column>
									<Table.Column
										id="description"
										minWidth={TABLE_COLUMN_WIDTHS.description}
									>
										描述
									</Table.Column>
									<Table.Column
										id="previewImage"
										width={TABLE_COLUMN_WIDTHS.previewImage}
									>
										预览图
									</Table.Column>
									<Table.Column id="url" minWidth={TABLE_COLUMN_WIDTHS.url}>
										URL
									</Table.Column>
									<Table.Column
										id="category"
										minWidth={TABLE_COLUMN_WIDTHS.category}
									>
										分类
									</Table.Column>
									<Table.Column
										id="fields"
										minWidth={TABLE_COLUMN_WIDTHS.fields}
									>
										已有信息
									</Table.Column>
									<Table.Column id="status" width={TABLE_COLUMN_WIDTHS.status}>
										状态
									</Table.Column>
									<Table.Column
										id="actions"
										width={TABLE_COLUMN_WIDTHS.actions}
									>
										操作
									</Table.Column>
								</Table.Header>
								<Table.Body
									items={filteredRows}
									renderEmptyState={() => (
										<div className="py-12 text-center text-sm text-default-500">
											{queueRows.length === 0
												? "待更新列表为空"
												: scopedQueueRows.length === 0
													? "当前分类筛选下没有待更新网址"
													: "没有匹配的网址"}
										</div>
									)}
								>
									{(row) => {
										const rowStatus = rowStatusMap[row.statusKey] ?? "pending";
										const rowError = rowErrorMap[row.statusKey];
										const canRemove =
											canEditQueue && rowStatus === "pending" && !isRunning;
										return (
											<Table.Row id={row.key} textValue={row.title || row.url}>
												<Table.Cell className={"flex items-center"}>
													<div
														className="flex h-7 w-7 items-center justify-center rounded-md"
														style={{
															backgroundColor: resolveSiteBackgroundColor(
																row.bgColor,
															),
															padding: toPx(row.iconPadding) || undefined,
														}}
													>
														{row.icon ? (
															(() => {
																const iconSrc = getIconImageSrc(row.icon);
																return iconSrc ? (
																	// 图标来源可为用户上传地址/外链，列表中使用原生 img 以避免 next/image 额外约束。
																	// eslint-disable-next-line @next/next/no-img-element
																	<img
																		src={iconSrc}
																		alt={row.title}
																		className="h-5 w-5 object-contain"
																	/>
																) : (
																	<span className="flex h-5 w-5 items-center justify-center text-sm">
																		{row.icon}
																	</span>
																);
															})()
														) : (
															<div className="h-5 w-5" />
														)}
													</div>
												</Table.Cell>
												<Table.Cell className={"flex items-center"}>
													<div className="truncate font-medium text-xs">
														{row.title || "-"}
													</div>
												</Table.Cell>
												<Table.Cell className={"flex items-center"}>
													<div className="truncate text-xs text-default-500">
														{row.description || "-"}
													</div>
												</Table.Cell>
												<Table.Cell className={"flex items-center"}>
													{row.previewImage ? (
														// eslint-disable-next-line @next/next/no-img-element
														<img
															src={row.previewImage}
															alt={row.title}
															className="h-7 w-12 rounded border border-default object-cover"
														/>
													) : (
														<span className="text-xs text-default-400">-</span>
													)}
												</Table.Cell>
												<Table.Cell className={"flex items-center"}>
													<div className="max-w-80 truncate text-xs text-default-500">
														{row.url}
													</div>
												</Table.Cell>
												<Table.Cell className={"flex items-center"}>
													<div className="max-w-56 truncate text-xs text-default-500">
														{row.categoryPath}
													</div>
												</Table.Cell>
												<Table.Cell className={"flex items-center"}>
													<div className="flex flex-nowrap gap-1.5">
														<InfoChip active>名称</InfoChip>
														<InfoChip active={row.hasDescription}>
															描述
														</InfoChip>
														<InfoChip active={row.hasIcon}>图标</InfoChip>
														<InfoChip active={row.hasPreviewImage}>
															预览图
														</InfoChip>
													</div>
												</Table.Cell>
												<Table.Cell className={"flex items-center"}>
													<RowStatusChip status={rowStatus} error={rowError} />
												</Table.Cell>
												<Table.Cell className={"flex items-center"}>
													<Button
														isIconOnly
														size="sm"
														variant="outline"
														className="h-7 w-7 text-danger"
														aria-label="移除网址"
														isDisabled={!canRemove}
														onPress={() => removeRow(row)}
													>
														<BiTrash className="size-4" />
													</Button>
												</Table.Cell>
											</Table.Row>
										);
									}}
								</Table.Body>
							</Table.Content>
						</Table.ScrollContainer>
					</Table>
				</Virtualizer>
			</section>
		</div>
	);
}

function UpdateFieldCheckbox({
	value,
	label,
}: {
	value: BatchUpdateField;
	label: string;
}) {
	return (
		<Checkbox value={value} className="items-center gap-2 mt-0">
			<Checkbox.Control>
				<Checkbox.Indicator />
			</Checkbox.Control>
			<Checkbox.Content>
				<Label className="text-sm">{label}</Label>
			</Checkbox.Content>
		</Checkbox>
	);
}

function InfoChip({
	active,
	children,
}: {
	active: boolean;
	children: React.ReactNode;
}) {
	return (
		<Chip
			size="sm"
			variant="secondary"
			className={
				active
					? "h-5 px-1.5 text-xs! text-default-700"
					: "h-5 px-1.5 text-xs! text-default-400"
			}
		>
			{children}
		</Chip>
	);
}

function RowStatusChip({
	status,
	error,
}: {
	status: RowStatus;
	error?: string;
}) {
	const content =
		status === "running"
			? "更新中"
			: status === "success"
				? "成功"
				: status === "failure"
					? "失败"
					: "待更新";
	const className =
		status === "success"
			? "h-5 px-2 text-xs! text-success"
			: status === "failure"
				? "h-5 px-2 text-xs! text-danger"
				: status === "running"
					? "h-5 px-2 text-xs! text-primary"
					: "h-5 px-2 text-xs!";
	return (
		<Chip
			size="sm"
			variant="secondary"
			className={className}
			title={status === "failure" ? error : undefined}
		>
			{content}
		</Chip>
	);
}
