import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import { getNav } from "@/lib/config";
import { getIconImageSrc } from "@/lib/icon";
import { LoginForm } from "@/components/admin/login-form";
import { BiGridAlt, BiSearch, BiMoon, BiLayer } from "react-icons/bi";
import Link from "next/link";
import type { IconType } from "react-icons";

export default async function AdminLoginPage() {
	const store = await cookies();
	if (await verifySession(store.get(SESSION_COOKIE)?.value)) {
		redirect("/admin");
	}
	const nav = await getNav();
	const logoSrc = getIconImageSrc(nav.logo);

	return (
		<div className="relative flex min-h-dvh w-full">
			{/* 桌面端双栏 */}
			<div className="hidden min-h-dvh w-full lg:grid lg:grid-cols-[1.05fr_1fr]">
				{/* 左侧 - 品牌区（浅色同调） */}
				<div className="relative flex min-h-dvh flex-col justify-between overflow-hidden bg-linear-to-br from-default-100/70 via-background to-primary/5 px-14 py-12">
					{/* 点阵背景 - 明暗自适应 */}
					<div
						className="pointer-events-none absolute inset-0 opacity-60 dark:hidden"
						style={{
							backgroundImage:
								"radial-gradient(circle, rgba(0,0,0,0.6) 1px, transparent 1px)",
							backgroundSize: "24px 24px",
						}}
					/>
					<div
						className="pointer-events-none absolute inset-0 hidden opacity-60 dark:block"
						style={{
							backgroundImage:
								"radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)",
							backgroundSize: "24px 24px",
						}}
					/>
					{/* 柔光 */}
					<div className="pointer-events-none absolute -left-32 -top-32 size-128 rounded-full bg-(--primary)/15 blur-3xl" />
					<div className="pointer-events-none absolute -bottom-40 -right-32 size-112 rounded-full bg-(--primary)/10 blur-3xl" />
					{/* 右侧融合到背景 */}
					<div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-linear-to-l from-background to-transparent" />

					{/* 1. 顶部 Logo */}
					<div className="relative z-10 flex items-center gap-3">
						{logoSrc ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={logoSrc}
								alt={nav.name}
								className="h-9 w-9 rounded-lg object-contain"
							/>
						) : (
							<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--primary) text-center text-sm font-bold text-primary-foreground">
								{nav.name.charAt(0)}
							</div>
						)}
						<div className="flex flex-col leading-tight">
							<span className="text-sm font-semibold">{nav.name}</span>
							<span className="text-xs! font-medium text-default-500">
								Admin Console
							</span>
						</div>
					</div>

					{/* 2. 中间：徽标 + 大标题 + 描述 + 简约特性 */}
					<div className="relative z-10 max-w-xl mb-28">
						<span className="inline-flex items-center gap-2 rounded-full border border-default-200 bg-background/70 px-3 py-1 text-xs! font-medium text-default-600 backdrop-blur-sm">
							<span className="size-1.5 rounded-full bg-(--primary)" />
							Welcome back
						</span>
						<h2 className="mt-5 text-[44px] font-semibold leading-[1.1] tracking-tight">
							简洁、高效、
							<br />
							全掌控的导航后台
						</h2>
						<p className="mt-5 max-w-md text-sm leading-7 text-default-500">
							{nav.description}
						</p>

						{/* 特性列表 */}
						<div className="mt-12 grid grid-cols-2 gap-x-10 gap-y-6">
							<FeatureRow
								icon={BiGridAlt}
								title="分类导航"
								desc="多级锚点整齐收纳"
							/>
							<FeatureRow
								icon={BiSearch}
								title="多引擎搜索"
								desc="百度 / Google / Bing"
							/>
							<FeatureRow
								icon={BiMoon}
								title="暗黑模式"
								desc="浅色 / 深色 / 跟随系统"
							/>
							<FeatureRow
								icon={BiLayer}
								title="双模式部署"
								desc="静态导出 / 动态服务"
							/>
						</div>
					</div>

					{/* 3. 底部 */}
					<div className="relative z-10 flex items-center justify-between text-xs text-default-500">
						<Link
							href="https://github.com/dengxiwang/go-nav"
							className="inline-flex items-center text-xs text-default-600 hover:text-default-900"
						>
							github.com/dengxiwang/go-nav
						</Link>
						<span>{nav.copyright}</span>
					</div>
				</div>

				{/* 右侧 - 登录表单 */}
				<div className="flex min-h-dvh items-center justify-center bg-background p-10">
					<LoginForm websiteName={nav.name} websiteLogo={nav.logo} />
				</div>
			</div>

			{/* 移动端布局 */}
			<div className="flex min-h-dvh w-full items-center justify-center px-5 py-10 lg:hidden">
				<LoginForm websiteName={nav.name} websiteLogo={nav.logo} showBrand />
			</div>
		</div>
	);
}

function FeatureRow({
	icon: Icon,
	title,
	desc,
}: {
	icon: IconType;
	title: string;
	desc: string;
}) {
	return (
		<div className="flex items-start gap-3">
			<div className="mt-0.5 flex size-9 items-center justify-center rounded-lg border border-default-200 bg-background/70 text-primary shadow-xs backdrop-blur-sm">
				<Icon className="size-4" />
			</div>
			<div>
				<div className="text-sm font-medium">{title}</div>
				<div className="mt-0.5 text-xs! text-default-500">{desc}</div>
			</div>
		</div>
	);
}
