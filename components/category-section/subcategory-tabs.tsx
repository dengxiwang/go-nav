"use client";

import { Tabs } from "@heroui/react";
import type { NavCategory } from "@/types";
import type { CategorySectionModel } from "../layout.types";
import { IconView } from "../icon-view";
import { SubcategoryContent } from "./category-section-content";

export function SubcategoryTabs({
	category,
	view,
}: {
	category: NavCategory;
	view: CategorySectionModel;
}) {
	const tabs = category.children ?? [];
	if (tabs.length === 0) return null;

	return (
		<Tabs defaultSelectedKey={tabs[0].id} className="w-full min-w-0 gap-0">
			<Tabs.ListContainer className="mx-2 w-fit max-w-[calc(100%-1rem)] rounded-2xl bg-black/4 dark:bg-white/8">
				<Tabs.List aria-label={`${category.name}的子分类`} className="gap-1">
					{tabs.map((tab) => (
						<Tabs.Tab
							key={tab.id}
							id={tab.id}
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
