"use client";

import {
	Alert,
	Button,
	Chip,
	Drawer,
	InputGroup,
	Label,
	Link,
	Table,
	TextArea,
	TextField,
	toast,
	cn,
	useOverlayState,
} from "@heroui/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
	BiFolderOpen,
	BiImport,
	BiMenu,
	BiSearch,
	BiTrash,
	BiUpload,
	BiX,
} from "react-icons/bi";
import {
	mergeWebsiteData,
	parseBookmarksHtml,
	summarizeWebsiteData,
	type BookmarkImportResult,
} from "@/lib/bookmark-import";
import { AdminSwitch } from "./admin-switch";
import { getIconImageSrc } from "@/lib/icon";
import { applyImportAtom, categoriesAtom } from "@/lib/store/admin";
import type { NavSite, WebsiteData } from "@/types";

interface PickedFileMeta {
	name: string;
	size: number;
}

interface PreviewChildCategory {
	id: string;
	name: string;
	siteCount: number;
	sites: NavSite[];
}

interface PreviewTopCategory {
	id: string;
	name: string;
	childCount: number;
	totalSites: number;
	willMerge: boolean;
	children: PreviewChildCategory[];
}

interface PreviewSiteRow {
	childId: string;
	childName: string;
	site: NavSite;
	uniqueKey: string;
}

export function ExternalImportEditor() {
	const applyImport = useSetAtom(applyImportAtom);
	const existingCategories = useAtomValue(categoriesAtom);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [sourceHtml, setSourceHtml] = useState("");
	const [pickedFile, setPickedFile] = useState<PickedFileMeta | null>(null);
	const [importedResult, setImportedResult] = useState<BookmarkImportResult | null>(
		null,
	);
	const [parsing, setParsing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [keepExisting, setKeepExisting] = useState(true);
	const [selectedTopCategory, setSelectedTopCategory] = useState<string | null>(
		null,
	);
	const [selectedChildFilter, setSelectedChildFilter] = useState<string>("all");
	const [search, setSearch] = useState("");
	const mobileDrawerState = useOverlayState();

	const existingWebsiteData = useMemo<WebsiteData>(
		() => ({ categories: existingCategories }),
		[existingCategories],
	);
	const existingSummary = useMemo(
		() => summarizeWebsiteData(existingWebsiteData),
		[existingWebsiteData],
	);
	const importedWebsiteData = importedResult?.websiteData ?? null;
	const effectiveWebsiteData = useMemo(() => {
		if (!importedWebsiteData) return null;
		return keepExisting
			? mergeWebsiteData(existingWebsiteData, importedWebsiteData)
			: importedWebsiteData;
	}, [existingWebsiteData, importedWebsiteData, keepExisting]);
	const effectiveSummary = useMemo(
		() => (effectiveWebsiteData ? summarizeWebsiteData(effectiveWebsiteData) : null),
		[effectiveWebsiteData],
	);

	const existingTopCategoryKeys = useMemo(() => {
		return new Set(
			existingCategories.map((category) => normalizeNameKey(category.name)),
		);
	}, [existingCategories]);

	const previewCategories = useMemo<PreviewTopCategory[]>(() => {
		const categories = importedWebsiteData?.categories ?? [];
		return categories.map((category) => {
			const children = (category.children ?? []).map((child) => ({
				id: child.id,
				name: child.name,
				siteCount: child.sites?.length ?? 0,
				sites: child.sites ?? [],
			}));
			return {
				id: category.id,
				name: category.name,
				childCount: children.length,
				totalSites: children.reduce((sum, child) => sum + child.siteCount, 0),
				willMerge: existingTopCategoryKeys.has(normalizeNameKey(category.name)),
				children,
			};
		});
	}, [existingTopCategoryKeys, importedWebsiteData]);

	useEffect(() => {
		if (previewCategories.length === 0) {
			setSelectedTopCategory(null);
			setSelectedChildFilter("all");
			setSearch("");
			return;
		}

		if (!previewCategories.some((category) => category.id === selectedTopCategory)) {
			setSelectedTopCategory(previewCategories[0].id);
			setSelectedChildFilter("all");
			setSearch("");
		}
	}, [previewCategories, selectedTopCategory]);

	const currentTopCategory = useMemo(
		() =>
			previewCategories.find((category) => category.id === selectedTopCategory) ??
			null,
		[previewCategories, selectedTopCategory],
	);

	const currentSiteRows = useMemo<PreviewSiteRow[]>(() => {
		if (!currentTopCategory) return [];
		return currentTopCategory.children.flatMap((child) =>
			child.sites.map((site, index) => ({
				childId: child.id,
				childName: child.name,
				site,
				uniqueKey: `${child.id}-${site.url}-${site.title}-${index}`,
			})),
		);
	}, [currentTopCategory]);

	const filteredSiteRows = useMemo(() => {
		const normalizedQuery = search.trim().toLowerCase();
		return currentSiteRows.filter((row) => {
			if (selectedChildFilter !== "all" && row.childId !== selectedChildFilter) {
				return false;
			}
			if (!normalizedQuery) return true;
			return (
				row.site.title.toLowerCase().includes(normalizedQuery) ||
				row.site.url.toLowerCase().includes(normalizedQuery) ||
				row.childName.toLowerCase().includes(normalizedQuery) ||
				(row.site.description ?? "").toLowerCase().includes(normalizedQuery)
			);
		});
	}, [currentSiteRows, search, selectedChildFilter]);

	const handleSourceChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		setSourceHtml(event.target.value);
		setImportedResult(null);
		setError(null);
	};

	const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const input = event.currentTarget;
		const file = input.files?.[0];
		if (!file) return;

		try {
			const text = await file.text();
			setSourceHtml(text);
			setPickedFile({
				name: file.name,
				size: file.size,
			});
			setImportedResult(null);
			setError(null);
			toast.success("书签文件已载入，可以先解析预览");
		} catch (e) {
			setError((e as Error).message);
		} finally {
			input.value = "";
		}
	};

	const handleParse = async () => {
		if (parsing) return;
		setParsing(true);
		setError(null);
		try {
			const result = parseBookmarksHtml(sourceHtml);
			setImportedResult(result);
			toast.success("书签解析成功，请确认预览后再导入");
		} catch (e) {
			setImportedResult(null);
			setError((e as Error).message);
		} finally {
			setParsing(false);
		}
	};

	const handleApply = () => {
		if (!effectiveWebsiteData) return;
		applyImport({ websiteData: effectiveWebsiteData });
		toast.success(
			keepExisting
				? "书签已追加到当前编辑状态，请点击顶部保存按钮生效"
				: "书签已替换当前分类数据，请点击顶部保存按钮生效",
		);
	};

	const handleReset = () => {
		setSourceHtml("");
		setPickedFile(null);
		setImportedResult(null);
		setError(null);
		setSelectedTopCategory(null);
		setSelectedChildFilter("all");
		setSearch("");
	};

	const handleSelectTopCategory = (categoryId: string) => {
		setSelectedTopCategory(categoryId);
		setSelectedChildFilter("all");
		setSearch("");
		mobileDrawerState.close();
	};

	const renderCategoryList = () => {
		if (previewCategories.length === 0) {
			return (
				<p className="py-8 text-center text-xs text-default-500">
					先解析书签后再查看
				</p>
			);
		}

		return (
			<div className="flex flex-col gap-0.5">
				{previewCategories.map((category) => {
					const isSelected = selectedTopCategory === category.id;
					return (
						<button
							key={category.id}
							type="button"
							onClick={() => handleSelectTopCategory(category.id)}
							className={cn(
								"flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all",
								isSelected
									? "bg-blue-50 font-medium text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
									: "hover:bg-default/50",
							)}
						>
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-default/70 text-xs font-semibold text-default-700 dark:text-default-200">
								{category.name.charAt(0)}
							</div>
							<div className="min-w-0 flex-1">
								<p className="truncate">{category.name}</p>
								<p className="truncate text-xs text-default-500">
									{category.childCount} 个子分类，{category.totalSites} 个网址
								</p>
							</div>
							<div className="flex shrink-0 items-center gap-1">
								{keepExisting && category.willMerge ? (
									<Chip
										size="sm"
										variant="secondary"
										className="h-5 px-1.5 text-[10px]!"
									>
										合并
									</Chip>
								) : null}
								<Chip
									size="sm"
									variant="secondary"
									className="h-5 min-w-5 px-1.5 text-xs!"
								>
									{category.totalSites}
								</Chip>
							</div>
						</button>
					);
				})}
			</div>
		);
	};

	return (
		<div className="flex flex-col gap-4">
			<Alert
				status="accent"
				className="border border-blue-200/70 bg-linear-to-r from-blue-50 via-sky-50 to-cyan-50 dark:border-blue-900/40 dark:from-blue-950/30 dark:via-slate-950 dark:to-cyan-950/20"
			>
				<Alert.Indicator />
				<Alert.Content>
					<Alert.Title>导入规则</Alert.Title>
					<Alert.Description>
						浏览器自带的“书签栏 / 其它书签 / 移动书签”等根目录会自动折叠，空文件夹会被忽略。每个实际导入的顶级分类都会保留一个“默认分类”，顶级目录下的直接网址会自动进入这个默认分类，更深层的文件夹会被压平成同一顶级分类下的子分类，不会生成多级结构。
					</Alert.Description>
				</Alert.Content>
			</Alert>

			<section className="rounded-xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
				<div className="border-b border-gray-100 px-5 py-4 dark:border-neutral-800">
					<h3 className="text-sm font-semibold">书签源</h3>
					<p className="mt-1 text-xs text-default-500">
						支持导入浏览器导出的书签 HTML 文件，也支持直接粘贴 HTML 内容。
					</p>
				</div>

				<div className="flex flex-col gap-4 px-5 py-4">
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-default-200 bg-default-50/70 p-3 dark:bg-neutral-950/20">
						<div className="flex flex-wrap items-center gap-3">
							<Button
								variant="outline"
								size="sm"
								onPress={() => fileInputRef.current?.click()}
							>
								<BiFolderOpen data-icon="inline-start" />
								选择书签文件
							</Button>
							<input
								ref={fileInputRef}
								type="file"
								accept=".html,.htm,text/html"
								className="hidden"
								onChange={handleFileChange}
							/>
							<span className="text-xs text-default-500">
								{pickedFile
									? `已载入：${pickedFile.name} (${(
												pickedFile.size / 1024
										  ).toFixed(1)} KB)`
									: "推荐直接选择浏览器导出的书签 HTML 文件"}
							</span>
						</div>

						{sourceHtml ? (
							<Button variant="ghost" size="sm" onPress={handleReset}>
								<BiTrash data-icon="inline-start" />
								清空
							</Button>
						) : null}
					</div>

					<div className="flex flex-col gap-2">
						<Label>HTML 内容</Label>
						<TextArea
							rows={16}
							fullWidth
							variant="secondary"
							value={sourceHtml}
							onChange={handleSourceChange}
							placeholder="请粘贴浏览器导出的书签 HTML 内容，例如 Chrome / Edge / Safari / Firefox 的导出结果。"
							className="min-h-85"
						/>
					</div>

					{error ? (
						<Alert
							status="danger"
							className="border border-red-200/80 bg-red-50/80 dark:border-red-900/40 dark:bg-red-950/20"
						>
							<Alert.Indicator />
							<Alert.Content>
								<Alert.Title>解析失败</Alert.Title>
								<Alert.Description>{error}</Alert.Description>
							</Alert.Content>
						</Alert>
					) : null}
				</div>

				<div className="flex flex-wrap items-center justify-end gap-2 px-5 pb-4">
					<Button
						variant="primary"
						isPending={parsing}
						isDisabled={!sourceHtml.trim() || parsing}
						onPress={handleParse}
					>
						<BiUpload data-icon="inline-start" />
						{parsing ? "解析中..." : "解析预览"}
					</Button>
					<Button
						variant="primary"
						isDisabled={!effectiveWebsiteData}
						onPress={handleApply}
					>
						<BiImport data-icon="inline-start" />
						{keepExisting ? "导入并追加" : "导入并替换"}
					</Button>
				</div>
			</section>

			<section className="rounded-xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
				<div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 dark:border-neutral-800 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex flex-col gap-1">
						<h3 className="text-sm font-semibold">导入方式</h3>
						<p className="text-xs text-default-500">
							开启后会在现有数据基础上追加，并对同名分类做合并；关闭后会用导入结果完全替换当前分类和网址数据。
						</p>
					</div>

					<AdminSwitch
						isSelected={keepExisting}
						onChange={setKeepExisting}
						ariaLabel="保留现有数据"
					>
						<span className="text-sm font-medium">保留现有数据并追加</span>
					</AdminSwitch>
				</div>

				<div className="grid gap-3 px-5 py-4 md:grid-cols-3">
					<SummaryCard
						label="当前数据"
						description="导入前后台里已有的分类与网址"
						summary={existingSummary}
					/>
					<SummaryCard
						label="本次导入"
						description="当前书签文件里解析出的内容"
						summary={
							importedResult
								? {
										topCategoryCount: importedResult.topCategoryCount,
										childCategoryCount: importedResult.childCategoryCount,
										siteCount: importedResult.siteCount,
								  }
								: null
						}
					/>
					<SummaryCard
						label="应用结果"
						description={keepExisting ? "追加 / 合并后的最终结果" : "将直接替换成这个结果"}
						summary={effectiveSummary}
						accent
					/>
				</div>

				<div className="px-5 pb-4">
					<Alert
						status={keepExisting ? "accent" : "warning"}
						className={cn(
							"border",
							keepExisting
								? "border-blue-200/70 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/20"
								: "border-amber-200/80 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20",
						)}
					>
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Title>
								{keepExisting ? "合并规则" : "替换规则"}
							</Alert.Title>
							<Alert.Description>
								{keepExisting
									? "同名顶级分类会自动合并，同名子分类也会继续合并；同一子分类内按网址 URL 去重，现有站点会优先保留。"
									: "当前预览展示的是本次导入内容，点击“导入并替换”后，现有分类和网址数据会整体被新的导入结果覆盖。"}
							</Alert.Description>
						</Alert.Content>
					</Alert>
				</div>
			</section>

			<div className="flex min-h-155 gap-4">
				<div className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white lg:flex dark:border-neutral-800 dark:bg-neutral-900">
					<div className="border-b border-gray-100 px-4 py-3 dark:border-neutral-800">
						<h3 className="text-sm font-semibold">导入预览</h3>
						<p className="mt-1 text-xs text-default-500">
							左侧只展示本次导入解析出的顶级分类
						</p>
					</div>
					<div className="flex-1 overflow-y-auto p-2 overscroll-none">
						{renderCategoryList()}
					</div>
				</div>

				<div className="min-w-0 flex-1 overflow-visible">
					{!importedResult || previewCategories.length === 0 || !currentTopCategory ? (
						<div className="flex min-h-155 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-gray-200 bg-white px-6 text-center dark:border-neutral-800 dark:bg-neutral-900">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-default/70">
								<BiImport className="size-6 text-default-600" />
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium">还没有导入预览</p>
								<p className="text-xs text-default-500">
									先上传或粘贴浏览器书签 HTML，再点击“解析预览”。
								</p>
							</div>
						</div>
					) : (
						<div className="flex min-h-155 flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div className="flex items-center gap-2 pt-1">
									<span className="truncate text-lg! font-medium">
										{currentTopCategory.name}
									</span>
									<Chip
										variant="primary"
										color="accent"
										className="shrink-0 text-xs! font-medium"
									>
										{currentTopCategory.totalSites} 个网址
									</Chip>
									<Chip variant="secondary" className="shrink-0 text-xs!">
										{currentTopCategory.childCount} 个子分类
									</Chip>
									{keepExisting && currentTopCategory.willMerge ? (
										<Chip variant="secondary" className="shrink-0 text-xs!">
											会并入现有同名分类
										</Chip>
									) : null}
								</div>

								<div className="flex flex-wrap items-center gap-2">
									<Button
										variant="outline"
										size="sm"
										className="shrink-0 lg:hidden"
										isIconOnly
										onPress={mobileDrawerState.open}
									>
										<BiMenu className="size-4" />
									</Button>
									<TextField className="flex-1 sm:w-64" value={search} onChange={setSearch}>
										<Label className="sr-only">搜索预览</Label>
										<InputGroup>
											<InputGroup.Prefix>
												<BiSearch className="size-4 text-default-500" />
											</InputGroup.Prefix>
											<InputGroup.Input placeholder="搜索导入网址..." />
										</InputGroup>
									</TextField>
								</div>
							</div>

							<Alert
								status="default"
								className="border border-default-200 bg-default-50/70 dark:bg-neutral-950/20"
							>
								<Alert.Indicator />
								<Alert.Content>
									<Alert.Title>预览说明</Alert.Title>
									<Alert.Description>
										这里展示的是本次导入内容本身；上面的“应用结果”统计会根据你是否保留现有数据，实时展示最终写入后台后的总量变化。
									</Alert.Description>
								</Alert.Content>
							</Alert>

							<div className="flex flex-wrap gap-2">
								<Button
									size="sm"
									variant={selectedChildFilter === "all" ? "primary" : "outline"}
									onPress={() => setSelectedChildFilter("all")}
								>
									全部
								</Button>
								{currentTopCategory.children.map((child) => (
									<Button
										key={child.id}
										size="sm"
										variant={
											selectedChildFilter === child.id ? "primary" : "outline"
										}
										onPress={() => setSelectedChildFilter(child.id)}
									>
										{child.name} ({child.siteCount})
									</Button>
								))}
							</div>

							<div className="min-h-0 flex-1 overflow-hidden">
								{filteredSiteRows.length === 0 ? (
									<div className="flex h-full min-h-90 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
										<p className="text-sm text-default-500">
											{search ? "没有匹配的网址" : "当前筛选下没有网址"}
										</p>
									</div>
								) : (
									<Table variant="secondary" aria-label="导入网址预览">
										<Table.ScrollContainer>
											<Table.Content aria-label="导入网址预览">
												<Table.Header>
													<Table.Column className="w-12">图标</Table.Column>
													<Table.Column
														className="min-w-28 sm:min-w-44"
														isRowHeader
													>
														名称
													</Table.Column>
													<Table.Column className="min-w-52">URL</Table.Column>
													<Table.Column className="min-w-36">子分类</Table.Column>
												</Table.Header>
												<Table.Body
													renderEmptyState={() => (
														<div className="py-12 text-center text-sm text-default-500">
															暂无数据
														</div>
													)}
												>
													{filteredSiteRows.map((row) => {
														const siteIconSrc = getIconImageSrc(row.site.icon);
														return (
															<Table.Row
																key={row.uniqueKey}
																id={row.uniqueKey}
																textValue={row.site.title}
															>
																<Table.Cell>
																	<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-default/60">
																		{row.site.icon ? (
																			siteIconSrc ? (
																				// eslint-disable-next-line @next/next/no-img-element
																				<img
																					src={siteIconSrc}
																					alt=""
																					className="h-5 w-5 rounded object-contain"
																				/>
																			) : (
																				<span className="text-center text-base">
																					{row.site.icon}
																				</span>
																			)
																		) : (
																			<span className="text-center text-xs font-bold text-default-500">
																				{row.site.title.charAt(0)}
																			</span>
																		)}
																	</div>
																</Table.Cell>
																<Table.Cell>
																	<div className="flex flex-col gap-0.5">
																		<span className="font-medium">
																			{row.site.title}
																		</span>
																		{row.site.description ? (
																			<span className="line-clamp-1 text-xs text-default-500">
																				{row.site.description}
																			</span>
																		) : null}
																	</div>
																</Table.Cell>
																<Table.Cell>
																	<Link
																		href={row.site.url}
																		target="_blank"
																		rel="noopener noreferrer"
																		className="inline-flex items-center gap-1 truncate text-xs transition no-underline hover:underline"
																	>
																		<span className="truncate">{row.site.url}</span>
																		<Link.Icon />
																	</Link>
																</Table.Cell>
																<Table.Cell>
																	<Chip variant="secondary" className="text-xs!">
																		{row.childName}
																	</Chip>
																</Table.Cell>
															</Table.Row>
														);
													})}
												</Table.Body>
											</Table.Content>
										</Table.ScrollContainer>
									</Table>
								)}
							</div>
						</div>
					)}
				</div>
			</div>

				<Drawer.Backdrop
					isOpen={mobileDrawerState.isOpen}
					onOpenChange={mobileDrawerState.setOpen}
				>
					<Drawer.Content placement="left">
						<Drawer.Dialog className="w-dvw max-w-72 bg-white p-3 dark:bg-neutral-900">
							<Drawer.Header>
								<Drawer.Heading className="flex items-center justify-between p-3">
									<span>选择预览分类</span>
									<Button
										isIconOnly
										size="sm"
										variant="tertiary"
										onPress={mobileDrawerState.close}
									>
										<BiX className="size-4" />
									</Button>
								</Drawer.Heading>
							</Drawer.Header>
							<Drawer.Body className="overflow-y-auto">
								{renderCategoryList()}
							</Drawer.Body>
						</Drawer.Dialog>
					</Drawer.Content>
				</Drawer.Backdrop>
		</div>
	);
}

function SummaryCard({
	label,
	description,
	summary,
	accent = false,
}: {
	label: string;
	description: string;
	summary:
		| {
				topCategoryCount: number;
				childCategoryCount: number;
				siteCount: number;
		  }
		| null
		| undefined;
	accent?: boolean;
}) {
	return (
		<div
			className={cn(
				"rounded-xl border p-4",
				accent
					? "border-blue-200/80 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/20"
					: "border-default-200 bg-default-50/70 dark:bg-neutral-950/20",
			)}
		>
			<p className="text-sm font-medium">{label}</p>
			<p className="mt-1 text-xs text-default-500">{description}</p>
			{summary ? (
				<div className="mt-4 flex flex-wrap gap-2">
					<Chip variant="secondary" className="text-xs!">
						{summary.topCategoryCount} 个顶级分类
					</Chip>
					<Chip variant="secondary" className="text-xs!">
						{summary.childCategoryCount} 个子分类
					</Chip>
					<Chip variant="secondary" className="text-xs!">
						{summary.siteCount} 个网址
					</Chip>
				</div>
			) : (
				<p className="mt-4 text-xs text-default-500">等待解析结果</p>
			)}
		</div>
	);
}

function normalizeNameKey(name: string): string {
	return name.trim().toLowerCase();
}
