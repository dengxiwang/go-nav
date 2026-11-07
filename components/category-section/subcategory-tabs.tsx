"use client";

import { Tabs } from "@heroui/react";
import { useAtom } from "jotai";
import { selectedSubcategoryIdAtomFamily } from "@/lib/store/site";
import type { NavCategory } from "@/types";
import type { CategorySectionModel } from "../layout.types";
import { IconView } from "../icon-view";
import { SubcategoryContent } from "./category-section-content";

function revealSelectedTab(tab: HTMLElement | null) {
	if (!tab) return;

	const list = tab.closest('[role="tablist"]');
	const scroller = list?.closest<HTMLElement>('[data-slot="scroll-shadow"]');
	if (!list || !scroller || scroller.scrollWidth <= scroller.clientWidth) return;

	const viewport = scroller.getBoundingClientRect();
	const content = list.getBoundingClientRect();
	const selected = tab.getBoundingClientRect();
	// 标签栏的渐隐区域会盖住两侧的标签。仅为仍可滚动的一侧预留空间。
	const fade = Math.min(
		Number(scroller.dataset.scrollShadowSize) || 0,
		Math.max(0, (viewport.width - selected.width) / 2),
	);
	const left = viewport.left + (content.left < viewport.left - 1 ? fade : 0);
	const right = viewport.right - (content.right > viewport.right + 1 ? fade : 0);
	if (selected.left >= left && selected.right <= right) return;

	scroller.scrollBy({
		left: (selected.left + selected.right - viewport.left - viewport.right) / 2,
		behavior: "instant",
	});
}

export function SubcategoryTabs({
	category,
	view,
}: {
	category: NavCategory;
	view: CategorySectionModel;
}) {
	const tabs = category.children ?? [];
	const [selectedId, setSelectedId] = useAtom(
		selectedSubcategoryIdAtomFamily(category.id),
	);
	const selectedKey = tabs.find((tab) => tab.id === selectedId)?.id ?? tabs[0]?.id;
	if (tabs.length === 0) return null;

	return (
		<Tabs
			selectedKey={selectedKey}
			onSelectionChange={(key) => setSelectedId(String(key))}
			className="w-full min-w-0 gap-0"
		>
			<Tabs.ListContainer className="mx-2 w-fit max-w-[calc(100%-1rem)] rounded-2xl bg-black/4 dark:bg-white/8">
				<Tabs.List aria-label={`${category.name}的子分类`} className="gap-1">
					{tabs.map((tab) => (
						<Tabs.Tab
							key={tab.id}
							id={tab.id}
							ref={tab.id === selectedKey ? revealSelectedTab : undefined}
							className="w-auto shrink-0 rounded-xl px-3 text-nowrap data-[selected=true]:text-zinc-950 dark:data-[selected=true]:text-zinc-100"
						>
							{tab.icon ? (
								<span className="mr-1 inline-flex items-center" aria-hidden>
									<IconView icon={tab.icon} size={14} />
								</span>
							) : null}
							{tab.name}
							<Tabs.Indicator className="rounded-xl bg-(--primary-foreground) shadow-sm" />
						</Tabs.Tab>
					))}
				</Tabs.List>
			</Tabs.ListContainer>
			{tabs.map((tab) => (
				<Tabs.Panel key={tab.id} id={tab.id} className="m-0 p-0">
					<SubcategoryContent category={tab} view={view} />
				</Tabs.Panel>
			))}
		</Tabs>
	);
}
