"use client";

import {
	CARD_TRANSITION_CLASS,
	FOCUS_RING_CLASS,
	PREVIEW_CARD_SURFACE_CLASS,
} from "../ui/ui.constants";
import { SiteCardLinkShell } from "./site-card-link-shell";
import type { SiteCardVisualProps } from "./site-card.types";

const PREVIEW_CARD_CLASS =
	`site-preview-card-motion pointer-events-none relative flex h-full flex-col gap-3 overflow-hidden text-left ${PREVIEW_CARD_SURFACE_CLASS} ${CARD_TRANSITION_CLASS} [@media(hover:hover)]:group-hover:border-black/15 [@media(hover:hover)]:group-hover:shadow-[0_18px_45px_rgba(15,23,42,0.12)] dark:[@media(hover:hover)]:group-hover:border-white/20`;
const PREVIEW_CARD_HIT_AREA_CLASS =
	`site-card-hover-region group block h-full rounded-2xl outline-none ${FOCUS_RING_CLASS}`;

export function PreviewSiteCard({
	site,
	navigation,
}: SiteCardVisualProps) {
	return (
		<SiteCardLinkShell
			ariaLabel={site.title}
			className={PREVIEW_CARD_HIT_AREA_CLASS}
			navigation={navigation}
		>
			<div className={PREVIEW_CARD_CLASS}>
				<div className="relative z-10 p-3">
					<div className="truncate line-clamp-1 font-semibold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50">
						{site.title}
					</div>
					<div
						className="line-clamp-2 text-xs font-medium leading-snug text-zinc-500 dark:text-zinc-400"
						style={{
							display: "-webkit-box",
							WebkitLineClamp: 2,
							WebkitBoxOrient: "vertical",
							overflow: "hidden",
						}}
					>
						{site.description}
					</div>
				</div>

				<div className="absolute top-[50%] left-[15%] flex h-full w-full justify-center">
					<div
						className="site-preview-card-media flex h-full w-full origin-center overflow-hidden rounded-md border border-solid bg-linear-to-br from-zinc-100 to-zinc-300 dark:border-white/10 dark:from-zinc-800 dark:to-zinc-950"
					>
						{site.previewImage ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={site.previewImage}
								alt=""
								loading="lazy"
								decoding="async"
								className="h-full w-full object-cover"
							/>
						) : null}
					</div>
				</div>
			</div>
		</SiteCardLinkShell>
	);
}
