"use client";

import { Button, Chip } from "@heroui/react";
import { useCallback } from "react";
import { BiArrowBack, BiLinkExternal } from "react-icons/bi";
import { useRouter } from "next/navigation";
import type { LayoutConfig } from "@/types";
import { recordVisit } from "@/hooks/use-recent-visits";
import { openSiteWithPreference } from "@/lib/client/site-link";
import { requestHomeRestore } from "@/lib/client/home-restore";
import { withAuthorBaiduTracking } from "@/lib/external-url";
import {
	resolveSiteDetailPreviewImages,
	type SiteDetailEntry,
} from "@/lib/site-detail";
import { SiteIcon } from "../site-icon";
import { SiteDetailGallery } from "./site-detail-gallery";
import { SiteDetailMarkdown } from "./site-detail-markdown";

export function SiteDetailPage({
	entry,
	layout,
}: {
	entry: SiteDetailEntry;
	layout: Required<LayoutConfig>;
}) {
	const router = useRouter();
	const site = entry.site;
	const tags = site.tags?.filter((tag) => tag.trim()) ?? [];
	const previewImages = resolveSiteDetailPreviewImages(site);
	const detailMarkdown = site.detailMarkdown?.trim() ?? "";
	const detailIconLayout = { ...layout, iconBorderRadius: "12px" };

	const handleBack = useCallback(() => {
		requestHomeRestore();
		router.push("/", { scroll: false });
	}, [router]);

	const handleVisit = useCallback(() => {
		recordVisit(site);
		void openSiteWithPreference(site, {
			linkTarget: layout.linkTarget,
			autoUseIntranet: layout.autoUseIntranet,
		});
	}, [layout.autoUseIntranet, layout.linkTarget, site]);

	return (
		<section className="w-full px-2 pb-6">
			<div className="mb-4 flex items-center gap-3">
				<Button
					isIconOnly
					variant="tertiary"
					onPress={handleBack}
					aria-label="返回首页"
				>
					<BiArrowBack />
				</Button>
				<h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
					网址详情
				</h2>
			</div>

			<div className="space-y-4">
				<div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6 dark:border-white/10 dark:bg-zinc-900">
					<div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
						<div className="flex min-w-0 items-center gap-4 sm:gap-5">
							<div className="flex size-18 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-white p-2 sm:size-20 dark:border-white/12 dark:bg-zinc-900">
								<SiteIcon
									site={site}
									layout={detailIconLayout}
									size={56}
									showDefaultBackgroundColor={false}
									className="shrink-0 text-2xl!"
									initialClassName="text-base!"
								/>
							</div>
							<div className="min-w-0">
								<h1 className="truncate text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-100">
									{site.title}
								</h1>
								{tags.length > 0 ? (
									<div className="mt-2.5 flex flex-wrap gap-2">
										{tags.map((tag) => (
											<Chip
												key={tag}
												size="sm"
												variant="secondary"
												className="text-xs!"
											>
												{tag}
											</Chip>
										))}
									</div>
								) : null}
							</div>
						</div>

						<div
							className={`grid gap-4 border-t border-black/8 pt-5 sm:col-span-2 sm:gap-0 dark:border-white/10 ${
								layout.showSiteDetailUrl ? "sm:grid-cols-2" : ""
							}`}
						>
							<div className="min-w-0 sm:pr-6">
								<span className="text-xs text-zinc-500 dark:text-zinc-400">
									分类
								</span>
								<p className="mt-1.5 text-sm leading-6 text-zinc-800 dark:text-zinc-200">
									{entry.categoryPath.join(" / ")}
								</p>
							</div>
							{layout.showSiteDetailUrl ? (
								<div className="min-w-0 sm:border-l sm:border-black/8 sm:pl-6 dark:sm:border-white/10">
									<span className="text-xs text-zinc-500 dark:text-zinc-400">
										网址
									</span>
									<a
										href={withAuthorBaiduTracking(site.url)}
										target="_blank"
										rel="noopener noreferrer"
										className="mt-1.5 block break-all text-sm leading-6 text-zinc-700 underline-offset-4 hover:text-primary hover:underline dark:text-zinc-300"
										title={site.url}
									>
										{site.url}
									</a>
								</div>
							) : null}
						</div>

						<Button
							variant="primary"
							onPress={handleVisit}
							className="w-full shrink-0 sm:col-start-2 sm:row-start-1 sm:w-auto sm:self-center"
						>
							<BiLinkExternal />
							访问链接
						</Button>
					</div>

					{site.description && !detailMarkdown ? (
						<div className="mt-5 border-t border-black/8 pt-5 dark:border-white/10">
							<h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
								网址描述
							</h2>
							<p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-600 dark:text-zinc-300">
								{site.description}
							</p>
						</div>
					) : null}
				</div>

				{previewImages.length > 0 ? (
					<div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6 dark:border-white/10 dark:bg-zinc-900">
						<div className="mb-4 flex items-center justify-between gap-3">
							<h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
								预览图
							</h2>
							<span className="text-xs text-zinc-500 dark:text-zinc-400">
								{previewImages.length} 张
							</span>
						</div>
						<SiteDetailGallery images={previewImages} title={site.title} />
					</div>
				) : null}

				{detailMarkdown ? (
					<div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-6 dark:border-white/10 dark:bg-zinc-900">
						<h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
							详细介绍
						</h2>
						<SiteDetailMarkdown markdown={detailMarkdown} />
					</div>
				) : null}
			</div>
		</section>
	);
}
