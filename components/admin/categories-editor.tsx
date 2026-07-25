"use client";

import {
	Button,
	Modal,
	Form,
	Input,
	Label,
	TextField,
	Description,
	AlertDialog,
	Chip,
	Select,
	ListBox,
	toast,
} from "@heroui/react";
import { ReactSortable } from "react-sortablejs";
import {
	memo,
	useEffect,
	useState,
	useMemo,
} from "react";
import type React from "react";
import {
	BiPlus,
	BiEdit,
	BiTrash,
	BiChevronUp,
	BiChevronDown,
	BiDotsVerticalRounded,
} from "react-icons/bi";
import type { NavCategory } from "@/types";
import { useAtom } from "jotai";
import { categoriesAtom } from "@/lib/store/admin";
import { getIconImageSrc } from "@/lib/icon";
import { IconPicker } from "./icon-picker";
import Loading from "./loading";

interface CategoryFormState {
	id: string;
	name: string;
	icon: string;
	description: string;
	parentId: string | null;
}

const emptyForm: CategoryFormState = {
	id: "",
	name: "",
	icon: "",
	description: "",
	parentId: null,
};

const parentRowGridCols = "minmax(0,15rem) 12rem minmax(0,1fr) 12.5rem";
const childRowGridCols = "minmax(0,12rem) 12rem minmax(0,1fr) 12.5rem";

function reorderItems<T>(items: T[], fromIndex: number, toIndex: number) {
	if (
		fromIndex === toIndex ||
		fromIndex < 0 ||
		toIndex < 0 ||
		fromIndex >= items.length ||
		toIndex >= items.length
	) {
		return items;
	}
	const next = [...items];
	const [moving] = next.splice(fromIndex, 1);
	next.splice(toIndex, 0, moving);
	return next;
}

function moveChildCategory(
	categories: NavCategory[],
	sourceParentId: string,
	targetParentId: string,
	sourceIndex: number,
	targetIndex: number,
) {
	const sourceParent = categories.find((category) => category.id === sourceParentId);
	const targetParent = categories.find((category) => category.id === targetParentId);
	const sourceChildren = sourceParent?.children ?? [];
	const movingCategory = sourceChildren[sourceIndex];
	if (!sourceParent || !targetParent || !movingCategory) return categories;

	if (sourceParentId === targetParentId) {
		const reordered = reorderItems(sourceChildren, sourceIndex, targetIndex);
		if (reordered === sourceChildren) return categories;
		return categories.map((category) =>
			category.id === sourceParentId
				? { ...category, children: reordered }
				: category,
		);
	}

	return categories.map((category) => {
		if (category.id === sourceParentId) {
			return {
				...category,
				children: sourceChildren.filter((_, index) => index !== sourceIndex),
			};
		}
		if (category.id === targetParentId) {
			const targetChildren = [...(category.children ?? [])];
			targetChildren.splice(
				Math.max(0, Math.min(targetIndex, targetChildren.length)),
				0,
				movingCategory,
			);
			return { ...category, children: targetChildren };
		}
		return category;
	});
}

const CategoryRow = memo(function CategoryRow({
	category,
	siblings,
	path,
	depth,
	onMove,
	onEdit,
	onAddChild,
	onDelete,
	children,
}: {
	category: NavCategory;
	siblings: NavCategory[];
	path: string[];
	depth: number;
	onMove: (categoryId: string, direction: "up" | "down") => void;
	onEdit: (category: NavCategory, path: string[]) => void;
	onAddChild: (parentId: string) => void;
	onDelete: (categoryId: string) => void;
	children?: React.ReactNode;
}) {
	const siteCount = category.sites?.length ?? 0;
	const canAddChild = depth === 0 && siteCount === 0;
	const siblingIdx = siblings.findIndex((c) => c.id === category.id);
	const siblingCount = siblings.length;
	const isFirst = siblingIdx <= 0;
	const isLast = siblingIdx >= siblingCount - 1;

	const renderIcon = () => {
		const icon = category.icon;
		if (!icon) return <span className="h-5 w-5" aria-hidden />;
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
		return <span className="w-5 text-center text-lg">{icon}</span>;
	};

	return (
		<div
			data-category-id={category.id}
			data-sortable-kind={depth === 0 ? "parent" : "child"}
			className={
				depth === 0
					? "category-parent-item flex flex-col gap-2"
					: "category-child-item flex flex-col gap-2"
			}
		>
			<div
				data-category-row-card
				className="grid w-full min-w-0 items-center gap-3 rounded-xl border border-default bg-background px-5 py-2.5 text-sm"
				style={{
					gridTemplateColumns:
						depth > 0 ? childRowGridCols : parentRowGridCols,
				}}
			>
				<div className="flex min-w-0 items-center gap-2">
					<span
						className="category-drag-handle inline-flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-default-400 transition hover:bg-default/40 hover:text-default-700 active:cursor-grabbing"
						aria-label="拖拽排序"
						role="button"
						tabIndex={0}
						style={{ touchAction: "none" }}
					>
						<BiDotsVerticalRounded className="size-4" />
					</span>
					{renderIcon()}
					<span className="truncate font-medium">{category.name}</span>
				</div>
				<div className="min-w-0">
					<code className="rounded bg-default/20 px-1.5 py-0.5 text-xs font-mono">
						{category.id}
					</code>
				</div>
				<div className="min-w-0 truncate text-default-500">
					{category.description || "-"}
				</div>
				<div className="min-w-0 overflow-hidden">
					<div className="flex items-center justify-start gap-1">
						<Button
							isIconOnly
							size="sm"
							variant="outline"
							className="h-9 w-9"
							aria-label="上移"
							isDisabled={isFirst}
							onPress={() => onMove(category.id, "up")}
						>
							<BiChevronUp />
						</Button>
						<Button
							isIconOnly
							size="sm"
							variant="outline"
							className="h-9 w-9"
							aria-label="下移"
							isDisabled={isLast}
							onPress={() => onMove(category.id, "down")}
						>
							<BiChevronDown />
						</Button>
						<Button
							isIconOnly
							size="sm"
							variant="outline"
							className="h-9 w-9"
							aria-label="编辑"
							onPress={() => onEdit(category, path)}
						>
							<BiEdit />
						</Button>
						{canAddChild && (
							<Button
								isIconOnly
								size="sm"
								variant="outline"
								className="h-9 w-9"
								aria-label="添加子分类"
								onPress={() => onAddChild(category.id)}
							>
								<BiPlus />
							</Button>
						)}
						<Button
							isIconOnly
							size="sm"
							variant="outline"
							className="h-9 w-9 text-danger"
							aria-label="删除"
							onPress={() => onDelete(category.id)}
						>
							<BiTrash />
						</Button>
					</div>
				</div>
			</div>
			{children}
		</div>
	);
});

export function CategoriesEditor() {
	const [categories, setCategories] = useAtom(categoriesAtom);
	const value = { categories };
	const onChange = (v: { categories: NavCategory[] }) =>
		setCategories(v.categories);
	const [isClientReady, setIsClientReady] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingCategory, setEditingCategory] = useState<{
		category: NavCategory;
		path: string[];
	} | null>(null);
	const [formState, setFormState] = useState<CategoryFormState>(emptyForm);
	const [deleteTarget, setDeleteTarget] = useState<{
		category: NavCategory;
		path: string[];
	} | null>(null);

	useEffect(() => {
		setIsClientReady(true);
	}, []);

	const flatCategories = useMemo(() => {
		const result: Array<{
			category: NavCategory;
			path: string[];
			level: number;
			hasChildren: boolean;
		}> = [];
		const traverse = (cats: NavCategory[], level: number, path: string[]) => {
			for (const cat of cats) {
				const currentPath = [...path, cat.id];
				const hasChildren = (cat.children?.length ?? 0) > 0;
				result.push({ category: cat, path: currentPath, level, hasChildren });
				if (cat.children && cat.children.length > 0) {
					traverse(cat.children, level + 1, currentPath);
				}
			}
		};
		traverse(value.categories, 0, []);
		return result;
	}, [value.categories]);

	const categoryPathMap = useMemo(() => {
		const map = new Map<string, string[]>();
		for (const item of flatCategories) {
			map.set(item.category.id, item.path);
		}
		return map;
	}, [flatCategories]);

	const parentOptions = useMemo(() => {
		return value.categories
			.filter((category) => (category.sites?.length ?? 0) === 0)
			.map((category) => ({
				id: category.id,
				name: category.name,
				level: 0,
			}));
	}, [value.categories]);

	const findCategoryPath = (
		targetId: string,
	): { category: NavCategory; path: string[] } | null => {
		const indexedPath = categoryPathMap.get(targetId);
		if (indexedPath) {
			const category = indexedPath.reduce<NavCategory | null>(
				(current, id, idx) => {
					if (idx === 0) {
						return value.categories.find((c) => c.id === id) ?? null;
					}
					return current?.children?.find((c) => c.id === id) ?? null;
				},
				null,
			);
			if (category) return { category, path: indexedPath };
		}
		const find = (
			cats: NavCategory[],
			path: string[],
		): { category: NavCategory; path: string[] } | null => {
			for (const cat of cats) {
				const currentPath = [...path, cat.id];
				if (cat.id === targetId) {
					return { category: cat, path: currentPath };
				}
				if (cat.children?.length) {
					const found = find(cat.children, currentPath);
					if (found) return found;
				}
			}
			return null;
		};
		return find(value.categories, []);
	};

	const addCategoryToTree = (
		cats: NavCategory[],
		newCat: NavCategory,
		parentId: string | null,
	): NavCategory[] => {
		if (!parentId) {
			return [...cats, newCat];
		}
		return cats.map((cat) => {
			if (cat.id === parentId) {
				return { ...cat, children: [...(cat.children ?? []), newCat] };
			}
			if (cat.children?.length) {
				return {
					...cat,
					children: addCategoryToTree(cat.children, newCat, parentId),
				};
			}
			return cat;
		});
	};

	const updateCategoryInTree = (
		cats: NavCategory[],
		path: string[],
		updated: NavCategory,
	): NavCategory[] => {
		return cats.map((cat) => {
			if (cat.id === path[0]) {
				if (path.length === 1) {
					return { ...cat, ...updated, id: cat.id, children: cat.children };
				}
				return {
					...cat,
					children: updateCategoryInTree(
						cat.children ?? [],
						path.slice(1),
						updated,
					),
				};
			}
			if (cat.children?.length) {
				return {
					...cat,
					children: updateCategoryInTree(cat.children, path, updated),
				};
			}
			return cat;
		});
	};

	const deleteCategoryFromTree = (
		cats: NavCategory[],
		path: string[],
	): NavCategory[] => {
		if (path.length === 1) {
			return cats.filter((c) => c.id !== path[0]);
		}
		return cats.map((cat) => {
			if (cat.id === path[0]) {
				return {
					...cat,
					children: deleteCategoryFromTree(cat.children ?? [], path.slice(1)),
				};
			}
			if (cat.children?.length) {
				return { ...cat, children: deleteCategoryFromTree(cat.children, path) };
			}
			return cat;
		});
	};

	const getChildrenByParentId = (
		cats: NavCategory[],
		parentId: string | null,
	): NavCategory[] => {
		if (parentId === null) return cats;
		const findById = (items: NavCategory[]): NavCategory | null => {
			for (const item of items) {
				if (item.id === parentId) return item;
				if (item.children?.length) {
					const found = findById(item.children);
					if (found) return found;
				}
			}
			return null;
		};
		return findById(cats)?.children ?? [];
	};

	const updateChildrenByParentId = (
		cats: NavCategory[],
		parentId: string | null,
		updater: (children: NavCategory[]) => NavCategory[],
	): NavCategory[] => {
		if (parentId === null) return updater(cats);
		let didUpdate = false;
		const next = cats.map((cat) => {
			if (cat.id === parentId) {
				didUpdate = true;
				return { ...cat, children: updater(cat.children ?? []) };
			}
			if (cat.children?.length) {
				const nextChildren = updateChildrenByParentId(
					cat.children,
					parentId,
					updater,
				);
				if (nextChildren !== cat.children) {
					didUpdate = true;
					return { ...cat, children: nextChildren };
				}
			}
			return cat;
		});
		return didUpdate ? next : cats;
	};

	if (!isClientReady) {
		return <Loading />;
	}

	const moveCategory = (categoryId: string, direction: "up" | "down") => {
		const target = findCategoryPath(categoryId);
		if (!target) return;
		const parentId =
			target.path.length > 1 ? target.path[target.path.length - 2] : null;
		const siblings = getChildrenByParentId(value.categories, parentId);
		const index = siblings.findIndex((c) => c.id === categoryId);
		const newIndex = direction === "up" ? index - 1 : index + 1;
		if (index < 0 || newIndex < 0 || newIndex >= siblings.length) return;
		const newCategories = updateChildrenByParentId(
			value.categories,
			parentId,
			(children) => reorderItems(children, index, newIndex),
		);
		onChange({ ...value, categories: newCategories });
	};

	const handleOpenAdd = (parentId: string | null = null) => {
		setEditingCategory(null);
		const shortId = Math.random().toString(36).slice(2, 8);
		setFormState({ ...emptyForm, parentId, id: shortId });
		setIsModalOpen(true);
	};

	const handleOpenEdit = (category: NavCategory, path: string[]) => {
		setEditingCategory({ category, path });
		setFormState({
			id: category.id,
			name: category.name,
			icon: category.icon ?? "",
			description: category.description || "",
			parentId: path.length > 1 ? path[path.length - 2] : null,
		});
		setIsModalOpen(true);
	};

	const handleSave = () => {
		if (!formState.name.trim()) return;

		const updatedCategory: NavCategory = {
			id: formState.id,
			name: formState.name.trim(),
			icon: formState.icon.trim() || undefined,
			description: formState.description.trim() || undefined,
			sites: editingCategory?.category.sites,
			children: editingCategory?.category.children,
		};

		if (editingCategory) {
			const newData = {
				...value,
				categories: updateCategoryInTree(
					value.categories,
					editingCategory.path,
					updatedCategory,
				),
			};
			onChange(newData);
			toast.success(`分类"${formState.name}"已更新，记得点击保存`);
		} else {
			const categoryToAdd = formState.parentId
				? updatedCategory
				: {
						...updatedCategory,
						children: [
							{
								id: `${formState.id}-default`,
								name: "默认分类",
								sites: [],
							},
						],
					};
			const newData = {
				...value,
				categories: addCategoryToTree(
					value.categories,
					categoryToAdd,
					formState.parentId,
				),
			};
			onChange(newData);
			toast.success(`分类"${formState.name}"已添加，记得点击保存`);
		}
		setIsModalOpen(false);
		setFormState(emptyForm);
		setEditingCategory(null);
	};

	const handleDelete = () => {
		if (!deleteTarget) return;

		const isChildCategory = deleteTarget.path.length > 1;
		if (isChildCategory) {
			const parentPath = deleteTarget.path.slice(0, -1);
			const getParent = (
				cats: NavCategory[],
				path: string[],
			): NavCategory | undefined => {
				if (path.length === 0) return undefined;
				let current = cats.find((c) => c.id === path[0]);
				for (let i = 1; i < path.length; i++) {
					if (!current?.children) return undefined;
					current = current.children.find((c) => c.id === path[i]);
				}
				return current;
			};
			const parent = getParent(value.categories, parentPath);
			const siblingCount = parent?.children?.length ?? 0;
			if (siblingCount <= 1) {
				toast.warning("无法删除", {
					description: "每个父级分类至少需要保留一个子分类",
				});
				setDeleteTarget(null);
				return;
			}
		}

		const newData = {
			...value,
			categories: deleteCategoryFromTree(value.categories, deleteTarget.path),
		};
		onChange(newData);
		toast.success(`分类"${deleteTarget.category.name}"已删除，记得点击保存`);
		setDeleteTarget(null);
	};

	const openDeleteDialog = (categoryId: string) => {
		const target = findCategoryPath(categoryId);
		if (target) setDeleteTarget(target);
	};

	const renderCategoryTree = () =>
		value.categories.map((parentCategory) => {
			const children = parentCategory.children ?? [];
			const parentPath = [parentCategory.id];
			const canHostChildren =
				(parentCategory.sites?.length ?? 0) === 0 || children.length > 0;
			return (
				<CategoryRow
					key={parentCategory.id}
					category={parentCategory}
					siblings={value.categories}
					path={parentPath}
					depth={0}
					onMove={moveCategory}
					onEdit={handleOpenEdit}
					onAddChild={handleOpenAdd}
					onDelete={openDeleteDialog}
				>
					{canHostChildren ? (
						<ReactSortable<NavCategory>
							list={children.map((category) => ({ ...category }))}
							setList={() => undefined}
							onEnd={(event) => {
								const sourceParentId = event.from.closest(
									"[data-category-id]",
								)?.getAttribute("data-category-id");
								const targetParentId = event.to.closest(
									"[data-category-id]",
								)?.getAttribute("data-category-id");
								const fromIndex = event.oldDraggableIndex;
								const toIndex = event.newDraggableIndex;
								if (
									!sourceParentId ||
									!targetParentId ||
									fromIndex === undefined ||
									toIndex === undefined
								) {
									return;
								}
								setCategories(
									moveChildCategory(
										categories,
										sourceParentId,
										targetParentId,
										fromIndex,
										toIndex,
									),
								);
							}}
							className="category-child-sortable-list relative ml-8 flex min-h-11 flex-col gap-2 border-l border-dashed border-default-300 py-2 pr-0 pb-3 pl-4 transition-colors"
							handle=".category-drag-handle"
							draggable=".category-child-item"
							group={{ name: "category-children", pull: true, put: true }}
							animation={160}
							easing="cubic-bezier(0.2, 0, 0, 1)"
							forceFallback
							fallbackOnBody
							fallbackTolerance={5}
							scroll
							bubbleScroll
							scrollSensitivity={80}
							scrollSpeed={12}
							emptyInsertThreshold={32}
							swapThreshold={0.65}
							invertSwap
							ghostClass="category-sortable-ghost"
							chosenClass="category-sortable-chosen"
							dragClass="category-sortable-drag"
							fallbackClass="category-sortable-fallback"
							direction="vertical"
						>
							{children.map((childCategory) => (
								<CategoryRow
									key={childCategory.id}
									category={childCategory}
									siblings={children}
									path={[parentCategory.id, childCategory.id]}
									depth={1}
									onMove={moveCategory}
									onEdit={handleOpenEdit}
									onAddChild={handleOpenAdd}
									onDelete={openDeleteDialog}
								/>
							))}
						</ReactSortable>
					) : null}
				</CategoryRow>
			);
		});

	return (
		<div
			className="flex flex-col gap-4"
			style={{
				minHeight: `calc(100dvh - 106px)`,
			}}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Chip
						variant="primary"
						color="accent"
						className="text-xs! font-medium"
					>
						{flatCategories.length} 个分类
					</Chip>
				</div>
				<Button
					variant="primary"
					size="sm"
					onPress={() => handleOpenAdd(null)}
					className={"h-9"}
				>
					<BiPlus data-icon="inline-start" />
					新增分类
				</Button>
			</div>

			<style>{`
				.category-sortable-ghost {
					position: relative !important;
					box-sizing: border-box !important;
					min-height: 58px !important;
					overflow: hidden !important;
					border: 0 !important;
					border-radius: 0.75rem !important;
					background: rgba(37, 99, 235, 0.18) !important;
					opacity: 1 !important;
				}
				.category-sortable-ghost > [data-category-row-card],
				.category-sortable-ghost > .category-child-sortable-list {
					opacity: 0 !important;
				}
				.category-sortable-ghost::before {
					position: absolute;
					z-index: 1;
					inset: 0;
					box-sizing: border-box;
					border: 2px dashed #3b82f6;
					border-radius: inherit;
					content: "";
					pointer-events: none;
				}
				.category-sortable-ghost::after {
					position: absolute;
					z-index: 2;
					inset: 0;
					display: flex;
					align-items: center;
					justify-content: center;
					content: "放到这里";
					color: #60a5fa;
					font-size: 0.75rem;
					font-weight: 600;
				}
				.category-sortable-fallback {
					z-index: 9999 !important;
					box-sizing: border-box !important;
					pointer-events: none !important;
					opacity: 1 !important;
					filter: drop-shadow(0 14px 20px rgba(0, 0, 0, 0.2));
				}
				.category-child-sortable-list:has(.category-sortable-ghost) {
					border-color: #3b82f6 !important;
					background: rgba(37, 99, 235, 0.08);
				}
				.category-child-sortable-list:empty::after {
					display: flex;
					height: 2.75rem;
					align-items: center;
					justify-content: center;
					border: 1px dashed var(--color-default-300);
					border-radius: 0.75rem;
					content: "拖动子分类到这里";
					color: var(--color-default-400);
					font-size: 0.75rem;
				}
			`}</style>

			<div className="overflow-x-auto rounded-xl border border-default bg-default/10">
				<div className="min-w-280">
					<div
						className="grid min-w-280 items-center gap-4 border-b border-default px-5 py-3 text-xs font-medium text-default-500"
						style={{ gridTemplateColumns: parentRowGridCols }}
					>
						<div>分类名称</div>
						<div>ID</div>
						<div>描述</div>
						<div className="text-left">操作</div>
					</div>
					<ReactSortable<NavCategory>
						list={value.categories.map((category) => ({ ...category }))}
						setList={() => undefined}
						onEnd={(event) => {
							const fromIndex = event.oldDraggableIndex;
							const toIndex = event.newDraggableIndex;
							if (
								fromIndex === undefined ||
								toIndex === undefined ||
								fromIndex === toIndex
							) {
								return;
							}
							setCategories(reorderItems(categories, fromIndex, toIndex));
						}}
						className="flex flex-col gap-2 p-2"
						handle=".category-drag-handle"
						draggable=".category-parent-item"
						group={{ name: "category-parents", pull: false, put: false }}
						animation={160}
						easing="cubic-bezier(0.2, 0, 0, 1)"
						forceFallback
						fallbackOnBody
						fallbackTolerance={5}
						scroll
						bubbleScroll
						scrollSensitivity={80}
						scrollSpeed={12}
						ghostClass="category-sortable-ghost"
						chosenClass="category-sortable-chosen"
						dragClass="category-sortable-drag"
						fallbackClass="category-sortable-fallback"
						direction="vertical"
					>
						{value.categories.length === 0 ? (
							<div className="py-12 text-center text-sm">
								暂无分类，点击右上角新增
							</div>
						) : (
							renderCategoryTree()
						)}
					</ReactSortable>
				</div>
			</div>

			<Modal.Backdrop
				isOpen={isModalOpen}
				onOpenChange={(open) => !open && setIsModalOpen(false)}
			>
				<Modal.Container>
					<Modal.Dialog className="sm:max-w-125">
						<Modal.CloseTrigger />
						<Modal.Header>
							<Modal.Heading>
								{editingCategory ? "编辑分类" : "新增分类"}
							</Modal.Heading>
						</Modal.Header>
						<Modal.Body>
							<Form
								className="flex flex-col gap-4"
								onSubmit={(e) => {
									e.preventDefault();
									handleSave();
								}}
							>
								<TextField
									isRequired
									name="name"
									value={formState.name}
									onChange={(v) => setFormState({ ...formState, name: v })}
								>
									<Label>分类名称</Label>
									<Input placeholder="请输入分类名称" />
								</TextField>

								<TextField
									isRequired
									name="id"
									value={formState.id}
									onChange={(v) => setFormState({ ...formState, id: v })}
									isReadOnly={!!editingCategory}
								>
									<Label>分类 ID</Label>
									<Input placeholder="唯一标识，如：tech" />
									<Description>唯一标识，创建后不可修改</Description>
								</TextField>

								<div className="flex flex-col gap-2">
									<Label>图标</Label>
									<IconPicker
										value={formState.icon}
										onChange={(v) => setFormState({ ...formState, icon: v })}
									/>
								</div>

								<TextField
									name="description"
									value={formState.description}
									onChange={(v) =>
										setFormState({ ...formState, description: v })
									}
								>
									<Label>描述（可选）</Label>
									<Input placeholder="分类描述" />
								</TextField>

								{!editingCategory && (
									<Select
										selectedKey={formState.parentId ?? ""}
										onSelectionChange={(key) => {
											setFormState({
												...formState,
												parentId: key ? String(key) : null,
											});
										}}
									>
										<Label>父级分类（可选）</Label>
										<Select.Trigger>
											<Select.Value />
											<Select.Indicator />
										</Select.Trigger>
										<Select.Popover>
											<ListBox>
												<ListBox.Item id="">
													无（顶级分类）
													<ListBox.ItemIndicator />
												</ListBox.Item>
												{parentOptions.map((opt) => (
													<ListBox.Item key={opt.id} id={opt.id}>
														{"　".repeat(opt.level)}
														{opt.name}
														<ListBox.ItemIndicator />
													</ListBox.Item>
												))}
											</ListBox>
										</Select.Popover>
									</Select>
								)}

								<div className="flex gap-2 justify-end">
									<Button
										type="button"
										variant="tertiary"
										onPress={() => {
											setIsModalOpen(false);
											setFormState(emptyForm);
											setEditingCategory(null);
										}}
									>
										取消
									</Button>
									<Button type="submit" variant="primary">
										{editingCategory ? "保存" : "新增"}
									</Button>
								</div>
							</Form>
						</Modal.Body>
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
							<AlertDialog.Heading>确认删除分类</AlertDialog.Heading>
						</AlertDialog.Header>
						<AlertDialog.Body>
							<p>
								删除 <strong>{deleteTarget?.category.name}</strong>{" "}
								后，其下的所有子分类和网站数据都将被永久删除，此操作不可撤销。
							</p>
						</AlertDialog.Body>
						<AlertDialog.Footer>
							<Button slot="close" variant="tertiary">
								取消
							</Button>
							<Button slot="close" variant="danger" onPress={handleDelete}>
								确认删除
							</Button>
						</AlertDialog.Footer>
					</AlertDialog.Dialog>
				</AlertDialog.Container>
			</AlertDialog.Backdrop>
		</div>
	);
}
