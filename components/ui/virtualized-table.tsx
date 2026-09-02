"use client";

import { Table, TableLayout, Virtualizer } from "@heroui/react";
import type { ReactNode } from "react";
import { useRef } from "react";

import { TableHorizontalScrollbar } from "./table-horizontal-scrollbar";

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
	const rootRef = useRef<HTMLDivElement>(null);

	return (
		<Virtualizer
			layout={TableLayout}
			layoutOptions={{ headingHeight, rowHeight }}
		>
			<div
				ref={rootRef}
				className={`relative max-w-full overflow-hidden rounded-2xl ${className ?? ""}`}
			>
				<Table
					variant={variant}
					aria-label={ariaLabel}
					className="overflow-hidden rounded-2xl border border-default"
				>
					<Table.ScrollContainer>
						<Table.Content
							aria-label={ariaLabel}
							className="h-full min-h-96 max-h-[calc(100dvh-304px)] w-full overflow-y-scroll"
							style={minWidth ? { minWidth } : undefined}
						>
							{children}
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
				<TableHorizontalScrollbar
					rootRef={rootRef}
					aria-label={`${ariaLabel}横向滚动条`}
				/>
			</div>
		</Virtualizer>
	);
}
