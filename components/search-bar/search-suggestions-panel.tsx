"use client";

import type { Key } from "@heroui/react";
import { ListBox } from "@heroui/react";
import { useScrollContainment } from "@/hooks/use-scroll-containment";
import { SearchPanelShell } from "./search-panel-shell";
import { DROPDOWN_MAX_HEIGHT } from "./search-bar.utils";
import type { SuggestionItem } from "./search-bar.types";
import { ACTIVE_LIST_ITEM_CLASS } from "../ui/ui.constants";

export function SearchSuggestionsPanel({
	activeIndex,
	onAction,
	suggestions,
}: {
	activeIndex: number;
	onAction: (id: Key) => void;
	suggestions: SuggestionItem[];
}) {
	const scrollRef = useScrollContainment<HTMLDivElement>();

	return (
		<SearchPanelShell>
			<ListBox
				ref={scrollRef}
				aria-label="搜索建议"
				onAction={onAction}
				className="overflow-y-auto p-1.5"
				style={{ maxHeight: DROPDOWN_MAX_HEIGHT }}
			>
				{suggestions.map((suggestion, index) => (
					<ListBox.Item
						key={suggestion.key}
						id={String(suggestion.key)}
						textValue={suggestion.label}
						data-keyboard-index={index}
						className={`px-2.5 py-1.5 ${
							activeIndex === index ? ACTIVE_LIST_ITEM_CLASS : ""
						}`}
					>
						<svg
							className="w-3.5 h-3.5 shrink-0 text-muted"
							viewBox="0 0 16 16"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
						>
							<circle cx="6.5" cy="6.5" r="4.5" />
							<path d="M10 10l4 4" strokeLinecap="round" />
						</svg>
						<span className="truncate text-sm">{suggestion.label}</span>
						<ListBox.ItemIndicator />
					</ListBox.Item>
				))}
			</ListBox>
		</SearchPanelShell>
	);
}
