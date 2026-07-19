"use client";

import {
    Button,
    Input,
    Label,
    Separator,
    TextField,
} from "@heroui/react";
import { BiSun, BiMoon, BiDesktop } from "react-icons/bi";
import type { CardStyle, LayoutConfig, ThemeMode, NavConfig } from "@/types";
import { useAtom, useSetAtom } from "jotai";
import { navAtom, navFieldAtom } from "@/lib/store/admin";
import { DEFAULT_LAYOUT } from "@/lib/store/site";
import { IconPicker } from "./icon-picker";
import { AdminSwitch } from "./admin-switch";

export type WebsiteSection = "basic" | "layout" | "theme" | "footer";

const DEFAULT_RECENT_VISITS_MAX = 10;

export function WebsiteEditor({
	section = "basic",
}: {
	section?: WebsiteSection;
}) {
	const [value, setValue] = useAtom(navAtom);
	const setLayout = useSetAtom(navFieldAtom("layout"));
	const setShowRecentVisits = useSetAtom(navFieldAtom("showRecentVisits"));
	const setRecentVisitsMax = useSetAtom(navFieldAtom("recentVisitsMax"));
	const patch = (p: Partial<NavConfig>) => {
		setValue({ ...value, ...p });
	};

	if (section === "layout") {
		return (
			<LayoutEditor
				layout={value.layout}
				onChange={setLayout}
				showRecentVisits={value.showRecentVisits}
				onShowRecentVisitsChange={setShowRecentVisits}
				recentVisitsMax={value.recentVisitsMax}
				onRecentVisitsMaxChange={setRecentVisitsMax}
			/>
		);
	}

	if (section === "theme") {
		return <ThemeEditor value={value} onPatch={patch} />;
	}

	if (section === "footer") {
		return <FooterEditor value={value} onPatch={patch} />;
	}

	return <BasicEditor value={value} onPatch={patch} />;
}

function BasicEditor({
	value,
	onPatch,
}: {
	value: NavConfig;
	onPatch: (p: Partial<NavConfig>) => void;
}) {
	return (
		<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">站点标题</Label>
				<TextField value={value.title} onChange={(v) => onPatch({ title: v })}>
					<Label className="sr-only">title</Label>
					<Input placeholder="浏览器标签标题" />
				</TextField>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">站点名称</Label>
				<TextField value={value.name} onChange={(v) => onPatch({ name: v })}>
					<Label className="sr-only">name</Label>
					<Input placeholder="左上角显示名" />
				</TextField>
			</div>

			<div className="flex flex-col gap-2 md:col-span-2">
				<Label className="text-sm font-medium">站点描述</Label>
				<TextField
					value={value.description}
					onChange={(v) => onPatch({ description: v })}
				>
					<Label className="sr-only">description</Label>
					<Input placeholder="网站描述，用于 SEO" />
				</TextField>
			</div>

			<div className="flex flex-col gap-2 md:col-span-2">
				<Label className="text-sm font-medium">关键词</Label>
				<TextField
					value={value.keywords?.join(", ") ?? ""}
					onChange={(v) =>
						onPatch({
							keywords: v
								.split(",")
								.map((s) => s.trim())
								.filter(Boolean),
						})
					}
				>
					<Label className="sr-only">keywords</Label>
					<Input placeholder="导航, nav, 书签" />
				</TextField>
				<p className="text-xs text-gray-400 dark:text-neutral-500">
					多个关键词用逗号分隔
				</p>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">Logo</Label>
				<IconPicker
					value={value.logo}
					uploadPrefix="logo"
					onChange={(v) => onPatch({ logo: v })}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">Favicon</Label>
				<IconPicker
					value={value.favicon}
					uploadPrefix="favicon"
					onChange={(v) => onPatch({ favicon: v })}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">作者</Label>
				<TextField
					value={value.author}
					onChange={(v) => onPatch({ author: v })}
				>
					<Label className="sr-only">author</Label>
					<Input />
				</TextField>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">版权</Label>
				<TextField
					value={value.copyright}
					onChange={(v) => onPatch({ copyright: v })}
				>
					<Label className="sr-only">copyright</Label>
					<Input />
				</TextField>
			</div>
		</div>
	);
}

function ThemeEditor({
	value,
	onPatch,
}: {
	value: NavConfig;
	onPatch: (p: Partial<NavConfig>) => void;
}) {
	const patchCardStyle = (cardStyle: CardStyle) => {
		onPatch({ layout: { ...(value.layout ?? {}), cardStyle } });
	};

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
					主题模式
				</h3>
				<p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
					决定站点的默认配色方案。"跟随系统"会根据访客操作系统偏好自动切换。
				</p>
			</div>
			<div className="grid grid-cols-3 gap-4">
				{(
					[
						{
							key: "light" as ThemeMode,
							icon: BiSun,
							label: "浅色",
							desc: "明亮清新",
						},
						{
							key: "dark" as ThemeMode,
							icon: BiMoon,
							label: "深色",
							desc: "护眼沉浸",
						},
						{
							key: "system" as ThemeMode,
							icon: BiDesktop,
							label: "跟随系统",
							desc: "自动切换",
						},
					] as const
				).map((mode) => {
					const active = (value.themeMode ?? "light") === mode.key;
					const Icon = mode.icon;
					return (
						<button
							key={mode.key}
							type="button"
							onClick={() => onPatch({ themeMode: mode.key })}
							className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-6 transition-all ${
								active
									? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300"
									: "border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
							}`}
						>
							<Icon className="w-6! h-6!" />
							<span className="text-base! font-medium">{mode.label}</span>
							<span className="text-xs font-medium opacity-60">
								{mode.desc}
							</span>
						</button>
					);
				})}
			</div>

			<Separator />

			<div>
				<h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
					卡片样式
				</h3>
				<p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
					常规样式保留当前紧凑卡片；预览图样式会展示网址的预览图，适合更视觉化的首页。
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{(
					[
						{
							key: "compact" as CardStyle,
							label: "常规卡片",
							desc: "紧凑、信息密度高",
						},
						{
							key: "preview" as CardStyle,
							label: "预览图卡片",
							desc: "类似 Vercel 模板卡片",
						},
					] as const
				).map((item) => {
					const active = (value.layout?.cardStyle ?? "compact") === item.key;
					return (
						<button
							key={item.key}
							type="button"
							onClick={() => patchCardStyle(item.key)}
							className={`cursor-pointer rounded-2xl border p-4 text-left transition-all ${
								active
									? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200"
									: "border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
							}`}
						>
							<div className="mb-4 flex h-28 items-center justify-center rounded-xl bg-white/80 p-3 shadow-inner dark:bg-neutral-950/60">
								{item.key === "compact" ? (
									<div className="flex w-full max-w-64 items-center gap-3 rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-800">
										<div className="size-10 rounded-full bg-blue-100 dark:bg-blue-950" />
										<div className="min-w-0 flex-1">
											<div className="h-3 w-24 rounded bg-zinc-900/80 dark:bg-zinc-100/80" />
											<div className="mt-2 h-2 w-36 rounded bg-zinc-300 dark:bg-zinc-600" />
										</div>
									</div>
								) : (
									<div className="relative h-full w-full max-w-64 overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
										<div className="p-4">
											<div className="h-3 w-28 rounded bg-zinc-900/80 dark:bg-zinc-100/80" />
											<div className="mt-2 h-2 w-40 rounded bg-zinc-300 dark:bg-zinc-600" />
										</div>
										<div className="absolute -bottom-4.5 left-8 h-16 w-48 -rotate-6 rounded-lg border bg-linear-to-br from-zinc-100 to-zinc-300 shadow-lg dark:border-white/10 dark:from-zinc-800 dark:to-zinc-950" />
									</div>
								)}
							</div>
							<div className="text-sm font-semibold">{item.label}</div>
							<div className="mt-1 text-xs opacity-65">{item.desc}</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}

function FooterEditor({
	value,
	onPatch,
}: {
	value: NavConfig;
	onPatch: (p: Partial<NavConfig>) => void;
}) {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">ICP 备案号</Label>
				<TextField value={value.icp} onChange={(v) => onPatch({ icp: v })}>
					<Label className="sr-only">icp</Label>
					<Input placeholder="京ICP备xxxxxxxx号-1 / 留空" />
				</TextField>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">公安备案号</Label>
				<TextField value={value.beian} onChange={(v) => onPatch({ beian: v })}>
					<Label className="sr-only">beian</Label>
					<Input placeholder="留空则不显示" />
				</TextField>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">底部声明</Label>
				<TextField
					value={value.copyright}
					onChange={(v) => onPatch({ copyright: v })}
				>
					<Label className="sr-only">copyright</Label>
					<Input />
				</TextField>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">公众号二维码</Label>
				<IconPicker
					value={value.qrCode}
					uploadPrefix="qr-code"
					onChange={(v) => onPatch({ qrCode: v })}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">二维码提示文字</Label>
				<TextField
					value={value.qrCodeText}
					onChange={(v) => onPatch({ qrCodeText: v })}
				>
					<Label className="sr-only">qrCodeText</Label>
					<Input placeholder="微信扫码关注" />
				</TextField>
			</div>

			<Separator />

			<div className="flex items-center justify-between">
				<span className="text-sm font-medium">底部链接</span>
				<Button
					size="sm"
					variant="outline"
					onPress={() =>
						onPatch({
							footerLinks: [
								...(value.footerLinks ?? []),
								{ label: "新链接", href: "#" },
							],
						})
					}
				>
					+ 添加链接
				</Button>
			</div>

			{(value.footerLinks ?? []).map((link, idx) => (
				<div
					key={`${idx}-${link.label}`}
					className="flex flex-wrap items-center gap-3"
				>
					<TextField
						value={link.label}
						className="flex-1 min-w-40"
						onChange={(v) => {
							const next = [...(value.footerLinks ?? [])];
							next[idx] = { ...next[idx], label: v };
							onPatch({ footerLinks: next });
						}}
					>
						<Label className="sr-only">label</Label>
						<Input placeholder="显示文案" variant="secondary" />
					</TextField>
					<TextField
						value={link.href}
						className="flex-2 min-w-50"
						onChange={(v) => {
							const next = [...(value.footerLinks ?? [])];
							next[idx] = { ...next[idx], href: v };
							onPatch({ footerLinks: next });
						}}
					>
						<Label className="sr-only">href</Label>
						<Input placeholder="跳转链接" variant="secondary" />
					</TextField>
					<Button
						size="sm"
						variant="tertiary"
						className="text-red-600 dark:text-red-400"
						onPress={() => {
							const next = (value.footerLinks ?? []).filter(
								(_, i) => i !== idx,
							);
							onPatch({ footerLinks: next });
						}}
					>
						删除
					</Button>
				</div>
			))}
		</div>
	);
}

function LayoutEditor({
	layout,
	onChange,
	showRecentVisits,
	onShowRecentVisitsChange,
	recentVisitsMax,
	onRecentVisitsMaxChange,
}: {
	layout?: LayoutConfig;
	onChange: (v: LayoutConfig) => void;
	showRecentVisits?: boolean;
	onShowRecentVisitsChange: (value: boolean) => void;
	recentVisitsMax?: number;
	onRecentVisitsMaxChange: (value: number | undefined) => void;
}) {
	const l = layout ?? {};
	const patch = (p: Partial<LayoutConfig>) => onChange({ ...l, ...p });
	const getLayoutValue = (key: keyof LayoutConfig) =>
		l[key] ?? DEFAULT_LAYOUT[key];
	const getToggleValue = (key: keyof LayoutConfig) => {
		if (key === "showFooterQrCode" && !getLayoutValue("showFooter")) {
			return false;
		}
		if (
			key === "showFloatingQrCode" &&
			!getLayoutValue("showFloatingActions")
		) {
			return false;
		}
		if (
			key === "showCategoryDescription" &&
			!getLayoutValue("showCategoryTitle")
		) {
			return false;
		}
		if (key === "linkTarget") {
			return getLayoutValue(key) === "new";
		}

		return Boolean(getLayoutValue(key));
	};
	const patchToggle = (key: keyof LayoutConfig, value: boolean) => {
		const next: Partial<LayoutConfig> = { [key]: value };

		if (key === "showFooter" && !value) {
			next.showFooterQrCode = false;
		}
		if (key === "showFloatingActions" && !value) {
			next.showFloatingQrCode = false;
		}
		if (key === "showCategoryTitle" && !value) {
			next.showCategoryDescription = false;
		}
		if (key === "linkTarget") {
			next.linkTarget = value ? "new" : "current";
		}

		patch(next);
	};

	type ToggleItem = {
		label: string;
		disabled?: boolean;
	} &
		(
			| { kind?: "layout"; key: keyof LayoutConfig }
			| { kind: "recentVisits"; key: "showRecentVisits" }
		);

	const displayToggleItems: ToggleItem[] = [
		{ label: "显示左侧侧边栏（桌面端）", key: "showSidebar" },
		{ label: "显示搜索栏", key: "showSearch" },
		{ label: "分类导航栏搜索", key: "showCategorySearch" },
		{ label: "显示分类标题", key: "showCategoryTitle" },
		{
			label: "显示分类描述",
			key: "showCategoryDescription",
			disabled: !getLayoutValue("showCategoryTitle"),
		},
		{
			label: "右侧使用 Tabs 切换二级分类",
			key: "showSubcategoryTabs",
		},
		{ label: "显示页脚", key: "showFooter" },
		{
			label: "页脚显示二维码",
			key: "showFooterQrCode",
			disabled: !getLayoutValue("showFooter"),
		},
		{ label: "显示浮动操作按钮", key: "showFloatingActions" },
		{
			label: "浮动按钮显示二维码入口",
			key: "showFloatingQrCode",
			disabled: !getLayoutValue("showFloatingActions"),
		},
		{
			kind: "recentVisits",
			label: "显示最近访问",
			key: "showRecentVisits",
		},
	];

	const behaviorToggleItems: ToggleItem[] = [
		{
			label: "新标签页打开链接",
			key: "linkTarget",
		},
		{
			label: "自动访问内网（可达时优先）",
			key: "autoUseIntranet",
		},
		{
			label: "点击卡片先进入网址详情页",
			key: "enableSiteDetailPage",
		},
	];

	const spacingFields: {
		label: string;
		key: keyof LayoutConfig;
		placeholder: string;
	}[] = [
		{
			label: "内容区最大宽度",
			key: "maxWidth",
			placeholder: "1200px / 1400px / 100%",
		},
		{
			label: "侧边栏宽度",
			key: "sidebarWidth",
			placeholder: "224px / 200px",
		},
		{
			label: "内容区左侧内边距",
			key: "contentPaddingLeft",
			placeholder: "8px / 16px（有侧边栏时较小）",
		},
		{
			label: "内容区右侧内边距",
			key: "contentPaddingRight",
			placeholder: "16px / 24px",
		},
		{
			label: "分类间距",
			key: "sectionGap",
			placeholder: "16px / 24px",
		},
		{
			label: "卡片网格内边距",
			key: "cardGridPadding",
			placeholder: "8px / 12px",
		},
	];

	const cardFields: {
		label: string;
		key: keyof LayoutConfig;
		placeholder: string;
	}[] = [
		{
			label: "网站卡片最小宽度",
			key: "cardMinWidth",
			placeholder: "160px / 200px",
		},
		{
			label: "网站卡片高度",
			key: "cardHeight",
			placeholder: "64px / 72px",
		},
		{
			label: "图标圆角",
			key: "iconBorderRadius",
			placeholder: "full / 12px / 8px",
		},
		{
			label: "图标默认内间距",
			key: "defaultIconPadding",
			placeholder: "8 / 8px / 留空",
		},
	];

	const renderToggleGroup = (
		items: ToggleItem[],
	) => (
		<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
			{items.map((item) => {
				const isRecentVisits = item.kind === "recentVisits";
				const cur = isRecentVisits
					? showRecentVisits !== false
					: getToggleValue(item.key);
				return (
					<AdminSwitch
						key={item.key}
						isSelected={cur}
						isDisabled={item.disabled}
						onChange={(value) => {
							if (isRecentVisits) {
								onShowRecentVisitsChange(value);
								return;
							}
							patchToggle(item.key, value);
						}}
					>
						<span className="text-sm">{item.label}</span>
					</AdminSwitch>
				);
			})}
		</div>
	);

	const renderFieldGroup = (
		items: { label: string; key: keyof LayoutConfig; placeholder: string }[],
	) => (
		<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
			{items.map((item) => (
				<div key={item.key} className="flex flex-col gap-2">
					<Label className="text-sm font-medium">{item.label}</Label>
					<TextField
						value={(l[item.key] as string | undefined) ?? ""}
						onChange={(v) => patch({ [item.key]: v || undefined })}
					>
						<Label className="sr-only">{String(item.key)}</Label>
						<Input placeholder={item.placeholder} />
					</TextField>
				</div>
			))}
		</div>
	);

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
					布局与显示控制
				</h3>
				<p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
					自定义站点的布局样式和显示效果
				</p>
			</div>

			<div className="space-y-3">
				<h4 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
					尺寸与间距
				</h4>
				{renderFieldGroup(spacingFields)}
			</div>

			<Separator />

			<div className="space-y-3">
				<h4 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
					卡片与图标
				</h4>
				{renderFieldGroup(cardFields)}
			</div>

			<Separator />

			<div className="space-y-3">
				<h4 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
					显示项
				</h4>
				{renderToggleGroup(displayToggleItems)}

				<div className="flex flex-wrap items-center gap-3">
					<span className="text-sm">最近访问最大条数</span>
					<TextField
						className="w-28"
						value={
							recentVisitsMax === undefined ? "" : String(recentVisitsMax)
						}
						onChange={(value) => {
							const digits = value.replace(/\D/g, "");
							if (!digits) {
								onRecentVisitsMaxChange(undefined);
								return;
							}
							const parsed = Number.parseInt(digits, 10);
							onRecentVisitsMaxChange(
								Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
							);
						}}
					>
						<Label className="sr-only">recentVisitsMax</Label>
						<Input
							inputMode="numeric"
							placeholder={String(DEFAULT_RECENT_VISITS_MAX)}
						/>
					</TextField>
					<span className="text-xs text-default-500">
						留空或 0 使用默认值 {DEFAULT_RECENT_VISITS_MAX}
					</span>
				</div>
			</div>

			<Separator />

			<div className="space-y-3">
				<h4 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
					行为项
				</h4>
				{renderToggleGroup(behaviorToggleItems)}
			</div>
		</div>
	);
}
