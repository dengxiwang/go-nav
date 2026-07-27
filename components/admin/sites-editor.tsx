"use client";

import {
    Button,
    Chip,
    Input,
    InputGroup,
    Label,
    Link,
    Modal,
    TextField,
    Table,
    AlertDialog,
    toast,
    Drawer,
    Spinner,
    cn,
    useOverlayState,
} from "@heroui/react";
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    MeasuringStrategy,
    PointerSensor,
    TouchSensor,
    closestCenter,
    pointerWithin,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import type {
    CollisionDetection,
    DragEndEvent,
    DragMoveEvent,
    DragStartEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import {
    BiPencil,
    BiTrash,
    BiSearch,
    BiChevronRight,
    BiX,
    BiMenu,
    BiPlus,
    BiChevronUp,
    BiChevronDown,
    BiGlobe,
    BiDotsVerticalRounded,
    BiImage,
} from "react-icons/bi";
import type { NavCategory, WebsiteData, NavSite } from "@/types";
import { useAtom, useAtomValue } from "jotai";
import { categoriesAtom, navAtom } from "@/lib/store/admin";
import { uploadImageWithCompression } from "@/lib/client/image-upload";
import { getPreferredSiteHref } from "@/lib/client/site-link";
import { getIconImageSrc } from "@/lib/icon";
import { IconPicker } from "./icon-picker";
import {
    resolveConfiguredValue,
    resolveSiteBackgroundColor,
    toPx,
} from "../site-icon";
import Loading from "./loading";

interface FlatCategory {
	category: NavCategory;
	id: string;
	name: string;
	icon?: string;
	level: number;
	hasChildren: boolean;
	siteCount: number;
	path: string[];
}

function collectExpandableIds(categories: NavCategory[]) {
	const ids = new Set<string>();
	const walk = (items: NavCategory[]) => {
		for (const item of items) {
			if ((item.children?.length ?? 0) > 0) {
				ids.add(item.id);
				walk(item.children ?? []);
			}
		}
	};
	walk(categories);
	return ids;
}

function findFirstSelectableCategoryId(
	categories: NavCategory[],
): string | null {
	for (const category of categories) {
		if ((category.children?.length ?? 0) > 0) {
			const childId = findFirstSelectableCategoryId(category.children ?? []);
			if (childId) return childId;
			continue;
		}
		return category.id;
	}
	return null;
}

function sameSet(a: Set<string>, b: Set<string>) {
	if (a.size !== b.size) return false;
	for (const item of a) {
		if (!b.has(item)) return false;
	}
	return true;
}

const getSiteSortableId = (categoryId: string, index: number) =>
	`site:${categoryId}:${index}`;

const getCategoryDropId = (scope: string, categoryId: string) =>
	`site-category:${scope}:${categoryId}`;

const siteAwareCollisionDetection: CollisionDetection = (args) => {
	const pointerCollisions = pointerWithin(args);
	const categoryCollisions = pointerCollisions.filter((collision) => {
		const data = collision.data?.droppableContainer.data.current as
			| CategoryDropData
			| undefined;
		return data?.type === "category-drop";
	});
	if (categoryCollisions.length > 0) return categoryCollisions;

	const directSiteCollisions = pointerCollisions.filter((collision) => {
		const data = collision.data?.droppableContainer.data.current as
			| SiteDragData
			| undefined;
		return data?.type === "site";
	});
	if (directSiteCollisions.length > 0) return directSiteCollisions;

	const pointer = args.pointerCoordinates;
	if (!pointer) return closestCenter(args);

	const siteContainers = args.droppableContainers.filter((container) => {
		const data = container.data.current as SiteDragData | undefined;
		return data?.type === "site";
	});
	const isPointerNearSiteList = siteContainers.some((container) => {
		const rect = args.droppableRects.get(container.id);
		if (!rect) return false;
		return (
			pointer.x >= rect.left &&
			pointer.x <= rect.right &&
			pointer.y >= rect.top - 24 &&
			pointer.y <= rect.bottom + 24
		);
	});

	if (!isPointerNearSiteList) return [];

	return closestCenter({
		...args,
		droppableContainers: siteContainers,
	});
};

interface SiteDragData {
	type: "site";
	sourceCategoryId: string;
	sourceIndex: number;
	site: NavSite;
}

interface CategoryDropData {
	type: "category-drop";
	categoryId: string;
}

function getClientPoint(event: Event) {
	if (event instanceof MouseEvent) {
		return { x: event.clientX, y: event.clientY };
	}
	if (event instanceof TouchEvent) {
		const touch = event.touches[0] ?? event.changedTouches[0];
		return touch ? { x: touch.clientX, y: touch.clientY } : null;
	}
	return null;
}

function isPointInsideRect(
	point: { x: number; y: number },
	rect: DOMRect,
) {
	return (
		point.x >= rect.left &&
		point.x <= rect.right &&
		point.y >= rect.top &&
		point.y <= rect.bottom
	);
}

function SortableSiteRow({
	id,
	site,
	sourceCategoryId,
	realIndex,
	currentSites,
	moveSite,
	openEditModal,
	setDeleteTarget,
	defaultIconPadding,
	autoUseIntranet,
	registerRowElement,
	isPointerOverSiteTable,
}: {
	id: string;
	site: NavSite;
	sourceCategoryId: string;
	realIndex: number;
	currentSites: NavSite[];
	moveSite: (index: number, direction: "up" | "down") => void;
	openEditModal: (site: NavSite, index: number) => void;
	setDeleteTarget: (index: number | null) => void;
	defaultIconPadding?: string;
	autoUseIntranet?: boolean;
	registerRowElement: (id: string, el: HTMLElement | null) => void;
	isPointerOverSiteTable: boolean;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
		useSortable({
			id,
			data: {
				type: "site",
				sourceCategoryId,
				sourceIndex: realIndex,
				site,
			} satisfies SiteDragData,
			animateLayoutChanges: ({ isSorting }) => isSorting,
			transition: {
				duration: 160,
				easing: "cubic-bezier(0.2, 0, 0, 1)",
			},
		});

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition: isDragging ? undefined : transition,
		position: "relative",
		zIndex: isDragging ? 1 : undefined,
	};
	const siteIconSrc = getIconImageSrc(site.icon);
	const resolvedHref = getPreferredSiteHref(site, { autoUseIntranet });
	const getResolvedIconPadding = (s?: NavSite | null) =>
		resolveConfiguredValue(s?.iconPadding, defaultIconPadding);
	const showSortPlaceholder = isDragging && isPointerOverSiteTable;

	return (
		<Table.Row
			ref={(node) => {
				setNodeRef(node);
				registerRowElement(id, node);
			}}
			style={style}
			id={id}
			className={cn(
				showSortPlaceholder && "rounded-xl [&>td>*]:invisible",
				isDragging && !isPointerOverSiteTable && "opacity-20",
			)}
			textValue={site.title}
		>
			<Table.Cell>
				{showSortPlaceholder ? (
					<span className="visible! pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-[#3b82f6] bg-[rgba(37,99,235,0.18)] text-xs font-semibold text-[#60a5fa]">
						放到这里
					</span>
				) : null}
				<div
					className="flex h-8 w-8 items-center justify-center rounded-lg"
					style={{
						backgroundColor: resolveSiteBackgroundColor(site.bgColor),
						padding: toPx(getResolvedIconPadding(site)) || undefined,
					}}
				>
					{site.icon ? (
						siteIconSrc ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={siteIconSrc}
								alt=""
								className="h-5 w-5 rounded object-contain"
							/>
						) : (
							<span className="text-center text-base">{site.icon}</span>
						)
					) : (
						<span className="text-center text-xs font-bold text-default-500">
							{site.title.charAt(0)}
						</span>
					)}
				</div>
			</Table.Cell>
			<Table.Cell>
				<div className="flex items-center gap-1.5">
					<Button
						{...attributes}
						{...listeners}
						aria-label="拖拽排序"
						variant="ghost"
						isIconOnly
						className="h-6! w-6! touch-none cursor-grab active:cursor-grabbing"
					>
						<BiDotsVerticalRounded className="size-4" />
					</Button>
					<div
						className="font-medium flex-1"
						style={{
							display: "-webkit-box",
							WebkitLineClamp: 3,
							WebkitBoxOrient: "vertical",
							overflow: "hidden",
							wordBreak: "break-all",
						}}
					>
						{site.title}
					</div>
				</div>
			</Table.Cell>
			<Table.Cell className="max-w-[320px]">
				<div className="flex items-start gap-1">
					<Link
						href={resolvedHref}
						target="_blank"
						rel="noopener noreferrer"
						className="block max-w-70 rounded-none pb-0.5 text-xs transition no-underline hover:underline"
						style={{
							display: "-webkit-box",
							WebkitLineClamp: 3,
							WebkitBoxOrient: "vertical",
							overflow: "hidden",
							wordBreak: "break-all",
						}}
					>
						{site.url}
					</Link>
				</div>
			</Table.Cell>
			<Table.Cell className="max-w-[320px]">
				{site.intranetUrl ? (
					<div className="flex items-start gap-1">
						<Link
							href={site.intranetUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="block max-w-70 rounded-none pb-0.5 text-xs transition no-underline hover:underline"
							style={{
								display: "-webkit-box",
								WebkitLineClamp: 3,
								WebkitBoxOrient: "vertical",
								overflow: "hidden",
								wordBreak: "break-all",
							}}
						>
							{site.intranetUrl}
						</Link>
					</div>
				) : (
					<span className="text-default-500">-</span>
				)}
			</Table.Cell>
			<Table.Cell>
				<span className="line-clamp-2 text-default-500">
					{site.description || "-"}
				</span>
			</Table.Cell>
			<Table.Cell>
				{site.previewImage ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={site.previewImage}
						alt=""
						className="h-10 w-16 rounded-lg border border-default object-cover"
					/>
				) : (
					<span className="text-default-500">-</span>
				)}
			</Table.Cell>
			<Table.Cell>
				<div className="flex flex-wrap gap-1">
					{(site.tags ?? []).map((t: string) => (
						<Chip key={t} className="text-xs!" variant="secondary">
							{t}
						</Chip>
					))}
					{!site.tags?.length && <span className="text-default-500">-</span>}
				</div>
			</Table.Cell>
			<Table.Cell>
				<div className="flex items-center gap-1">
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						aria-label="上移"
						className="h-9 w-9"
						isDisabled={realIndex <= 0}
						onPress={() => moveSite(realIndex, "up")}
					>
						<BiChevronUp />
					</Button>
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						aria-label="下移"
						className="h-9 w-9"
						isDisabled={realIndex >= currentSites.length - 1}
						onPress={() => moveSite(realIndex, "down")}
					>
						<BiChevronDown />
					</Button>
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						aria-label="编辑"
						className="h-9 w-9"
						onPress={() => openEditModal(site, realIndex)}
					>
						<BiPencil />
					</Button>
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						className="h-9 w-9 text-danger"
						aria-label="删除"
						onPress={() => setDeleteTarget(realIndex)}
					>
						<BiTrash />
					</Button>
				</div>
			</Table.Cell>
		</Table.Row>
	);
}

function DroppableCategoryButton({
	cat,
	isExpanded,
	isSelected,
	isLeaf,
	toggleExpand,
	handleSelectCategory,
	renderIcon,
	flatCategories,
	renderTreeItem,
	dropScope,
}: {
	cat: FlatCategory;
	isExpanded: boolean;
	isSelected: boolean;
	isLeaf: boolean;
	toggleExpand: (id: string) => void;
	handleSelectCategory: (id: string) => void;
	renderIcon: (icon?: string) => React.ReactNode;
	flatCategories: FlatCategory[];
	renderTreeItem: (cat: FlatCategory, dropScope: string) => React.ReactNode;
	dropScope: string;
}) {
	const { setNodeRef, isOver } = useDroppable({
		id: getCategoryDropId(dropScope, cat.id),
		disabled: !isLeaf,
		data: {
			type: "category-drop",
			categoryId: cat.id,
		} satisfies CategoryDropData,
	});
	const showHighlight = isLeaf && isOver;
	const children = flatCategories.filter(
		(c) =>
			c.path.length === cat.path.length + 1 &&
			c.path[cat.path.length - 1] === cat.id,
	);

	return (
		<div key={cat.id}>
			<button
				ref={setNodeRef}
				type="button"
				onClick={() => {
					if (cat.hasChildren) {
						toggleExpand(cat.id);
					}
					if (isLeaf) {
						handleSelectCategory(cat.id);
					}
				}}
				className={cn(
					"relative flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-left text-sm transition-all",
					isSelected
						? "bg-blue-50 font-medium text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
						: "hover:bg-default/50",
				)}
			>
				{showHighlight ? (
					<span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-[#3b82f6] bg-[rgba(37,99,235,0.18)] text-xs font-semibold text-[#60a5fa]">
						放到这里
					</span>
				) : null}
				<span className="inline-flex w-5 shrink-0 items-center justify-center">
					{cat.hasChildren ? (
						<BiChevronRight
							className={cn(
								"size-4 transition-transform duration-150",
								isExpanded ? "rotate-90" : "",
							)}
						/>
					) : (
						<div className="w-4" />
					)}
				</span>
				{renderIcon(cat.icon)}
				<span className="truncate flex-1">{cat.name}</span>
				{cat.siteCount > 0 && (
					<Chip
						size="sm"
						variant="secondary"
						className="h-5 min-w-5 px-1.5 text-xs!"
					>
						{cat.siteCount}
					</Chip>
				)}
			</button>
			{isExpanded && children.length > 0 && (
				<div>{children.map((child) => renderTreeItem(child, dropScope))}</div>
			)}
		</div>
	);
}

function SiteDragPreview({
	rowHtml,
	rowWidth,
	columnWidths,
}: {
	rowHtml: string;
	rowWidth: number;
	columnWidths: number[];
}) {
	return (
		<div className="pointer-events-none opacity-85" style={{ width: rowWidth }}>
			<table className="w-full border-separate border-spacing-0">
				<colgroup>
					{columnWidths.map((width, index) => (
						<col key={`drag-col-${index}`} style={{ width }} />
					))}
				</colgroup>
				<tbody dangerouslySetInnerHTML={{ __html: rowHtml }} />
			</table>
		</div>
	);
}

function PreviewImagePicker({
	value,
	onChange,
}: {
	value?: string;
	onChange: (v: string) => void;
}) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const nav = useAtomValue(navAtom);

	const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.[0];
		e.target.value = "";
		if (!f) return;
		await uploadFile(f);
	};

	const uploadFile = async (f: File) => {
		setUploading(true);
		try {
			const url = await uploadImageWithCompression(f, {
				maxEdge: 1600,
				quality: 0.84,
				compress: nav.imageUpload?.compress === true,
				forceWebp: nav.imageUpload?.convertToWebp === true,
				fileNamePrefix: "preview",
			});
			onChange(url);
		} catch (e) {
			toast.danger((e as Error).message || "预览图上传失败");
		} finally {
			setUploading(false);
		}
	};

	const onPasteImage = async (e: React.ClipboardEvent<HTMLInputElement>) => {
		const file = e.clipboardData.items
			? Array.from(e.clipboardData.items)
					.find(
						(item) => item.kind === "file" && item.type.startsWith("image/"),
					)
					?.getAsFile()
			: null;
		if (!file) return;
		e.preventDefault();
		await uploadFile(file);
	};

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2">
				<div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-default bg-default/30">
					{value ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={value}
							alt=""
							className="h-full w-full object-cover"
							loading="lazy"
						/>
					) : (
						<span className="text-xs text-default-500">无预览图</span>
					)}
				</div>
				<TextField
					className="min-w-0 flex-1"
					value={value ?? ""}
					onChange={onChange}
				>
					<Label className="sr-only">预览图</Label>
					<Input
						placeholder="/uploads/preview.webp 或 https://..."
						onPaste={onPasteImage}
					/>
				</TextField>
				<Button
					type="button"
					variant="outline"
					size="sm"
					isDisabled={uploading}
					onPress={() => fileRef.current?.click()}
				>
					{uploading ? "上传中..." : "上传"}
				</Button>
				{value ? (
					<Button
						type="button"
						variant="tertiary"
						size="sm"
						onPress={() => onChange("")}
					>
						清除
					</Button>
				) : null}
				<input
					ref={fileRef}
					type="file"
					accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
					className="hidden"
					onChange={onFileChosen}
				/>
			</div>
		</div>
	);
}

export function SitesEditor() {
	const [categories, setCategories] = useAtom(categoriesAtom);
	const nav = useAtomValue(navAtom);
	const value: WebsiteData = { categories };
	const onChange = (v: WebsiteData) => setCategories(v.categories);
	const [isClientReady, setIsClientReady] = useState(false);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(() =>
		findFirstSelectableCategoryId(categories),
	);
	const [search, setSearch] = useState("");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingSite, setEditingSite] = useState<NavSite | null>(null);
	const [editingIndex, setEditingIndex] = useState<number>(-1);
	const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
	const [fetchingInfo, setFetchingInfo] = useState(false);
	const [capturingPreview, setCapturingPreview] = useState(false);
	const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() =>
		collectExpandableIds(categories),
	);
	const knownExpandableIdsRef = useRef(collectExpandableIds(categories));
	const mobileDrawerState = useOverlayState();
	const defaultIconPadding = nav.layout?.defaultIconPadding;
	const autoUseIntranet = nav.layout?.autoUseIntranet;
	const [activeSite, setActiveSite] = useState<NavSite | null>(null);
	const [activeRowSnapshot, setActiveRowSnapshot] = useState<{
		html: string;
		width: number;
		columnWidths: number[];
	} | null>(null);
	const rowElementMapRef = useRef(new Map<string, HTMLElement>());
	const registerRowElement = (id: string, el: HTMLElement | null) => {
		if (!el) {
			rowElementMapRef.current.delete(id);
			return;
		}
		rowElementMapRef.current.set(id, el);
	};
	const siteTableRegionRef = useRef<HTMLDivElement>(null);
	const dragPointerOriginRef = useRef<{ x: number; y: number } | null>(null);
	const [isPointerOverSiteTable, setIsPointerOverSiteTable] = useState(false);
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 6 },
		}),
		useSensor(TouchSensor, {
			activationConstraint: { distance: 4 },
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const flatCategories = useMemo(() => {
		const result: FlatCategory[] = [];
		const walk = (cats: NavCategory[], level: number, path: string[]) => {
			for (const c of cats) {
				const currentPath = [...path, c.id];
				const hasChildren = (c.children?.length ?? 0) > 0;
				const siteCount = c.sites?.length ?? 0;
				result.push({
					category: c,
					id: c.id,
					name: c.name,
					icon: c.icon,
					level,
					hasChildren,
					siteCount,
					path: currentPath,
				});
				if (c.children) {
					walk(c.children, level + 1, currentPath);
				}
			}
		};
		walk(value.categories, 0, []);
		return result;
	}, [value.categories]);

	useEffect(() => {
		setIsClientReady(true);
	}, []);

	useEffect(() => {
		const nextExpandableIds = collectExpandableIds(value.categories);
		setExpandedKeys((prev) => {
			const next = new Set<string>();
			for (const id of prev) {
				if (nextExpandableIds.has(id)) next.add(id);
			}
			for (const id of nextExpandableIds) {
				if (!knownExpandableIdsRef.current.has(id)) next.add(id);
			}
			knownExpandableIdsRef.current = nextExpandableIds;
			return sameSet(prev, next) ? prev : next;
		});
	}, [value.categories]);

	useEffect(() => {
		const selected = flatCategories.find((c) => c.id === selectedCategory);
		if (selected && !selected.hasChildren) return;
		setSelectedCategory(findFirstSelectableCategoryId(value.categories));
	}, [flatCategories, selectedCategory, value.categories]);

	const currentCategory = useMemo(() => {
		if (!selectedCategory) return null;
		const find = (cats: NavCategory[]): NavCategory | null => {
			for (const c of cats) {
				if (c.id === selectedCategory) return c;
				if (c.children) {
					const found = find(c.children);
					if (found) return found;
				}
			}
			return null;
		};
		return find(value.categories);
	}, [selectedCategory, value.categories]);

	const currentSites = useMemo(() => {
		if (!currentCategory) return [];
		return currentCategory.sites ?? [];
	}, [currentCategory]);

	const filteredSites = useMemo(() => {
		if (!search.trim()) return currentSites;
		const q = search.toLowerCase();
		return currentSites.filter(
			(s) =>
				s.title.toLowerCase().includes(q) ||
				s.url.toLowerCase().includes(q) ||
				s.intranetUrl?.toLowerCase().includes(q) ||
				s.description?.toLowerCase().includes(q) ||
				s.tags?.some((t) => t.toLowerCase().includes(q)),
		);
	}, [currentSites, search]);

	const sortableSiteIds = useMemo(() => {
		if (!selectedCategory) return [];
		return filteredSites.map((site) =>
			getSiteSortableId(selectedCategory, currentSites.indexOf(site)),
		);
	}, [currentSites, filteredSites, selectedCategory]);

	if (!isClientReady) {
		return <Loading />;
	}

	const findCategoryById = (
		cats: NavCategory[],
		categoryId: string,
	): NavCategory | null => {
		for (const category of cats) {
			if (category.id === categoryId) return category;
			if (category.children?.length) {
				const found = findCategoryById(category.children, categoryId);
				if (found) return found;
			}
		}
		return null;
	};

	const updateCategorySites = (
		cats: NavCategory[],
		categoryId: string,
		updater: (sites: NavSite[]) => NavSite[],
	): NavCategory[] => {
		let didUpdate = false;
		const next = cats.map((c) => {
			if (c.id === categoryId) {
				didUpdate = true;
				return { ...c, sites: updater(c.sites ?? []) };
			}
			if (c.children) {
				const nextChildren = updateCategorySites(c.children, categoryId, updater);
				if (nextChildren !== c.children) {
					didUpdate = true;
					return { ...c, children: nextChildren };
				}
			}
			return c;
		});
		return didUpdate ? next : cats;
	};

	const updateSites = (updater: (sites: NavSite[]) => NavSite[]) => {
		if (!selectedCategory) return null;
		const newData = {
			...value,
			categories: updateCategorySites(
				value.categories,
				selectedCategory,
				updater,
			),
		};
		onChange(newData);
		return newData;
	};

	const moveSiteToCategory = (
		sourceCategoryId: string,
		sourceIndex: number,
		targetCategoryId: string,
	) => {
		if (sourceCategoryId === targetCategoryId) return;
		const sourceCategory = findCategoryById(value.categories, sourceCategoryId);
		const targetCategory = findCategoryById(value.categories, targetCategoryId);
		if (!sourceCategory || !targetCategory) return;
		if ((targetCategory.children?.length ?? 0) > 0) {
			toast.warning("网址只能拖动到子分类");
			return;
		}
		const site = sourceCategory.sites?.[sourceIndex];
		if (!site) return;

		let nextCategories = updateCategorySites(
			value.categories,
			sourceCategoryId,
			(sites) => sites.filter((_, index) => index !== sourceIndex),
		);
		nextCategories = updateCategorySites(
			nextCategories,
			targetCategoryId,
			(sites) => [...sites, site],
		);
		onChange({ ...value, categories: nextCategories });
		toast.success(
			`已将"${site.title}"移动到"${getCategoryPath(targetCategoryId)}"，记得点击保存`,
		);
	};

	const updatePointerOverSiteTable = (point: { x: number; y: number }) => {
		const tableRect = siteTableRegionRef.current?.getBoundingClientRect();
		const nextIsPointerOverSiteTable = tableRect
			? isPointInsideRect(point, tableRect)
			: false;
		setIsPointerOverSiteTable((previous) =>
			previous === nextIsPointerOverSiteTable
				? previous
				: nextIsPointerOverSiteTable,
		);
	};

	const handleSiteDragStart = (event: DragStartEvent) => {
		const pointerOrigin = getClientPoint(event.activatorEvent);
		dragPointerOriginRef.current = pointerOrigin;
		if (pointerOrigin) {
			updatePointerOverSiteTable(pointerOrigin);
		} else {
			setIsPointerOverSiteTable(true);
		}
		const data = event.active.data.current;
		if (data?.type === "site") {
			setActiveSite((data as SiteDragData).site);
		}
		const rowElement = rowElementMapRef.current.get(String(event.active.id));
		if (rowElement) {
			const rect = rowElement.getBoundingClientRect();
			const columnWidths = Array.from(rowElement.children).map(
				(cell) => (cell as HTMLElement).getBoundingClientRect().width,
			);
			setActiveRowSnapshot({
				html: rowElement.outerHTML,
				width: rect.width,
				columnWidths,
			});
			return;
		}
		setActiveRowSnapshot(null);
	};

	const handleSiteDragMove = (event: DragMoveEvent) => {
		const pointerOrigin = dragPointerOriginRef.current;
		if (!pointerOrigin) return;
		updatePointerOverSiteTable({
			x: pointerOrigin.x + event.delta.x,
			y: pointerOrigin.y + event.delta.y,
		});
	};

	const handleSiteDragEnd = (event: DragEndEvent) => {
		setActiveSite(null);
		setActiveRowSnapshot(null);
		dragPointerOriginRef.current = null;
		setIsPointerOverSiteTable(false);

		const activeData = event.active.data.current as SiteDragData | undefined;
		const overData = event.over?.data.current as
			| SiteDragData
			| CategoryDropData
			| undefined;
		if (!activeData || !overData || activeData.type !== "site") return;

		if (overData.type === "category-drop") {
			moveSiteToCategory(
				activeData.sourceCategoryId,
				activeData.sourceIndex,
				overData.categoryId,
			);
			return;
		}

		if (
			overData.type !== "site" ||
			activeData.sourceCategoryId !== overData.sourceCategoryId ||
			activeData.sourceIndex === overData.sourceIndex
		) {
			return;
		}

		const newData = {
			...value,
			categories: updateCategorySites(
				value.categories,
				activeData.sourceCategoryId,
				(sites) =>
					arrayMove(sites, activeData.sourceIndex, overData.sourceIndex),
			),
		};
		onChange(newData);
	};

	const openAddModal = () => {
		setEditingSite({
			title: "",
			description: "",
			url: "https://",
			intranetUrl: "",
			icon: "",
			previewImage: "",
			bgColor: "rgba(255, 255, 255, 0)",
			iconPadding: "",
			tags: [],
		});
		setEditingIndex(-1);
		setIsModalOpen(true);
	};

	const openEditModal = (site: NavSite, index: number) => {
		setEditingSite({ ...site });
		setEditingIndex(index);
		setIsModalOpen(true);
	};

	const saveSite = async () => {
		if (!editingSite || !selectedCategory) return;
		if (!editingSite.title.trim()) {
			toast.warning("网站名称不能为空");
			return;
		}
		if (!editingSite.url.trim()) {
			toast.warning("网站地址不能为空");
			return;
		}
		if (editingIndex >= 0) {
			updateSites((sites) => {
				const copy = [...sites];
				copy[editingIndex] = editingSite;
				return copy;
			});
			toast.success(`网址"${editingSite.title}"已更新，记得点击保存`);
		} else {
			updateSites((sites) => [...sites, editingSite]);
			toast.success(`网址"${editingSite.title}"已添加，记得点击保存`);
		}
		setIsModalOpen(false);
		setEditingSite(null);
		setEditingIndex(-1);
	};

	const fetchWebsiteInfo = async () => {
		if (!editingSite?.url?.trim()) {
			toast.warning("请先输入网站地址");
			return;
		}
		setFetchingInfo(true);
		try {
			const res = await fetch("/api/fetch-website/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: editingSite.url }),
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error || "获取失败");
			}
			const data = (await res.json()) as {
				title?: string;
				iconUrl?: string | null;
				description?: string;
				keywords?: string[];
			};

			setEditingSite((prev) => {
				if (!prev) return prev;
				const updated = { ...prev };
				if (data.title) {
					updated.title = data.title;
				}
				if (data.description !== undefined) {
					updated.description = data.description;
				}
				if (data.iconUrl) {
					updated.icon = data.iconUrl;
				}
				if (data.keywords) {
					updated.tags = data.keywords.slice(0, 5);
				}
				return updated;
			});

			toast.success("网站信息获取成功");
		} catch (e) {
			toast.warning((e as Error).message || "获取网站信息失败");
		} finally {
			setFetchingInfo(false);
		}
	};

	const captureWebsitePreview = async () => {
		if (!editingSite?.url?.trim()) {
			toast.warning("请先输入网站地址");
			return;
		}
		setCapturingPreview(true);
		try {
			const res = await fetch("/api/tools/capturePreview/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: editingSite.url }),
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error || "获取预览图失败");
			}
			const data = (await res.json()) as { url: string };
			setEditingSite((prev) =>
				prev ? { ...prev, previewImage: data.url } : prev,
			);
			toast.success("预览图获取成功");
		} catch (e) {
			toast.warning((e as Error).message || "获取预览图失败");
		} finally {
			setCapturingPreview(false);
		}
	};

	const deleteSite = (index: number) => {
		const site = currentSites[index];
		updateSites((sites) => sites.filter((_, i) => i !== index));
		toast.success(`网址"${site?.title}"已删除，记得点击保存`);
		setDeleteTarget(null);
	};

	const moveSite = (index: number, direction: "up" | "down") => {
		updateSites((sites) => {
			if (index < 0) return sites;
			const newIndex = direction === "up" ? index - 1 : index + 1;
			if (newIndex < 0 || newIndex >= sites.length) return sites;
			return arrayMove(sites, index, newIndex);
		});
	};

	const getCategoryPath = (catId: string): string => {
		const cat = flatCategories.find((c) => c.id === catId);
		if (!cat) return catId;
		const names: string[] = [];
		for (let i = 0; i < cat.path.length; i++) {
			const c = flatCategories.find((fc) => fc.id === cat.path[i]);
			if (c) names.push(c.name);
		}
		return names.join(" / ");
	};

	const handleSelectCategory = (catId: string) => {
		setSelectedCategory(catId);
		setSearch("");
		setDeleteTarget(null);
		mobileDrawerState.close();
	};

	const toggleExpand = (catId: string) => {
		setExpandedKeys((prev) => {
			const next = new Set(prev);
			if (next.has(catId)) {
				next.delete(catId);
			} else {
				next.add(catId);
			}
			return next;
		});
	};

	const renderIcon = (icon?: string) => {
		if (!icon) return <span className="h-5 w-5 shrink-0" aria-hidden />;
		const iconSrc = getIconImageSrc(icon);
		if (iconSrc) {
			return (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={iconSrc}
					alt=""
					className="h-5 w-5 rounded object-contain"
					loading="lazy"
				/>
			);
		}
		return <span className="w-5 text-center text-base">{icon}</span>;
	};

	const renderTreeItem = (cat: FlatCategory, dropScope: string) => {
		const isExpanded = expandedKeys.has(cat.id);
		const isSelected = selectedCategory === cat.id;
		const isLeaf = !cat.hasChildren;

		return (
			<DroppableCategoryButton
				key={cat.id}
				cat={cat}
				isExpanded={isExpanded}
				isSelected={isSelected}
				isLeaf={isLeaf}
				toggleExpand={toggleExpand}
				handleSelectCategory={handleSelectCategory}
				renderIcon={renderIcon}
				flatCategories={flatCategories}
				renderTreeItem={renderTreeItem}
				dropScope={dropScope}
			/>
		);
	};

	const renderCategoryList = (dropScope: string) => {
		const rootCategories = flatCategories.filter((c) => c.level === 0);

		if (rootCategories.length === 0) {
			return (
				<p className="py-8 text-center text-xs text-default-500">
					暂无可选分类
				</p>
			);
		}

		return (
			<div className="flex flex-col gap-0.5">
				{rootCategories.map((cat) => renderTreeItem(cat, dropScope))}
			</div>
		);
	};

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={siteAwareCollisionDetection}
			measuring={{
				droppable: {
					strategy: MeasuringStrategy.WhileDragging,
				},
			}}
			onDragMove={handleSiteDragMove}
			onDragStart={handleSiteDragStart}
			onDragEnd={handleSiteDragEnd}
			onDragCancel={() => {
				setActiveSite(null);
				setActiveRowSnapshot(null);
				dragPointerOriginRef.current = null;
				setIsPointerOverSiteTable(false);
			}}
		>
			<div className="flex h-[calc(100vh-106px)] flex-col gap-4">
				<div className="flex min-h-0 flex-1 gap-4">
					<div className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white lg:flex dark:border-neutral-800 dark:bg-neutral-900">
						<div className="border-b border-gray-100 px-4 py-3 dark:border-neutral-800">
							<h3 className="text-sm font-semibold">选择分类</h3>
						</div>
						<div className="flex-1 overflow-y-auto p-2 overscroll-none">
							{renderCategoryList("desktop")}
						</div>
					</div>

					<div className="min-w-0 flex-1 overflow-visible">
						{!selectedCategory ? (
							<div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
								<p className="text-sm text-default-500">请先选择一个分类</p>
								<Button
									variant="primary"
									size="sm"
									className="lg:hidden"
									onPress={mobileDrawerState.open}
								>
									选择分类
								</Button>
							</div>
						) : (
							<div className="flex h-full flex-col gap-4 overflow-y-scroll overscroll-none p-1 -m-1">
								<div className="flex flex-col gap-4 flex-wrap sm:flex-row sm:items-center sm:justify-between">
									<div className="flex items-center gap-2 pt-1">
										<span className="truncate font-medium text-lg!">
											{getCategoryPath(selectedCategory)}
										</span>
										<Chip
											variant="primary"
											color="accent"
											className="shrink-0 text-xs! font-medium"
										>
											{currentSites.length} 个网址
										</Chip>
									</div>
									<div className="flex items-center gap-2 flex-wrap">
										<Button
											variant="outline"
											size="sm"
											className="shrink-0 lg:hidden"
											isIconOnly
											onPress={mobileDrawerState.open}
										>
											<BiMenu className="size-4" />
										</Button>
										<TextField
											className="flex-1 sm:w-64"
											value={search}
											onChange={setSearch}
										>
											<Label className="sr-only">搜索</Label>
											<InputGroup>
												<InputGroup.Prefix>
													<BiSearch className="size-4 text-default-500" />
												</InputGroup.Prefix>
												<InputGroup.Input placeholder="搜索网站..." />
											</InputGroup>
										</TextField>
										<Button
											variant="primary"
											size="sm"
											className="shrink-0 h-9"
											onPress={openAddModal}
										>
											<BiPlus data-icon="inline-start" />
											<span>新增网址</span>
										</Button>
									</div>
								</div>

								<div ref={siteTableRegionRef}>
									{filteredSites.length === 0 ? (
										<div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
											<p className="text-sm text-default-500">
												{search
													? "没有匹配的网站"
													: "该分类下暂无网址，点击右上角新增"}
											</p>
										</div>
									) : (
										<SortableContext
											items={sortableSiteIds}
											strategy={verticalListSortingStrategy}
										>
											<Table variant="secondary" aria-label="网址列表">
												<Table.ScrollContainer>
													<Table.Content aria-label="网址列表">
														<Table.Header>
															<Table.Column className="w-12">图标</Table.Column>
															<Table.Column
																className="min-w-36 sm:min-w-44"
																isRowHeader
															>
																名称
															</Table.Column>
															<Table.Column className="min-w-60">
																公网 URL
															</Table.Column>
															<Table.Column className="min-w-48">
																内网 URL
															</Table.Column>
															<Table.Column className="min-w-52">
																描述
															</Table.Column>
															<Table.Column className="min-w-24">
																预览图
															</Table.Column>
															<Table.Column className="min-w-40">
																标签
															</Table.Column>
															<Table.Column className="w-24">操作</Table.Column>
														</Table.Header>
														<Table.Body
															renderEmptyState={() => (
																<div className="py-12 text-center text-sm text-default-500">
																	暂无数据
																</div>
															)}
														>
															{filteredSites.map((site) => {
																const realIndex = currentSites.indexOf(site);
																const sortableId = getSiteSortableId(
																	selectedCategory,
																	realIndex,
																);
																return (
																	<SortableSiteRow
																		key={sortableId}
																		id={sortableId}
																		site={site}
																		sourceCategoryId={selectedCategory}
																		realIndex={realIndex}
																		currentSites={currentSites}
																		moveSite={moveSite}
																		openEditModal={openEditModal}
																		setDeleteTarget={setDeleteTarget}
																		defaultIconPadding={defaultIconPadding}
																		autoUseIntranet={autoUseIntranet}
																		registerRowElement={registerRowElement}
																		isPointerOverSiteTable={
																			isPointerOverSiteTable
																		}
																	/>
																);
															})}
														</Table.Body>
													</Table.Content>
												</Table.ScrollContainer>
											</Table>
										</SortableContext>
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
							<Drawer.Dialog className="w-dvw max-w-72 p-3 bg-white dark:bg-neutral-900">
								<Drawer.Header>
									<Drawer.Heading className="flex items-center justify-between p-3">
										<span>选择分类</span>
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
									{renderCategoryList("drawer")}
								</Drawer.Body>
							</Drawer.Dialog>
						</Drawer.Content>
					</Drawer.Backdrop>

					<Modal.Backdrop
						isOpen={isModalOpen}
						onOpenChange={(open) => !open && setIsModalOpen(false)}
					>
						<Modal.Container>
							<Modal.Dialog className="sm:max-w-125">
								<Modal.CloseTrigger />
								<Modal.Header>
									<Modal.Heading>
										{editingIndex >= 0 ? "编辑网址" : "新增网址"}
									</Modal.Heading>
								</Modal.Header>
								<Modal.Body>
									<div className="flex flex-col gap-4">
										<div className="flex flex-col gap-1">
											<span className="text-sm font-medium">分类</span>
											<span className="rounded-lg bg-default/40 px-3 py-2 text-sm border border-default">
												{selectedCategory
													? getCategoryPath(selectedCategory)
													: "-"}
											</span>
										</div>
										<TextField
											value={editingSite?.url ?? ""}
											onChange={(v) =>
												setEditingSite({ ...editingSite!, url: v })
											}
										>
											<Label>网站地址</Label>
											<InputGroup>
												<InputGroup.Input
													placeholder="https://..."
													style={{
														maxWidth: `calc(100% - 161px)`,
													}}
												/>
												<InputGroup.Suffix className="p-1!">
													<div className="flex gap-1">
														<Button
															size="sm"
															variant="tertiary"
															className={"rounded-lg h-7 px-2 gap-1 text-xs!"}
															isPending={fetchingInfo}
															isDisabled={capturingPreview}
															onPress={fetchWebsiteInfo}
														>
															{({ isPending }) => (
																<>
																	{isPending ? (
																		<Spinner color="current" size="sm" />
																	) : (
																		<BiGlobe className="size-4" />
																	)}
																	{isPending ? "获取中" : "网站信息"}
																</>
															)}
														</Button>
														<Button
															size="sm"
															variant="tertiary"
															className={"rounded-lg h-7 px-2 gap-1 text-xs!"}
															isPending={capturingPreview}
															isDisabled={fetchingInfo}
															onPress={captureWebsitePreview}
														>
															{({ isPending }) => (
																<>
																	{isPending ? (
																		<Spinner color="current" size="sm" />
																	) : (
																		<BiImage className="size-4" />
																	)}
																	{isPending ? "获取中" : "预览图"}
																</>
															)}
														</Button>
													</div>
												</InputGroup.Suffix>
											</InputGroup>
										</TextField>
										<TextField
											value={editingSite?.intranetUrl ?? ""}
											onChange={(v) =>
												setEditingSite({ ...editingSite!, intranetUrl: v })
											}
										>
											<Label>内网地址（可选）</Label>
											<Input placeholder="http://192.168.x.x:xxxx" />
										</TextField>
										<p className="text-xs text-default-500 -mt-2">
											“网站信息”更新名称、描述、标签和图标；“预览图”只抓取网站首屏截图。
										</p>
										<TextField
											value={editingSite?.title ?? ""}
											onChange={(v) =>
												setEditingSite({ ...editingSite!, title: v })
											}
										>
											<Label>网站名称</Label>
											<Input placeholder="例如：GitHub" />
										</TextField>
										<TextField
											value={editingSite?.description ?? ""}
											onChange={(v) =>
												setEditingSite({ ...editingSite!, description: v })
											}
										>
											<Label>描述</Label>
											<Input placeholder="可选" />
										</TextField>
										<TextField
											value={(editingSite?.tags ?? []).join(", ")}
											onChange={(v) =>
												setEditingSite({
													...editingSite!,
													tags: v
														.split(/[,，]/)
														.map((s) => s.trim())
														.filter(Boolean),
												})
											}
										>
											<Label>标签（逗号分隔）</Label>
											<Input placeholder="工具, 开发, 代码" />
										</TextField>
										<div className="flex flex-col gap-1">
											<Label>图标</Label>
											<IconPicker
												value={editingSite?.icon ?? ""}
												onChange={(v) =>
													setEditingSite({ ...editingSite!, icon: v })
												}
												bgColor={editingSite?.bgColor}
												onBgColorChange={(v) =>
													setEditingSite({ ...editingSite!, bgColor: v })
												}
												iconPadding={editingSite?.iconPadding}
												defaultIconPadding={defaultIconPadding}
												onIconPaddingChange={(v) =>
													setEditingSite({ ...editingSite!, iconPadding: v })
												}
											/>
										</div>
										<div className="flex flex-col gap-1">
											<Label>预览图</Label>
											<PreviewImagePicker
												value={editingSite?.previewImage ?? ""}
												onChange={(v) =>
													setEditingSite({
														...editingSite!,
														previewImage: v,
													})
												}
											/>
											<p className="text-xs text-default-500">
												选择“预览图卡片”样式后会展示这张图；留空时使用图标占位。
											</p>
										</div>
									</div>
								</Modal.Body>
								<Modal.Footer>
									<Button
										variant="tertiary"
										onPress={() => setIsModalOpen(false)}
									>
										取消
									</Button>
									<Button variant="primary" onPress={saveSite}>
										{editingIndex >= 0 ? "保存" : "新增"}
									</Button>
								</Modal.Footer>
							</Modal.Dialog>
						</Modal.Container>
					</Modal.Backdrop>

					<AlertDialog.Backdrop
						isOpen={deleteTarget !== null}
						onOpenChange={(open) => !open && setDeleteTarget(null)}
					>
						<AlertDialog.Container>
							<AlertDialog.Dialog className="sm:max-w-100">
								<AlertDialog.CloseTrigger />
								<AlertDialog.Header>
									<AlertDialog.Icon status="danger" />
									<AlertDialog.Heading>确认删除网址</AlertDialog.Heading>
								</AlertDialog.Header>
								<AlertDialog.Body>
									<p>
										删除{" "}
										<strong>{currentSites[deleteTarget ?? 0]?.title}</strong>{" "}
										后，该网址数据将被永久删除，此操作不可撤销。
									</p>
								</AlertDialog.Body>
								<AlertDialog.Footer>
									<Button slot="close" variant="tertiary">
										取消
									</Button>
									<Button
										slot="close"
										variant="danger"
										onPress={() => {
											if (deleteTarget !== null) {
												deleteSite(deleteTarget);
											}
										}}
									>
										确认删除
									</Button>
								</AlertDialog.Footer>
							</AlertDialog.Dialog>
						</AlertDialog.Container>
					</AlertDialog.Backdrop>
			</div>
			{createPortal(
				<DragOverlay dropAnimation={null}>
					{activeSite && activeRowSnapshot ? (
						<SiteDragPreview
							rowHtml={activeRowSnapshot.html}
							rowWidth={activeRowSnapshot.width}
							columnWidths={activeRowSnapshot.columnWidths}
						/>
					) : activeSite ? (
						<div className="rounded-md border border-default bg-background px-2 py-1 text-sm shadow-lg">
							{activeSite.title}
						</div>
					) : null}
				</DragOverlay>,
				document.body,
			)}
		</DndContext>
	);
}
