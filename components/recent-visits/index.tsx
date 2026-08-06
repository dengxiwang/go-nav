"use client";

import { memo, useMemo } from "react";
import type { LayoutConfig } from "@/types";
import { useRecentVisits } from "@/hooks/use-recent-visits";
import { useSiteLinkMode } from "@/lib/client/site-link";
import type { CardGridModel } from "../layout.types";
import { RecentVisitsGrid } from "./recent-visits-grid";
import { RecentVisitsHeader } from "./recent-visits-header";
import { useRecentVisitsDisplay } from "./use-recent-visits-display";
import { useRecentVisitsEntrance } from "./use-recent-visits-entrance";

export const RecentVisits = memo(function RecentVisits({
	maxItems = 20,
	cards,
	delay = 150,
	disableEntranceAnimation = false,
	layout,
}: {
	maxItems?: number;
	cards: CardGridModel;
	delay?: number;
	disableEntranceAnimation?: boolean;
	layout?: Required<LayoutConfig>;
}) {
	const { visits, clearVisits, mounted } = useRecentVisits();
	const siteLinkMode = useSiteLinkMode();
	const displayVisits = useMemo(
		() => visits.slice(0, maxItems),
		[visits, maxItems],
	);
	const hasData = displayVisits.length > 0;
	const { displayCount, gridRef } = useRecentVisitsDisplay({
		mounted,
		totalItems: displayVisits.length,
		minCardWidth: cards.minWidth,
	});
	const { contentRef, wrapperRef, wrapperStyle, handleTransitionEnd } =
		useRecentVisitsEntrance({
			mounted,
			visibleItemCount: displayCount,
			delay,
			disableEntranceAnimation,
		});

	if (!hasData) return null;

	return (
		<div
			ref={wrapperRef}
			className="recent-visits-entrance origin-top"
			onTransitionEnd={handleTransitionEnd}
			style={wrapperStyle}
		>
			<div ref={contentRef}>
				<section className="pb-4">
					<RecentVisitsHeader onClear={clearVisits} />
					<RecentVisitsGrid
						visits={displayVisits}
						displayCount={displayCount}
						cards={cards}
						layout={layout}
						gridRef={gridRef}
						siteLinkMode={siteLinkMode}
					/>
				</section>
			</div>
		</div>
	);
});
