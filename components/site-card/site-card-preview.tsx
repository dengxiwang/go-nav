"use client";

import {
	CARD_TRANSITION_CLASS,
	FOCUS_RING_CLASS,
	PREVIEW_CARD_SURFACE_CLASS,
	SHARED_SPRING_EASE_CLASS,
} from "../ui/ui.constants";
import { SiteCardLinkShell } from "./site-card-link-shell";
import type { SiteCardVisualProps } from "./site-card.types";

const PREVIEW_CARD_CLASS =
	`group relative flex h-full transform-gpu flex-col gap-3 overflow-hidden text-left ${PREVIEW_CARD_SURFACE_CLASS} ${CARD_TRANSITION_CLASS} duration-300 ${SHARED_SPRING_EASE_CLASS} ${FOCUS_RING_CLASS} [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-black/15 [@media(hover:hover)]:hover:shadow-[0_18px_45px_rgba(15,23,42,0.12)] active:translate-y-0 active:scale-[0.99] dark:[@media(hover:hover)]:hover:border-white/20`;

export function PreviewSiteCard({
	site,
	navigation,
}: SiteCardVisualProps) {
	return (
		<SiteCardLinkShell
			ariaLabel={site.title}
			className={PREVIEW_CARD_CLASS}
			navigation={navigation}
		>
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
					className={`flex h-full w-full origin-center -rotate-8 overflow-hidden rounded-md border border-solid bg-linear-to-br from-zinc-100 to-zinc-300 transition-transform duration-500 ${SHARED_SPRING_EASE_CLASS} dark:border-white/10 dark:from-zinc-800 dark:to-zinc-950 [@media(hover:hover)]:group-hover:-translate-y-1 [@media(hover:hover)]:group-hover:-rotate-1`}
				>
					{site.previewImage ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={site.previewImage}
							alt=""
							loading="lazy"
							className="object-cover"
						/>
					) : null}
				</div>
			</div>
		</SiteCardLinkShell>
	);
}
