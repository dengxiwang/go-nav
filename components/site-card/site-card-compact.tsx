"use client";

import { SiteIcon } from "../site-icon";
import {
	CARD_TRANSITION_CLASS,
	COMPACT_CARD_SURFACE_CLASS,
	FOCUS_RING_CLASS,
	SHARED_SPRING_EASE_CLASS,
} from "../ui/ui.constants";
import { SiteCardLinkShell } from "./site-card-link-shell";
import type { SiteCardVisualProps } from "./site-card.types";

const COMPACT_CARD_HIT_AREA_CLASS =
	`site-card-hover-region group block h-full rounded-xl outline-none ${FOCUS_RING_CLASS}`;
const COMPACT_CARD_CLASS =
	`site-compact-card-motion pointer-events-none flex h-full items-center gap-3 p-3 ${COMPACT_CARD_SURFACE_CLASS} ${CARD_TRANSITION_CLASS} duration-300 ${SHARED_SPRING_EASE_CLASS} [@media(hover:hover)]:group-hover:bg-white [@media(hover:hover)]:group-hover:shadow-[0_12px_28px_rgba(15,23,42,0.11)] dark:[@media(hover:hover)]:group-hover:bg-zinc-800`;

export function CompactSiteCard({
	site,
	layout,
	navigation,
}: SiteCardVisualProps) {
	return (
		<SiteCardLinkShell
			ariaLabel={site.title}
			className={COMPACT_CARD_HIT_AREA_CLASS}
			navigation={navigation}
		>
			<div className={COMPACT_CARD_CLASS}>
				<SiteIcon
					site={site}
					layout={layout}
					size={40}
					className={`text-lg! transition-transform duration-300 ${SHARED_SPRING_EASE_CLASS} [@media(hover:hover)]:group-hover:scale-105`}
					initialClassName="text-sm!"
				/>
				<div className="min-w-0 flex-1">
					<div className="truncate text-sm font-medium">{site.title}</div>
					<div className="mt-0.5 truncate text-xs text-muted">
						{site.description}
					</div>
				</div>
			</div>
		</SiteCardLinkShell>
	);
}
