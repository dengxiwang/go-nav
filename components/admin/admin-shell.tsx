"use client";

import {
    Button,
    ListBox,
    Separator,
    Header,
    Label,
    Drawer,
    Breadcrumbs,
    type Selection,
    Card,
    toast,
    Link,
    useOverlayState,
} from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo } from "react";
import {
    BiCog,
    BiGlobe,
    BiGrid,
    BiLogOut,
    BiSave,
    BiSearch,
    BiStar,
    BiShow,
    BiMenu,
    BiLayout,
    BiPalette,
    BiBookContent,
    BiArchive,
    BiCode,
    BiDonateHeart,
    BiImport,
    BiFile,
    BiSync,
} from "react-icons/bi";
import {
    applyImportAtom,
    dirtyAtom,
    navFieldAtom,
    saveAtom,
    savingAtom,
} from "@/lib/store/admin";
import { getIconImageSrc } from "@/lib/icon";
import type { NavConfig, WebsiteData } from "@/types";
import { AdminScrollTopButton } from "./scroll-top-button";

type RouteKey =
	| "categories"
	| "sites"
	| "website"
	| "website-layout"
	| "website-theme"
	| "website-footer"
	| "ads"
	| "engines"
	| "plugins"
	| "donation"
	| "backup"
	| "import"
	| "source-file"
	| "github-sync";

interface NavItem {
	key: RouteKey;
	label: string;
	icon: React.ReactNode;
	desc: string;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
	{
		title: "内容管理",
		items: [
			{
				key: "categories",
				label: "分类管理",
				icon: <BiGrid className="size-5" />,
				desc: "层级分类与子标签",
			},
			{
				key: "sites",
				label: "网址管理",
				icon: <BiGlobe className="size-5" />,
				desc: "全局搜索与批量编辑网站条目",
			},
			{
				key: "import",
				label: "从外部导入",
				icon: <BiImport className="size-5" />,
				desc: "导入浏览器书签并自动解析分类",
			},
			{
				key: "source-file",
				label: "编辑源文件",
				icon: <BiFile className="size-5" />,
				desc: "直接编辑 website.json 源文件",
			},
		],
	},
	{
		title: "站点设置",
		items: [
			{
				key: "website",
				label: "基础信息",
				icon: <BiCog className="size-5" />,
				desc: "站点名称 / 描述 / Logo / 作者",
			},
			{
				key: "website-layout",
				label: "布局配置",
				icon: <BiLayout className="size-5" />,
				desc: "侧边栏 / 卡片 / 间距等",
			},
			{
				key: "website-theme",
				label: "主题外观",
				icon: <BiPalette className="size-5" />,
				desc: "明暗主题切换",
			},
			{
				key: "website-footer",
				label: "页脚设置",
				icon: <BiBookContent className="size-5" />,
				desc: "ICP / 备案 / 友情链接",
			},
		],
	},
	{
		title: "功能配置",
		items: [
			{
				key: "ads",
				label: "广告管理",
				icon: <BiStar className="size-5" />,
				desc: "广告位、最近访问等首页模块",
			},
			{
				key: "engines",
				label: "搜索引擎",
				icon: <BiSearch className="size-5" />,
				desc: "全局搜索行为与引擎列表",
			},
			{
				key: "plugins",
				label: "插件管理",
				icon: <BiCode className="size-5" />,
				desc: "自定义 CSS / JS 注入",
			},
		],
	},
	{
		title: "数据管理",
		items: [
			{
				key: "backup",
				label: "备份还原",
				icon: <BiArchive className="size-5" />,
				desc: "数据 + 上传图片备份与还原",
			},
			{
				key: "github-sync",
				label: "数据同步",
				icon: <BiSync className="size-5" />,
				desc: "GitHub / WebDAV 远程同步",
			},
		],
	},
	{
		title: "支持",
		items: [
			{
				key: "donation",
				label: "打赏捐赠",
				icon: <BiDonateHeart className="size-5" />,
				desc: "支持 Go Nav 项目",
			},
		],
	},
];

const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

function routeKeyFromPath(pathname: string | null): RouteKey {
	const seg = (pathname ?? "").replace(/^\/admin\/?/, "").split("/")[0] ?? "";
	return ALL_ITEMS.find((i) => i.key === seg)?.key ?? "categories";
}

/**
 * 顶部保存按钮 + 状态。
 * 独立组件：只订阅 dirty / saving，按钮状态变化不会让 Shell 整体重渲染。
 */
function SaveButton() {
	const dirty = useAtomValue(dirtyAtom);
	const saving = useAtomValue(savingAtom);
	const save = useSetAtom(saveAtom);
	const onPress = useCallback(async () => {
		const r = await save();
		if (r?.ok) toast.success("已保存");
		else if (r && "error" in r && r.error) toast.danger(r.error);
	}, [save]);
	return (
		<Button
			variant="primary"
			className="h-8 shrink-0"
			isDisabled={!dirty || saving}
			isPending={saving}
			onPress={onPress}
		>
			<BiSave className="size-4" />
			<span className="hidden sm:inline">
				{saving ? "保存中..." : dirty ? "保存" : "已保存"}
			</span>
		</Button>
	);
}

/** 后台全局保存快捷键：Ctrl/Cmd + S */
function SaveShortcutGuard() {
	const dirty = useAtomValue(dirtyAtom);
	const saving = useAtomValue(savingAtom);
	const save = useSetAtom(saveAtom);

	useEffect(() => {
		const handler = async (e: KeyboardEvent) => {
			if ((!e.ctrlKey && !e.metaKey) || e.key.toLowerCase() !== "s") return;
			e.preventDefault();
			e.stopPropagation();
			if (e.repeat) return;
			if (saving) return;
			if (!dirty) {
				toast.warning("当前没有未保存改动");
				return;
			}
			const r = await save();
			if (r?.ok) toast.success("已保存");
			else if (r && "error" in r && r.error) toast.danger(r.error);
		};
		window.addEventListener("keydown", handler, true);
		return () => window.removeEventListener("keydown", handler, true);
	}, [dirty, save, saving]);

	return null;
}

/** 侧栏 / 抽屉头部品牌区：只订阅 nav.name / nav.logo，编辑其它字段不会让它重渲染 */
function BrandBlock({
	variant,
}: {
	variant: "desktop" | "drawer";
}) {
	const name = useAtomValue(navFieldAtom("name"));
	const logo = useAtomValue(navFieldAtom("logo"));
	const logoSrc = getIconImageSrc(logo);
	if (variant === "desktop") {
		return (
			<div className="flex h-12 items-center gap-3 mx-5 mt-3">
				{logoSrc ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={logoSrc}
						alt={name}
						className="h-7 w-7 shrink-0 rounded-lg object-contain"
					/>
				) : (
					<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-blue-600 text-center text-xs font-bold text-white">
						{name.charAt(0)}
					</div>
				)}
				<div className="flex min-w-0 flex-col leading-tight">
					<span className="truncate text-base! font-semibold">{name}</span>
					<span className="text-xs! font-medium text-default-500">
						管理后台
					</span>
				</div>
			</div>
		);
	}
	return (
		<>
			{logoSrc ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={logoSrc}
					alt={name}
					className="h-6 w-6 rounded-md object-contain"
				/>
			) : (
				<div className="flex h-6 w-6 items-center justify-center rounded-md bg-linear-to-br from-blue-500 to-blue-600 text-center text-[10px]! font-bold text-white">
					{name.charAt(0)}
				</div>
			)}
			<span className="text-base font-semibold truncate">{name}</span>
		</>
	);
}

/** 监听 beforeunload，仅订阅 dirty */
function BeforeUnloadGuard() {
	const dirty = useAtomValue(dirtyAtom);
	useEffect(() => {
		const handler = (e: BeforeUnloadEvent) => {
			if (!dirty) return;
			e.preventDefault();
			e.returnValue = "";
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, [dirty]);
	return null;
}

/** 监听 admin-import 自定义事件并写入 atom（历史兼容入口） */
function ImportEventBridge() {
	const applyImport = useSetAtom(applyImportAtom);
	useEffect(() => {
		const handleImport = (e: Event) => {
			const detail = (e as CustomEvent).detail as
				| { websiteData?: WebsiteData; nav?: NavConfig }
				| undefined;
			if (!detail) return;
			applyImport(detail);
			toast.success("数据已导入，请点击顶部「保存」按钮生效");
		};
		window.addEventListener("admin-import", handleImport);
		return () => window.removeEventListener("admin-import", handleImport);
	}, [applyImport]);
	return null;
}

export function AdminShell({ children }: { children?: React.ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const currentKey = routeKeyFromPath(pathname);
	const currentItem =
		ALL_ITEMS.find((i) => i.key === currentKey) ?? ALL_ITEMS[0];
	const selectedKeys = useMemo<Selection>(
		() => new Set([currentKey]),
		[currentKey],
	);
	const mobileDrawerState = useOverlayState();

	// 窗口变大时自动关闭抽屉
	useEffect(() => {
		if (!mobileDrawerState.isOpen) return;
		const onResize = () => {
			if (window.innerWidth >= 1024) {
				mobileDrawerState.close();
			}
		};
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, [mobileDrawerState]);

	const onLogout = useCallback(async () => {
		await fetch("/api/auth/logout", { method: "POST" });
		window.location.href = "/admin/login";
	}, []);

	const handleSelection = (keys: Selection) => {
		if (keys === "all") return;
		const k = Array.from(keys)[0];
		if (!k) return;
		router.push(`/admin/${String(k)}`);
	};

	return (
		<div className="flex min-h-screen w-full bg-[#f5f5f5] dark:bg-neutral-950">
			<BeforeUnloadGuard />
			<SaveShortcutGuard />
			<ImportEventBridge />
			<AdminScrollTopButton />

			{/* 侧栏 - 桌面端 */}
			<aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex dark:border-neutral-800 dark:bg-neutral-900">
				<BrandBlock variant="desktop" />

				{/* 菜单区域 */}
				<div className="flex-1 overflow-y-auto p-2 overscroll-none">
					<ListBox
						aria-label="管理菜单"
						selectionMode="single"
						selectedKeys={selectedKeys}
						onSelectionChange={handleSelection}
						disallowEmptySelection
						className="w-full"
					>
						{NAV_SECTIONS.map((section) => (
							<ListBox.Section key={section.title}>
								<Header>{section.title}</Header>
								{section.items.map((it) => (
									<ListBox.Item
										key={it.key}
										id={it.key}
										textValue={it.label}
										className="mb-0.5 rounded-lg py-2.5 data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-600 dark:data-[selected=true]:bg-blue-950/40 dark:data-[selected=true]:text-blue-300"
									>
										<div className="flex items-center gap-2">
											{it.icon}
											<Label className="text-sm font-medium">
												{it.label}
											</Label>
										</div>
									</ListBox.Item>
								))}
							</ListBox.Section>
						))}
					</ListBox>
				</div>

				{/* 底部信息 */}
				<div className="border-t border-gray-100 px-5 py-4 dark:border-neutral-800">
					<p className="text-center text-xs font-medium">
						基于开源项目：
						<Link
							href="https://github.com/dengxiwang/go-nav"
							className="text-xs text-primary"
						>
							github.com/dengxiwang/go-nav
							<Link.Icon />
						</Link>
					</p>
				</div>
			</aside>

			{/* 移动端抽屉菜单 */}
			<Drawer>
				<Drawer.Backdrop
					isOpen={mobileDrawerState.isOpen}
					onOpenChange={mobileDrawerState.setOpen}
				>
					<Drawer.Content placement="left">
						<Drawer.Dialog className="w-dvw max-w-64 p-3 bg-white dark:bg-neutral-900">
							<Drawer.Header>
								<Drawer.Heading className="flex items-center gap-2 p-3">
									<BrandBlock variant="drawer" />
								</Drawer.Heading>
							</Drawer.Header>
							<Drawer.Body className="p-0">
								<ListBox
									aria-label="管理菜单"
									selectionMode="single"
									selectedKeys={selectedKeys}
									onSelectionChange={(keys) => {
										handleSelection(keys);
										mobileDrawerState.close();
									}}
									disallowEmptySelection
									className="w-full px-2"
								>
									{NAV_SECTIONS.map((section) => (
										<ListBox.Section key={section.title}>
											<Header className="px-3">{section.title}</Header>
											{section.items.map((it) => (
												<ListBox.Item
													key={it.key}
													id={it.key}
													textValue={it.label}
													className="mb-0.5 rounded-lg py-2.5 data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-600 dark:data-[selected=true]:bg-blue-950/40 dark:data-[selected=true]:text-blue-300"
												>
													<div className="flex items-center gap-2">
														{it.icon}
														<Label className="text-sm font-medium">
															{it.label}
														</Label>
													</div>
												</ListBox.Item>
											))}
										</ListBox.Section>
									))}
								</ListBox>
							</Drawer.Body>
						</Drawer.Dialog>
					</Drawer.Content>
				</Drawer.Backdrop>
			</Drawer>

			{/* 右侧主区 */}
			<div className="flex min-w-0 flex-1 flex-col">
				{/* 顶部 Header */}
				<header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-gray-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-900">
					{/* 移动端菜单按钮 */}
					<Button
						variant="tertiary"
						isIconOnly
						className="h-8 w-8 shrink-0 lg:hidden"
						onPress={mobileDrawerState.open}
					>
						<BiMenu className="size-4" />
					</Button>

					{/* 桌面端 Breadcrumbs */}
					<div className="hidden lg:block">
						<Breadcrumbs>
							<Breadcrumbs.Item href="/admin">管理后台</Breadcrumbs.Item>
							<Breadcrumbs.Item>{currentItem.label}</Breadcrumbs.Item>
						</Breadcrumbs>
					</div>

					{/* 移动端标题 */}
					<span className="truncate text-base font-semibold text-gray-900 lg:hidden dark:text-neutral-100">
						{currentItem.label}
					</span>

					{/* 右侧操作区 */}
					<div className="ml-auto flex items-center gap-2 shrink-0">
						<SaveButton />

						<Separator
							orientation="vertical"
							className="mx-1 h-5 shrink-0 hidden sm:block"
						/>

						{/* 前台按钮 - 小屏图标 */}
						<Button
							variant="outline"
							isIconOnly
							className="h-8 w-8 shrink-0 sm:hidden"
							onPress={() => {
								window.location.href = "/";
							}}
						>
							<BiShow className="size-4" />
						</Button>
						{/* 前台按钮 - 大屏文字 */}
						<Button
							variant="outline"
							className="h-8 shrink-0 hidden sm:flex"
							onPress={() => {
								window.location.href = "/";
							}}
						>
							<BiShow className="size-4" />
							<span>前台</span>
						</Button>

						{/* 退出按钮 - 小屏图标 */}
						<Button
							variant="tertiary"
							isIconOnly
							className="h-8 w-8 shrink-0 sm:hidden"
							onPress={onLogout}
						>
							<BiLogOut className="size-4" />
						</Button>
						{/* 退出按钮 - 大屏文字 */}
						<Button
							variant="tertiary"
							className="h-8 shrink-0 hidden sm:flex"
							onPress={onLogout}
						>
							<BiLogOut className="size-4" />
							<span>退出</span>
						</Button>
					</div>
				</header>

				{/* 内容区域 */}
				<main className="w-full min-w-0 flex-1 p-3">
					<Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-none dark:border-neutral-800 dark:bg-neutral-900">
						{children}
					</Card>
				</main>
			</div>
		</div>
	);
}
