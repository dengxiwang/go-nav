"use client";

import type { PointerEvent, RefObject } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type Props = {
	rootRef: RefObject<HTMLElement | null>;
	"aria-label": string;
};

export function TableHorizontalScrollbar({ rootRef, "aria-label": ariaLabel }: Props) {
	const id = useId();
	const dragRef = useRef<{ x: number; scrollLeft: number; pointerId: number } | null>(null);
	const [metrics, setMetrics] = useState({ viewport: 0, width: 0, left: 0 });

	const measure = useCallback(() => {
		const root = rootRef.current;
		const container = root?.querySelector<HTMLElement>(".table__scroll-container");
		if (!container) return;
		if (!container.id) container.id = `${id}-container`;
		setMetrics({
			viewport: container.clientWidth,
			width: container.scrollWidth,
			left: container.scrollLeft,
		});
	}, [id, rootRef]);

	useEffect(() => {
		const root = rootRef.current;
		const container = root?.querySelector<HTMLElement>(".table__scroll-container");
		if (!container) return;
		const observer = new ResizeObserver(measure);
		observer.observe(container);
		container.addEventListener("scroll", measure, { passive: true });
		measure();
		return () => {
			observer.disconnect();
			container.removeEventListener("scroll", measure);
		};
	}, [measure, rootRef]);

	const max = Math.max(0, metrics.width - metrics.viewport);
	if (max <= 1) return null;
	const thumbWidth = Math.max(12, Math.min(100, (metrics.viewport / metrics.width) * 100));
	const thumbLeft = max ? (metrics.left / max) * (100 - thumbWidth) : 0;

	const onPointerDown = (event: PointerEvent<HTMLSpanElement>) => {
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		dragRef.current = { x: event.clientX, scrollLeft: metrics.left, pointerId: event.pointerId };
	};
	const onPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
		const drag = dragRef.current;
		const track = event.currentTarget.parentElement;
		if (!drag || !track || drag.pointerId !== event.pointerId) return;
		if (event.buttons === 0) {
			// 拖拽未正常收尾（窗口外松开、指针捕获丢失）时清理残留状态，悬停移动不再跟随。
			dragRef.current = null;
			return;
		}
		const thumb = event.currentTarget.getBoundingClientRect().width;
		const available = Math.max(1, track.getBoundingClientRect().width - thumb);
		const container = rootRef.current?.querySelector<HTMLElement>(".table__scroll-container");
		if (container) container.scrollLeft = drag.scrollLeft + ((event.clientX - drag.x) / available) * max;
	};
	const stop = (event: PointerEvent<HTMLSpanElement>) => {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
		dragRef.current = null;
	};
	const onLostPointerCapture = () => {
		dragRef.current = null;
	};

	return (
		<div
			id={id}
			role="scrollbar"
			aria-label={ariaLabel}
			aria-controls={`${id}-container`}
			aria-orientation="horizontal"
			aria-valuemin={0}
			aria-valuemax={Math.round(max)}
			aria-valuenow={Math.round(metrics.left)}
			className="absolute inset-x-1 bottom-0 z-40 h-3 rounded-full opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100"
			tabIndex={0}
		>
			<span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-default/80" />
			<span
				className="absolute bottom-0 h-1 cursor-grab rounded-full bg-muted/55 hover:bg-muted/70 active:cursor-grabbing"
				style={{ left: `${thumbLeft}%`, width: `${thumbWidth}%` }}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={stop}
				onPointerCancel={stop}
				onLostPointerCapture={onLostPointerCapture}
			/>
		</div>
	);
}
