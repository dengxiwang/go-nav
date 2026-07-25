"use client";

import {
	Button,
	Chip,
	Drawer,
	Input,
	Label,
	ListBox,
	Modal,
	Select,
	Table,
	TextField,
} from "@heroui/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useMemo, useState } from "react";
import {
	BiChevronDown,
	BiChevronUp,
	BiCode,
	BiCodeAlt,
	BiGlobe,
	BiPencil,
	BiPlus,
	BiTrash,
} from "react-icons/bi";
import { pluginAtomFamily, pluginsAtom } from "@/lib/store/admin";
import type { PluginConfig } from "@/types";
import { AdminSwitch } from "./admin-switch";

type EditingState =
	| { mode: "create"; draft: PluginConfig }
	| { mode: "edit"; id: string; draft: PluginConfig }
	| null;

type PluginTypeCount = Record<PluginConfig["type"], number>;

const DEFAULT_EXTERNAL_SCRIPT_CODE =
	"window.addEventListener('load', () => {\n\t// 外链脚本加载后可在这里初始化\n});";
const TEMPLATE_MIRROR_HOST = "https://mirrors.sustech.edu.cn";

type PluginTemplateId = "preconnect" | "dns-prefetch" | "quicklink";

const PLUGIN_TEMPLATES: Array<{
	id: PluginTemplateId;
	label: string;
	description: string;
}> = [
	{
		id: "preconnect",
		label: "preconnect",
		description: "在 head 提前建立到镜像域名的连接",
	},
	{
		id: "dns-prefetch",
		label: "dns-prefetch",
		description: "为镜像域名预先做 DNS 解析",
	},
	{
		id: "quicklink",
		label: "quicklink",
		description: "注入 quicklink 脚本，按可见链接做预加载",
	},
];

function createPluginDraft(
	type: PluginConfig["type"],
	current?: Partial<PluginConfig>,
): PluginConfig {
	const base = {
		id:
			current?.id ??
			`plugin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
		name: current?.name ?? "新插件",
		enabled: current?.enabled ?? true,
		description: current?.description ?? "",
		sort: current?.sort,
		type,
	} satisfies Partial<PluginConfig>;

	if (type === "css") {
		return {
			...base,
			type,
			code:
				current?.type === "css"
					? (current.code ?? "")
					: "/* 在这里编写自定义 CSS */\nbody { /* ... */ }",
			loading: "sync",
			href: "",
			src: "",
			resourceHintRel: undefined,
			crossOrigin: "",
		};
	}

	if (type === "js") {
		return {
			...base,
			type,
			code:
				current?.type === "js"
					? (current.code ?? "")
					: "// 在这里编写内联 JavaScript\nconsole.log('hello from plugin');",
			loading: current?.type === "js" ? (current.loading ?? "sync") : "sync",
			href: "",
			src: "",
			resourceHintRel: undefined,
			crossOrigin: "",
		};
	}

	if (type === "resource-hint") {
		return {
			...base,
			type,
			code: "",
			loading: "sync",
			href: current?.type === "resource-hint" ? (current.href ?? "") : "",
			src: "",
			resourceHintRel:
				current?.type === "resource-hint"
					? (current.resourceHintRel ?? "preconnect")
					: "preconnect",
			crossOrigin:
				current?.type === "resource-hint"
					? (current.crossOrigin ?? "anonymous")
					: "anonymous",
		};
	}

	return {
		...base,
		type,
		code:
			current?.type === "external-script"
				? (current.code ?? "")
				: DEFAULT_EXTERNAL_SCRIPT_CODE,
		loading:
			current?.type === "external-script"
				? (current.loading ?? "defer")
				: "defer",
		href: "",
		src: current?.type === "external-script" ? (current.src ?? "") : "",
		resourceHintRel: undefined,
		crossOrigin:
			current?.type === "external-script"
				? (current.crossOrigin ?? "anonymous")
				: "anonymous",
	};
}

function makeEmptyPlugin() {
	return createPluginDraft("css");
}

function createTemplatePlugin(templateId: PluginTemplateId) {
	switch (templateId) {
		case "preconnect":
			return createPluginDraft("resource-hint", {
				type: "resource-hint",
				name: "SUSTech 镜像站 preconnect",
				description: "在 head 预先建立 mirrors.sustech.edu.cn 连接",
				href: TEMPLATE_MIRROR_HOST,
				resourceHintRel: "preconnect",
				crossOrigin: "anonymous",
			});
		case "dns-prefetch":
			return createPluginDraft("resource-hint", {
				type: "resource-hint",
				name: "SUSTech 镜像站 dns-prefetch",
				description: "在 head 为 mirrors.sustech.edu.cn 提前做 DNS 解析",
				href: TEMPLATE_MIRROR_HOST,
				resourceHintRel: "dns-prefetch",
				crossOrigin: "",
			});
		case "quicklink":
			return createPluginDraft("external-script", {
				type: "external-script",
				name: "Quicklink 链接预加载",
				description: "页面加载后为可见链接启用 quicklink 预加载",
				src: `${TEMPLATE_MIRROR_HOST}/cdnjs/ajax/libs/quicklink/3.0.1/quicklink.umd.min.js`,
				crossOrigin: "anonymous",
				loading: "defer",
				code: "window.addEventListener('load', () => {\n\tquicklink.listen();\n});",
			});
		default:
			return makeEmptyPlugin();
	}
}

function getPluginTypeLabel(type: PluginConfig["type"]) {
	switch (type) {
		case "css":
			return "CSS";
		case "js":
			return "内联 JS";
		case "resource-hint":
			return "资源提示";
		case "external-script":
			return "底部脚本";
		default:
			return type;
	}
}

function getPluginTypeColor(type: PluginConfig["type"]) {
	switch (type) {
		case "css":
			return "accent" as const;
		case "js":
			return "warning" as const;
		case "resource-hint":
			return "success" as const;
		case "external-script":
			return "danger" as const;
		default:
			return "default" as const;
	}
}

function getPluginSummary(plugin: PluginConfig) {
	if (plugin.type === "resource-hint") {
		return plugin.href?.trim() || "空";
	}
	if (plugin.type === "external-script") {
		if (plugin.src?.trim()) return plugin.src.trim();
		return plugin.code?.trim() ? `${plugin.code.trim().length} 字符` : "空";
	}
	return plugin.code?.trim() ? `${plugin.code.trim().length} 字符` : "空";
}

function getTypeIcon(type: PluginConfig["type"]) {
	if (type === "resource-hint") {
		return <BiGlobe className="size-4 shrink-0 text-sky-500" />;
	}
	if (type === "external-script") {
		return <BiCodeAlt className="size-4 shrink-0 text-violet-500" />;
	}
	if (type === "js") {
		return <BiCodeAlt className="size-4 shrink-0 text-orange-500" />;
	}
	return <BiCode className="size-4 shrink-0 text-blue-500" />;
}

export function PluginsEditor() {
	const [plugins, setPlugins] = useAtom(pluginsAtom);
	const [editing, setEditing] = useState<EditingState>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

	const counts = useMemo(() => {
		const byType: PluginTypeCount = {
			css: 0,
			js: 0,
			"resource-hint": 0,
			"external-script": 0,
		};
		let enabled = 0;
		for (const plugin of plugins) {
			byType[plugin.type] += 1;
			if (plugin.enabled) enabled += 1;
		}
		return { byType, enabled, total: plugins.length };
	}, [plugins]);

	const addPlugin = () => {
		setEditing({ mode: "create", draft: makeEmptyPlugin() });
	};

	const addTemplatePlugin = (templateId: PluginTemplateId) => {
		setPlugins([...plugins, createTemplatePlugin(templateId)]);
	};

	const movePlugin = (idx: number, dir: "up" | "down") => {
		const newIdx = dir === "up" ? idx - 1 : idx + 1;
		if (newIdx < 0 || newIdx >= plugins.length) return;
		const copy = plugins.slice();
		const [moved] = copy.splice(idx, 1);
		copy.splice(newIdx, 0, moved);
		setPlugins(copy);
	};

	const deletePlugin = (id: string) => {
		setPlugins(plugins.filter((p) => p.id !== id));
		setDeleteConfirm(null);
	};

	const commitEditing = () => {
		if (!editing) return;
		const draft = editing.draft;
		if (!draft.name.trim()) return;
		if ((draft.type === "css" || draft.type === "js") && !draft.code.trim()) {
			return;
		}
		if (draft.type === "resource-hint" && !draft.href?.trim()) return;
		if (
			draft.type === "external-script" &&
			!draft.src?.trim() &&
			!draft.code.trim()
		) {
			return;
		}

		if (editing.mode === "create") {
			setPlugins([...plugins, draft]);
		} else {
			const idx = plugins.findIndex((p) => p.id === editing.id);
			if (idx >= 0) {
				const copy = plugins.slice();
				copy[idx] = draft;
				setPlugins(copy);
			}
		}
		setEditing(null);
	};

	return (
		<div className="flex flex-col gap-4">
			<section className="flex flex-col gap-2">
				<div>
					<h3 className="text-sm font-semibold">插件管理</h3>
					<p className="mt-1 text-xs text-default-500">
						支持前台页面的自定义 CSS、头部资源提示、内联脚本和底部外链脚本。
					</p>
				</div>
				<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
					脚本类插件会在所有前台访问者浏览器中执行，只粘贴自己编写或完全信任来源的代码。备份导入时，脚本类插件会默认禁用，需要在这里人工确认后再启用。
				</div>
				<div className="flex flex-wrap gap-2 text-xs text-default-500">
					<Chip variant="secondary">
						<Chip.Label>共 {counts.total} 个</Chip.Label>
					</Chip>
					<Chip variant="secondary">
						<Chip.Label>启用 {counts.enabled}</Chip.Label>
					</Chip>
					<Chip variant="secondary">
						<Chip.Label>CSS {counts.byType.css}</Chip.Label>
					</Chip>
					<Chip variant="secondary">
						<Chip.Label>内联 JS {counts.byType.js}</Chip.Label>
					</Chip>
					<Chip variant="secondary">
						<Chip.Label>资源提示 {counts.byType["resource-hint"]}</Chip.Label>
					</Chip>
					<Chip variant="secondary">
						<Chip.Label>底部脚本 {counts.byType["external-script"]}</Chip.Label>
					</Chip>
				</div>
			</section>

			<div className="flex items-center justify-between">
				<h3 className="text-base font-semibold">插件列表</h3>
				<Button variant="primary" size="sm" onPress={addPlugin}>
					<BiPlus data-icon="inline-start" />
					新增插件
				</Button>
			</div>

			<section className="rounded-xl border border-default-200 px-4 py-3">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="min-w-0">
						<h4 className="text-sm font-semibold">一键模板</h4>
						<p className="mt-1 text-xs text-default-500">
							先塞入常用示例，再按你的域名或初始化代码继续改。
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						{PLUGIN_TEMPLATES.map((template) => (
							<Button
								key={template.id}
								size="sm"
								variant="outline"
								onPress={() => addTemplatePlugin(template.id)}
							>
								{template.label}
							</Button>
						))}
					</div>
				</div>
				<div className="mt-3 grid grid-cols-1 gap-2 text-xs text-default-500 md:grid-cols-3">
					{PLUGIN_TEMPLATES.map((template) => (
						<div
							key={`${template.id}-desc`}
							className="rounded-lg border border-default-200 px-3 py-2"
						>
							<p className="font-medium text-default-700 dark:text-default-300">
								{template.label}
							</p>
							<p className="mt-1 leading-5">{template.description}</p>
						</div>
					))}
				</div>
			</section>

			{plugins.length === 0 ? (
				<div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-800">
					<div className="text-center">
						<BiCode className="mx-auto mb-2 size-8" />
						<p className="text-sm text-default-500">暂无插件，点击右上角新增</p>
					</div>
				</div>
			) : (
				<Table variant="secondary" aria-label="插件列表">
					<Table.ScrollContainer>
						<Table.Content aria-label="插件列表">
							<Table.Header>
								<Table.Column className="w-20">启用</Table.Column>
								<Table.Column isRowHeader className="min-w-64">
									名称
								</Table.Column>
								<Table.Column className="w-32">类型</Table.Column>
								<Table.Column className="min-w-72">描述</Table.Column>
								<Table.Column className="w-104">内容</Table.Column>
								<Table.Column className="w-40">操作</Table.Column>
							</Table.Header>
							<Table.Body
								renderEmptyState={() => (
									<div className="py-12 text-center text-sm text-gray-400">
										暂无插件
									</div>
								)}
							>
								{plugins.map((plugin, idx) => (
									<PluginRow
										key={plugin.id}
										pluginId={plugin.id}
										isFirst={idx === 0}
										isLast={idx === plugins.length - 1}
										onEdit={() =>
											setEditing({
												mode: "edit",
												id: plugin.id,
												draft: { ...plugin },
											})
										}
										onDelete={() => setDeleteConfirm(plugin.id)}
										onMoveUp={() => movePlugin(idx, "up")}
										onMoveDown={() => movePlugin(idx, "down")}
									/>
								))}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
			)}

				<Drawer.Backdrop
					isOpen={editing !== null}
					onOpenChange={(open) => !open && setEditing(null)}
				>
					<Drawer.Content placement="right">
						<Drawer.Dialog className="w-dvw max-w-xl bg-white dark:bg-neutral-900">
							<Drawer.CloseTrigger />
							<Drawer.Header>
								<Drawer.Heading>
									{editing?.mode === "edit" ? "编辑插件" : "新增插件"}
								</Drawer.Heading>
							</Drawer.Header>
							<Drawer.Body>
								{editing ? (
									<PluginForm
										value={editing.draft}
										onChange={(draft) =>
											setEditing(
												editing.mode === "edit"
													? { ...editing, draft }
													: { mode: "create", draft },
											)
										}
									/>
								) : null}
							</Drawer.Body>
							<Drawer.Footer>
								<Button variant="outline" onPress={() => setEditing(null)}>
									取消
								</Button>
								<Button variant="primary" onPress={commitEditing}>
									{editing?.mode === "edit" ? "保存修改" : "添加"}
								</Button>
							</Drawer.Footer>
						</Drawer.Dialog>
					</Drawer.Content>
				</Drawer.Backdrop>

				<Modal.Backdrop
					isOpen={deleteConfirm !== null}
					onOpenChange={(open) => !open && setDeleteConfirm(null)}
				>
					<Modal.Container>
						<Modal.Dialog>
							<Modal.Header>
								<Modal.Heading>确认删除插件</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<p className="text-sm text-gray-600 dark:text-neutral-300">
									删除后该插件配置将被永久移除，此操作不可撤销。
								</p>
							</Modal.Body>
							<Modal.Footer>
								<Button
									variant="outline"
									onPress={() => setDeleteConfirm(null)}
								>
									取消
								</Button>
								<Button
									variant="danger"
									onPress={() => {
										if (deleteConfirm) deletePlugin(deleteConfirm);
									}}
								>
									确认删除
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
		</div>
	);
}

function PluginRow({
	pluginId,
	isFirst,
	isLast,
	onEdit,
	onDelete,
	onMoveUp,
	onMoveDown,
}: {
	pluginId: string;
	isFirst: boolean;
	isLast: boolean;
	onEdit: () => void;
	onDelete: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
}) {
	const plugin = useAtomValue(pluginAtomFamily(pluginId));
	const patchPlugin = useSetAtom(pluginAtomFamily(pluginId));
	if (!plugin) return null;

	return (
		<Table.Row key={plugin.id} id={plugin.id}>
			<Table.Cell>
				<AdminSwitch
					isSelected={plugin.enabled}
					onChange={(selected) => patchPlugin({ enabled: selected })}
					ariaLabel="启用"
				/>
			</Table.Cell>
			<Table.Cell className="max-w-[18rem]">
				<div className="flex min-w-0 items-center gap-2">
					{getTypeIcon(plugin.type)}
					<span className="min-w-0 truncate text-sm font-medium">
						{plugin.name}
					</span>
				</div>
			</Table.Cell>
			<Table.Cell className="w-32">
				<Chip
					variant="secondary"
					color={getPluginTypeColor(plugin.type)}
					size="sm"
					className="max-w-full shrink-0 whitespace-nowrap text-xs!"
				>
					<Chip.Label>{getPluginTypeLabel(plugin.type)}</Chip.Label>
				</Chip>
			</Table.Cell>
			<Table.Cell className="max-w-88">
				<span className="block truncate text-xs text-default-500">
					{plugin.description || "—"}
				</span>
			</Table.Cell>
			<Table.Cell className="max-w-104">
				<span className="block truncate text-xs text-default-500">
					{getPluginSummary(plugin)}
				</span>
			</Table.Cell>
			<Table.Cell>
				<div className="flex items-center gap-1">
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						aria-label="编辑"
						onPress={onEdit}
					>
						<BiPencil />
					</Button>
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						aria-label="上移"
						isDisabled={isFirst}
						onPress={onMoveUp}
					>
						<BiChevronUp />
					</Button>
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						aria-label="下移"
						isDisabled={isLast}
						onPress={onMoveDown}
					>
						<BiChevronDown />
					</Button>
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						className="text-danger"
						aria-label="删除"
						onPress={onDelete}
					>
						<BiTrash />
					</Button>
				</div>
			</Table.Cell>
		</Table.Row>
	);
}

function PluginForm({
	value,
	onChange,
}: {
	value: PluginConfig;
	onChange: (value: PluginConfig) => void;
}) {
	const patch = (partial: Partial<PluginConfig>) =>
		onChange({ ...value, ...partial });
	const isCss = value.type === "css";
	const isInlineJs = value.type === "js";
	const isResourceHint = value.type === "resource-hint";
	const isExternalScript = value.type === "external-script";
	const isScriptLike = isInlineJs || isExternalScript;

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">插件名称</Label>
					<TextField
						value={value.name}
						onChange={(next) => patch({ name: next })}
					>
						<Label className="sr-only">name</Label>
						<Input placeholder="例如：Quicklink 预加载" />
					</TextField>
				</div>
				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">类型</Label>
					<Select
						selectedKey={value.type}
						onSelectionChange={(key) => {
							if (!key) return;
							onChange(
								createPluginDraft(String(key) as PluginConfig["type"], value),
							);
						}}
					>
						<Label className="sr-only">type</Label>
						<Select.Trigger>
							<Select.Value />
							<Select.Indicator />
						</Select.Trigger>
						<Select.Popover>
							<ListBox>
								<ListBox.Item id="css" textValue="自定义 CSS">
									自定义 CSS
									<ListBox.ItemIndicator />
								</ListBox.Item>
								<ListBox.Item id="js" textValue="内联 JS">
									内联 JS
									<ListBox.ItemIndicator />
								</ListBox.Item>
								<ListBox.Item
									id="resource-hint"
									textValue="头部预连接 / 预解析"
								>
									头部预连接 / 预解析
									<ListBox.ItemIndicator />
								</ListBox.Item>
								<ListBox.Item id="external-script" textValue="底部外链脚本">
									底部外链脚本
									<ListBox.ItemIndicator />
								</ListBox.Item>
							</ListBox>
						</Select.Popover>
					</Select>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">描述（可选）</Label>
				<TextField
					value={value.description ?? ""}
					onChange={(next) => patch({ description: next })}
				>
					<Label className="sr-only">description</Label>
					<Input placeholder="方便后台识别用途" />
				</TextField>
			</div>

			{isResourceHint ? (
				<>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div className="flex flex-col gap-2">
							<Label className="text-sm font-medium">提示类型</Label>
							<Select
								selectedKey={value.resourceHintRel ?? "preconnect"}
								onSelectionChange={(key) => {
									if (!key) return;
									patch({
										resourceHintRel: String(
											key,
										) as PluginConfig["resourceHintRel"],
									});
								}}
							>
								<Label className="sr-only">resourceHintRel</Label>
								<Select.Trigger>
									<Select.Value />
									<Select.Indicator />
								</Select.Trigger>
								<Select.Popover>
									<ListBox>
										<ListBox.Item id="preconnect">
											preconnect
											<ListBox.ItemIndicator />
										</ListBox.Item>
										<ListBox.Item id="dns-prefetch">
											dns-prefetch
											<ListBox.ItemIndicator />
										</ListBox.Item>
									</ListBox>
								</Select.Popover>
							</Select>
						</div>
						<div className="flex flex-col gap-2">
							<Label className="text-sm font-medium">crossorigin</Label>
							<Select
								selectedKey={value.crossOrigin || "anonymous"}
								onSelectionChange={(key) => {
									if (!key) return;
									patch({
										crossOrigin:
											String(key) === "none"
												? ""
												: (String(key) as PluginConfig["crossOrigin"]),
									});
								}}
							>
								<Label className="sr-only">crossOrigin</Label>
								<Select.Trigger>
									<Select.Value />
									<Select.Indicator />
								</Select.Trigger>
								<Select.Popover>
									<ListBox>
										<ListBox.Item id="anonymous">
											anonymous
											<ListBox.ItemIndicator />
										</ListBox.Item>
										<ListBox.Item id="use-credentials">
											use-credentials
											<ListBox.ItemIndicator />
										</ListBox.Item>
										<ListBox.Item id="none">
											不添加
											<ListBox.ItemIndicator />
										</ListBox.Item>
									</ListBox>
								</Select.Popover>
							</Select>
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<Label className="text-sm font-medium">目标域名 / 地址</Label>
						<TextField
							value={value.href ?? ""}
							onChange={(next) => patch({ href: next })}
						>
							<Label className="sr-only">href</Label>
							<Input placeholder="https://mirrors.sustech.edu.cn" />
						</TextField>
						<p className="text-xs text-default-500">
							会在前台页面的 <code>{`<head>`}</code>{" "}
							中生成资源提示标签，适合常访问的外部域名。
						</p>
					</div>
				</>
			) : null}

			{isExternalScript ? (
				<>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div className="flex flex-col gap-2">
							<Label className="text-sm font-medium">脚本地址</Label>
							<TextField
								value={value.src ?? ""}
								onChange={(next) => patch({ src: next })}
							>
								<Label className="sr-only">src</Label>
								<Input placeholder="https://.../quicklink.umd.min.js" />
							</TextField>
						</div>
						<div className="flex flex-col gap-2">
							<Label className="text-sm font-medium">crossorigin</Label>
							<Select
								selectedKey={value.crossOrigin || "anonymous"}
								onSelectionChange={(key) => {
									if (!key) return;
									patch({
										crossOrigin:
											String(key) === "none"
												? ""
												: (String(key) as PluginConfig["crossOrigin"]),
									});
								}}
							>
								<Label className="sr-only">crossOrigin</Label>
								<Select.Trigger>
									<Select.Value />
									<Select.Indicator />
								</Select.Trigger>
								<Select.Popover>
									<ListBox>
										<ListBox.Item id="anonymous">
											anonymous
											<ListBox.ItemIndicator />
										</ListBox.Item>
										<ListBox.Item id="use-credentials">
											use-credentials
											<ListBox.ItemIndicator />
										</ListBox.Item>
										<ListBox.Item id="none">
											不添加
											<ListBox.ItemIndicator />
										</ListBox.Item>
									</ListBox>
								</Select.Popover>
							</Select>
						</div>
					</div>
				</>
			) : null}

			{isScriptLike ? (
				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">加载模式</Label>
					<Select
						selectedKey={value.loading ?? "sync"}
						onSelectionChange={(key) => {
							if (!key) return;
							patch({ loading: String(key) as PluginConfig["loading"] });
						}}
					>
						<Label className="sr-only">loading</Label>
						<Select.Trigger>
							<Select.Value />
							<Select.Indicator />
						</Select.Trigger>
						<Select.Popover>
							<ListBox>
								<ListBox.Item id="sync">
									同步（默认）
									<ListBox.ItemIndicator />
								</ListBox.Item>
								<ListBox.Item id="defer">
									defer（推荐）
									<ListBox.ItemIndicator />
								</ListBox.Item>
								<ListBox.Item id="async">
									async
									<ListBox.ItemIndicator />
								</ListBox.Item>
							</ListBox>
						</Select.Popover>
					</Select>
				</div>
			) : null}

			{isCss || isInlineJs || isExternalScript ? (
				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between">
						<Label className="text-sm font-medium">
							{isCss
								? "代码内容（CSS）"
								: isExternalScript
									? "初始化代码（可选）"
									: "代码内容（JavaScript）"}
						</Label>
						<span className="text-xs text-default-500">
							{value.code?.length ?? 0} 字符
						</span>
					</div>
					<textarea
						value={value.code}
						onChange={(event) => patch({ code: event.target.value })}
						placeholder={
							isCss
								? "/* 在这里编写自定义 CSS */\nbody { /* ... */ }"
								: isExternalScript
									? DEFAULT_EXTERNAL_SCRIPT_CODE
									: "// 在这里编写内联 JavaScript\nconsole.log('hello from plugin');"
						}
						spellCheck={false}
						rows={14}
						className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
					/>
					<p className="text-xs text-default-500">
						{isCss
							? "CSS 会注入到前台页面的 head，可用于覆盖主题样式。"
							: isExternalScript
								? "会先插入外链 script，再在底部追加这段初始化代码。适合 quicklink 这类脚本。"
								: "内联 JS 会在前台页面底部插入 script 执行。请注意安全，避免引入来源不明的代码。"}
					</p>
				</div>
			) : null}

			<div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-neutral-800">
				<Label className="text-sm font-medium">启用此插件</Label>
				<AdminSwitch
					isSelected={value.enabled}
					onChange={(selected) => patch({ enabled: selected })}
				>
					<span className="text-sm">
						{value.enabled ? "已启用" : "已停用"}
					</span>
				</AdminSwitch>
			</div>
		</div>
	);
}
