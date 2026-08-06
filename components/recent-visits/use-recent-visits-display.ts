"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

const MAX_ROWS_CAP = 5;
const GRID_GAP = 12;

const ROW_BREAKPOINTS: { min: number; rows: number }[] = [
	{ min: 1400, rows: 1 },
	{ min: 1000, rows: 2 },
	{ min: 700, rows: 3 },
	{ min: 450, rows: 4 },
	{ min: 0, rows: 5 },
];

function parseCssSizeToPx(value: string, fallback = 16) {
	const n = parseFloat(value);
	if (Number.isNaN(n)) return fallback;
	if (/rem$/.test(value)) return n * 16;
	return n;
}

function getMaxRows(width: number): number {
	for (const bp of ROW_BREAKPOINTS) {
		if (width >= bp.min) return bp.rows;
	}
	return MAX_ROWS_CAP;
}

export function useRecentVisitsDisplay({
	mounted,
	totalItems,
	minCardWidth,
}: {
	mounted: boolean;
	totalItems: number;
	minCardWidth: string;
}) {
	const minCardWidthPx = parseCssSizeToPx(minCardWidth);
	const gridRef = useRef<HTMLDivElement>(null);
	const lastLayoutKeyRef = useRef("");
	// 路由返回时 useRecentVisits 会提供模块缓存，先完整显示已有卡片，
	// 再由布局 effect 根据当前宽度收敛到最大行数，避免恢复滚动时先出现空高度。
	const [displayCount, setDisplayCount] = useState(totalItems);

	const applyDisplayCountToGrid = useCallback((count: number) => {
		const grid = gridRef.current;
		if (!grid) return;

		for (const [index, child] of Array.from(grid.children).entries()) {
			(child as HTMLElement).style.display = index < count ? "" : "none";
		}
	}, []);

	useLayoutEffect(() => {
		if (!mounted) return;
		const grid = gridRef.current;

		if (!grid || totalItems === 0) {
			applyDisplayCountToGrid(0);
			setDisplayCount((prev) => (prev === 0 ? prev : 0));
			lastLayoutKeyRef.current = "";
			return;
		}

		if (totalItems <= MAX_ROWS_CAP) {
			lastLayoutKeyRef.current = `static:${totalItems}`;
			applyDisplayCountToGrid(totalItems);
			setDisplayCount((prev) => (prev === totalItems ? prev : totalItems));
			return;
		}

		const updateDisplayCount = (width: number, force = false) => {
			if (width === 0) return;

			const columns = Math.max(
				1,
				Math.floor((width + GRID_GAP) / (minCardWidthPx + GRID_GAP)),
			);
			const maxRows = getMaxRows(width);
			const layoutKey = `${columns}:${maxRows}:${totalItems}`;

			if (!force && layoutKey === lastLayoutKeyRef.current) return;
			lastLayoutKeyRef.current = layoutKey;

			const totalRows = Math.ceil(totalItems / columns);
			const nextDisplayCount =
				totalRows > maxRows ? columns * maxRows : totalItems;

			applyDisplayCountToGrid(nextDisplayCount);
			setDisplayCount((prev) =>
				prev === nextDisplayCount ? prev : nextDisplayCount,
			);
		};

		updateDisplayCount(grid.clientWidth, true);
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? grid.clientWidth;
			updateDisplayCount(width);
		});

		observer.observe(grid);

		return () => {
			observer.disconnect();
		};
	}, [applyDisplayCountToGrid, minCardWidthPx, mounted, totalItems]);

	return {
		displayCount,
		gridRef,
	};
}
