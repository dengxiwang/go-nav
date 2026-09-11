"use client";

import type { NavCategory } from "@/types";
import type { CategorySectionModel } from "../layout.types";
import { IconView } from "../icon-view";
import { SiteGrid } from "../site-card";
import { InlineEmptyHint } from "../ui/empty-state-blocks";

export function CategoryContent({
	category,
	view,
}: {
	category: NavCategory;
	view: CategorySectionModel;
}) {
	const { cards, layout } = view;

	if ((category.children?.length ?? 0) === 1) {
		return <SubcategoryContent category={category.children![0]} view={view} />;
	}

	if (category.sites && category.sites.length > 0) {
		return <SiteGrid sites={category.sites} cards={cards} layout={layout} />;
	}

	return <EmptyHint />;
}

export function SubcategoryContent({
	category,
	view,
}: {
	category: NavCategory;
	view: CategorySectionModel;
}) {
	const { cards, display, layout } = view;

	return (
		<div id={category.id}>
			{category.sites && category.sites.length > 0 ? (
				<SiteGrid sites={category.sites} cards={cards} layout={layout} />
			) : null}

			{category.children?.map((child) => (
				<div key={child.id} id={child.id} className="category-anchor space-y-3">
					{display.showTitle ? (
						<h3 className="text-sm font-semibold">
							{child.icon ? (
								<span className="mr-1 inline-flex items-center" aria-hidden>
									<IconView icon={child.icon} size={16} />
								</span>
							) : null}
							{child.name}
							{display.showDescription && child.description ? (
								<span className="ml-2 text-sm font-normal text-muted">
									{child.description}
								</span>
							) : null}
						</h3>
					) : null}
					{child.sites && child.sites.length > 0 ? (
						<SiteGrid sites={child.sites} cards={cards} layout={layout} />
					) : null}
				</div>
			))}
		</div>
	);
}

function EmptyHint() {
	return <InlineEmptyHint>暂无内容</InlineEmptyHint>;
}
