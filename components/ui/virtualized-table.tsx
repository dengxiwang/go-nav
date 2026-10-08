"use client";

import { Table, TableLayout, Virtualizer } from "@heroui/react";
import type { ReactNode } from "react";
import { useScrollContainment } from "@/hooks/use-scroll-containment";

import { HorizontalScrollbar, useHorizontalScroll } from "./horizontal-scroll";

type VirtualizedTableProps = {
	children: ReactNode;
	"aria-label": string;
	rowHeight?: number;
	headingHeight?: number;
	variant?: "primary" | "secondary";
	className?: string;
	minWidth?: number;
};

export function VirtualizedTable({
	children,
	"aria-label": ariaLabel,
	rowHeight = 42,
	headingHeight = 36,
	variant = "primary",
	className,
	minWidth,
}: VirtualizedTableProps) {
	const contentScrollRef = useScrollContainment<HTMLTableElement>();
	const { rootRef, ...scrollbar } = useHorizontalScroll({
		children,
		viewportSelector: ".table__scroll-container",
		contentSelector: "[data-slot='table-content']",
	});

	return (
		<Virtualizer
			layout={TableLayout}
			layoutOptions={{ headingHeight, rowHeight }}
		>
			<div
				ref={rootRef}
				className={`group/horizontal-scroll relative max-w-full overflow-hidden rounded-2xl ${className ?? ""}`}
			>
				<Table
					variant={variant}
					aria-label={ariaLabel}
					className="overflow-hidden rounded-2xl border border-default"
				>
					<Table.ScrollContainer>
						<Table.Content
							ref={contentScrollRef}
							aria-label={ariaLabel}
							className="h-full min-h-96 max-h-[calc(100dvh-304px)] w-full overflow-y-auto"
							style={minWidth ? { minWidth } : undefined}
						>
							{children}
						</Table.Content>
					</Table.ScrollContainer>
					<HorizontalScrollbar
						{...scrollbar}
						label={ariaLabel}
						className={variant === "primary" ? "inset-x-1 bottom-1" : undefined}
					/>
				</Table>
			</div>
		</Virtualizer>
	);
}
