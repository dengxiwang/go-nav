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
import type { SiteDetailEntry } from "@/lib/site-detail";
import { SiteIcon } from "../site-icon";

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
		<section className="w-full px-2">
			<div className="mb-4 flex items-center gap-3">
				<Button
					isIconOnly
					variant="tertiary"
					onClick={handleBack}
					aria-label="返回首页"
				>
					<BiArrowBack />
				</Button>
				<h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
					网址详情
				</h2>
			</div>

			<div className="space-y-4">
				<div className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-4 sm:flex-row sm:items-start sm:justify-between dark:border-white/10 dark:bg-zinc-900">
					<div className="flex items-center gap-4">
						<div className="rounded-2xl border border-black/10 bg-white p-2 dark:border-white/10 dark:bg-zinc-900">
							<SiteIcon
								site={site}
								layout={layout}
								size={56}
								className="shrink-0 text-xl!"
								initialClassName="text-sm!"
							/>
						</div>
						<div>
							<h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
								{site.title}
							</h1>
							{tags.length > 0 ? (
								<div className="mt-3 flex flex-wrap gap-2">
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
					<div className="sm:self-center">
						<Button variant="primary" onPress={handleVisit}>
							<BiLinkExternal />
							访问链接
						</Button>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
						<p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
							链接
						</p>
						<a
							href={withAuthorBaiduTracking(site.url)}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-2 block break-all text-sm leading-6 text-primary underline-offset-4 hover:underline"
						>
							{site.url}
						</a>
					</div>
					<div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
						<p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
							分类
						</p>
						<p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
							{entry.categoryPath.join(" / ")}
						</p>
					</div>
				</div>

				{site.description ? (
					<div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
						<p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
							描述
						</p>
						<p className="mt-2 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
							{site.description}
						</p>
					</div>
				) : null}

				<div className="space-y-3">
					<p className="px-2 text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
						预览图
					</p>
					{site.previewImage ? (
						<div className="aspect-video w-full overflow-hidden rounded-2xl border border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-zinc-900">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={site.previewImage}
								alt={`${site.title} 预览图`}
								className="h-full w-full object-cover"
							/>
						</div>
					) : (
						<div className="flex h-24 w-full items-center justify-center rounded-2xl border border-dashed border-black/10 bg-zinc-50 text-xs text-zinc-500 dark:border-white/10 dark:bg-zinc-900/60">
							暂无预览图
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
