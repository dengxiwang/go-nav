"use client";

import { Link } from "@heroui/react";
import Image from "next/image";
import { memo } from "react";
import { useAtomValue } from "jotai";
import { withAuthorBaiduTracking } from "@/lib/external-url";
import {
	footerLinksAtom,
	navBeianAtom,
	navCopyrightAtom,
	navIcpAtom,
	navNameAtom,
	navQrCodeAtom,
	navQrCodeTextAtom,
} from "@/lib/store/site";

const CURRENT_YEAR = new Date().getFullYear();

/**
 * 页脚（Jotai 订阅版）。
 *
 * 页脚字段较杂，但仍按字段订阅，避免后台预览或未来热更新时被 nav
 * 其它配置项牵连重渲染。
 */
export const AppFooter = memo(function AppFooter({
	showQrCode = true,
}: {
	showQrCode?: boolean;
}) {
	const name = useAtomValue(navNameAtom);
	const copyright = useAtomValue(navCopyrightAtom);
	const icp = useAtomValue(navIcpAtom);
	const beian = useAtomValue(navBeianAtom);
	const qrCode = useAtomValue(navQrCodeAtom);
	const qrCodeText = useAtomValue(navQrCodeTextAtom);
	const footerLinks = useAtomValue(footerLinksAtom);

	return (
		<footer className="w-full p-6">
			<div>
				<div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
					<div className="flex flex-col items-center gap-3 md:items-start">
						{footerLinks.length > 0 ? (
							<>
								<div className="text-sm font-medium">友情链接</div>
								<nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 md:justify-start">
									{footerLinks.map((item) => {
										const isExternal = /^https?:\/\//.test(item.href);

										return (
											<Link
												key={`${item.label}-${item.href}`}
												href={withAuthorBaiduTracking(item.href)}
												target={isExternal ? "_blank" : undefined}
												rel={isExternal ? "noopener noreferrer" : undefined}
												className="inline-flex items-center gap-1 text-xs transition no-underline [@media(hover:hover)]:hover:underline"
												aria-label={item.label}
											>
												<span>{item.label}</span>
												<Link.Icon />
											</Link>
										);
									})}
								</nav>
							</>
						) : null}
					</div>

					{showQrCode && qrCode ? (
						<div className="flex flex-col items-center text-center md:items-center md:text-right">
							<div className="rounded overflow-hidden border dark:border-zinc-700">
								<Image
									src={qrCode}
									alt={qrCodeText ?? "公众号二维码"}
									width={120}
									height={120}
									loading="eager"
									className="object-contain"
								/>
							</div>

							<div className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
								{qrCodeText ?? "扫码关注，获取最新动态"}
							</div>
						</div>
					) : null}
				</div>

				<div className="mt-8 flex flex-col gap-2 border-t border-black/6 pt-5 text-xs dark:border-white/8 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
						<span>
							{copyright || `© ${CURRENT_YEAR} ${name}. All rights reserved.`}
						</span>
						<span className="inline-flex items-center gap-1 text-xs">
							Powered by
							<Link
								href="https://github.com/dengxiwang/go-nav"
								target="_blank"
								rel="noopener noreferrer"
								className="text-xs font-semibold no-underline [@media(hover:hover)]:hover:underline [@media(hover:hover)]:hover:text-primary"
							>
								Go Nav
							</Link>
						</span>
					</div>
					<div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
						{icp ? (
							<Link
								href="https://beian.miit.gov.cn/"
								target="_blank"
								rel="noopener noreferrer"
								className="text-xs no-underline [@media(hover:hover)]:hover:underline"
							>
								{icp}
							</Link>
						) : null}
						{beian ? (
							<Link
								href="https://www.beian.gov.cn/portal/registerSystemInfo"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-xs no-underline [@media(hover:hover)]:hover:underline"
							>
								<Image
									src="/images/beian.png"
									alt="公安备案图标"
									width={14}
									height={14}
									className="shrink-0"
								/>
								<span>{beian}</span>
							</Link>
						) : null}
					</div>
				</div>
			</div>
		</footer>
	);
});
