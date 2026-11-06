"use client";

import { useCallback, useMemo, type MouseEvent } from "react";
import { useStore } from "jotai";
import { activeIdAtom, selectedSubcategoryIdsAtom } from "@/lib/store/site";
import type { LayoutConfig, NavSite } from "@/types";
import { recordVisit } from "@/hooks/use-recent-visits";
import {
	getPreferredSiteHref,
	openSiteWithPreference,
	type SiteLinkMode,
} from "@/lib/client/site-link";
import {
	getCurrentPageRouteKey,
	saveHomeSnapshot,
	savePageSnapshot,
} from "@/lib/client/home-restore";
import { buildSiteDetailPath, buildSiteDetailSlug } from "@/lib/site-detail";
import type { SiteCardData, SiteCardNavigationModel } from "./site-card.types";

export function useSiteCardNavigation({
	site,
	trackVisit,
	layout,
	siteLinkMode,
}: {
	site: SiteCardData;
	trackVisit: boolean;
	layout?: Required<LayoutConfig>;
	siteLinkMode: SiteLinkMode;
}): SiteCardNavigationModel {
	const store = useStore();
	const detailHref = useMemo(() => buildSiteDetailPath(site), [site]);
	const useDetailPage = layout?.enableSiteDetailPage === true;
	const target =
		useDetailPage || layout?.linkTarget === "current" ? undefined : "_blank";
	const rel = target ? "noopener noreferrer" : undefined;
	const preferredHref = useMemo(
		() =>
			getPreferredSiteHref(
				site,
				{
					autoUseIntranet: layout?.autoUseIntranet,
				},
				siteLinkMode,
			),
		[layout?.autoUseIntranet, site, siteLinkMode],
	);
	const href = useDetailPage ? detailHref : preferredHref;

	const handleClick = useCallback(
		(event: MouseEvent<HTMLAnchorElement>) => {
			if (useDetailPage) return;
			const isModifiedClick =
				event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

			if (isModifiedClick) {
				if (trackVisit) recordVisit(site as NavSite);
				return;
			}

			event.preventDefault();
			if (trackVisit) {
				recordVisit(site as NavSite);
			}
			void openSiteWithPreference(site, {
				linkTarget: layout?.linkTarget,
				autoUseIntranet: layout?.autoUseIntranet,
			});
		},
		[
			layout?.autoUseIntranet,
			layout?.linkTarget,
			site,
			trackVisit,
			useDetailPage,
		],
	);

	const handleAuxClick = useCallback(
		(event: MouseEvent<HTMLAnchorElement>) => {
			if (useDetailPage) return;
			if (event.button !== 1) return;

			event.preventDefault();
			if (trackVisit) {
				recordVisit(site as NavSite);
			}
			void openSiteWithPreference(
				site,
				{
					linkTarget: layout?.linkTarget,
					autoUseIntranet: layout?.autoUseIntranet,
				},
				{ forceNewTab: true },
			);
		},
		[
			layout?.autoUseIntranet,
			layout?.linkTarget,
			site,
			trackVisit,
			useDetailPage,
		],
	);

	const handleDetailNavigate = useCallback(
		(event: MouseEvent<HTMLAnchorElement>) => {
			if (!useDetailPage) return;
			if (event.defaultPrevented) return;
			if (event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

			const snapshot = {
				scrollY: window.scrollY,
				activeId: store.get(activeIdAtom),
				selectedSubcategoryIds: store.get(selectedSubcategoryIdsAtom),
				detailSlug: buildSiteDetailSlug(site),
			};
			saveHomeSnapshot(snapshot);
			savePageSnapshot(getCurrentPageRouteKey(), snapshot);
		},
		[site, store, useDetailPage],
	);

	return {
		detailHref,
		handleAuxClick,
		handleClick,
		handleDetailNavigate,
		href,
		rel,
		target,
		useDetailPage,
	};
}
