"use client";

import type { Key } from "@heroui/react";
import { EmptyState, ListBox } from "@heroui/react";
import { useScrollContainment } from "@/hooks/use-scroll-containment";
import type { LayoutConfig } from "@/types";
import { SiteIcon } from "../site-icon";
import { SearchPanelShell } from "./search-panel-shell";
import type { SearchBarSite } from "./search-bar.types";
import { ACTIVE_LIST_ITEM_CLASS } from "../ui/ui.constants";
import { DROPDOWN_MAX_HEIGHT } from "./search-bar.utils";

export function SearchLocalResultsPanel({
	activeIndex,
	layout,
	onAction,
	results,
}: {
	activeIndex: number;
	layout?: HeaderLayout;
	onAction: (id: Key) => void;
	results: SearchBarSite[];
}) {
	const scrollRef = useScrollContainment<HTMLDivElement>();

	return (
		<SearchPanelShell>
			<ListBox
				ref={scrollRef}
				aria-label="搜索结果"
				onAction={onAction}
				className="overflow-y-auto p-1.5"
				style={{ maxHeight: DROPDOWN_MAX_HEIGHT }}
				renderEmptyState={() => <EmptyState>未找到匹配的网站</EmptyState>}
			>
				{results.map((result, index) => (
					<ListBox.Item
						key={`${result.categoryId}-${result.url}`}
						id={`${result.categoryId}-${result.url}`}
						textValue={result.title}
						data-keyboard-index={index}
						className={`px-2.5 py-1.5 min-h-12 shrink-0 ${
							activeIndex === index ? ACTIVE_LIST_ITEM_CLASS : ""
						}`}
					>
						<SiteIcon
							site={result}
							layout={layout}
							size={24}
							className="text-[11px]!"
							textClassName="text-[11px]!"
							initialClassName="text-[10px]!"
						/>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-1.5">
								<span className="truncate text-sm font-medium">
									{result.title}
								</span>
								<span className="shrink-0 rounded bg-default/80 px-1 py-px text-[10px]! font-medium text-muted leading-tight">
									{result.categoryName}
								</span>
							</div>
							<div className="truncate text-xs text-muted">
								{result.description}
							</div>
						</div>
						<ListBox.ItemIndicator />
					</ListBox.Item>
				))}
			</ListBox>
		</SearchPanelShell>
	);
}

type HeaderLayout = Pick<
	LayoutConfig,
	"defaultIconPadding" | "iconBorderRadius" | "linkTarget" | "autoUseIntranet"
>;
