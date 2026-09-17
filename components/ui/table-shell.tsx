"use client";

import { Table, cn } from "@heroui/react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";

import styles from "./table-shell.module.css";

const SCROLL_EDGE_TOLERANCE = 2;

type TableShellProps = {
  children: ReactNode;
  variant?: "primary" | "secondary";
  "aria-label"?: string;
  className?: string;
};

type ScrollState = {
  viewportWidth: number;
  scrollWidth: number;
  scrollLeft: number;
  maxScrollLeft: number;
  hasOverflowAfter: boolean;
};

export function TableShell({ children, variant, "aria-label": ariaLabel, className }: TableShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number } | null>(null);
  const scrollbarId = useId();
  const scrollContainerId = useId();
  const [state, setState] = useState<ScrollState>({
    viewportWidth: 0,
    scrollWidth: 0,
    scrollLeft: 0,
    maxScrollLeft: 0,
    hasOverflowAfter: false,
  });

  const measure = useCallback(() => {
    const root = rootRef.current;
    const scrollContainer = root?.querySelector<HTMLElement>(".table__scroll-container");
    if (!scrollContainer) return;
    if (!scrollContainer.id) scrollContainer.id = scrollContainerId;
    const maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
    const scrollLeft = Math.min(maxScrollLeft, Math.max(0, scrollContainer.scrollLeft));
    const tableContent = scrollContainer.querySelector<HTMLElement>("[data-slot='table-content']");
    const remainingContentWidth = tableContent
      ? tableContent.getBoundingClientRect().right - scrollContainer.getBoundingClientRect().right
      : maxScrollLeft - scrollLeft;
    const nextState = {
      viewportWidth: Math.floor(scrollContainer.clientWidth),
      scrollWidth: Math.floor(scrollContainer.scrollWidth),
      scrollLeft,
      maxScrollLeft,
      hasOverflowAfter: maxScrollLeft > SCROLL_EDGE_TOLERANCE
        && remainingContentWidth > SCROLL_EDGE_TOLERANCE,
    };
    setState((current) => (
      current.viewportWidth === nextState.viewportWidth
        && current.scrollWidth === nextState.scrollWidth
        && current.scrollLeft === nextState.scrollLeft
        && current.maxScrollLeft === nextState.maxScrollLeft
        && current.hasOverflowAfter === nextState.hasOverflowAfter
        ? current
        : nextState
    ));
  }, [scrollContainerId]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resizeObserver = new ResizeObserver(schedule);
    const scrollContainer = root.querySelector<HTMLElement>(".table__scroll-container");
    if (scrollContainer && !scrollContainer.id) scrollContainer.id = scrollContainerId;
    resizeObserver.observe(root);
    if (scrollContainer) {
      resizeObserver.observe(scrollContainer);
      scrollContainer.addEventListener("scroll", schedule, { passive: true });
    }
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(root, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      scrollContainer?.removeEventListener("scroll", schedule);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [measure, children, scrollContainerId]);

  const scrollTo = (value: number) => {
    const container = rootRef.current?.querySelector<HTMLElement>(".table__scroll-container");
    if (container) container.scrollLeft = Math.min(Math.max(0, value), state.maxScrollLeft);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = 48;
    if (event.key === "ArrowLeft") scrollTo(state.scrollLeft - step);
    else if (event.key === "ArrowRight") scrollTo(state.scrollLeft + step);
    else if (event.key === "Home") scrollTo(0);
    else if (event.key === "End") scrollTo(state.maxScrollLeft);
    else return;
    event.preventDefault();
  };
  const onPointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: state.scrollLeft };
  };
  const onPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    if (event.buttons === 0) {
      // 拖拽未正常收尾（窗口外松开、指针捕获丢失）时清理残留状态，悬停移动不再跟随。
      dragStateRef.current = null;
      return;
    }
    const track = event.currentTarget.parentElement;
    if (!track) return;
    const thumbWidth = event.currentTarget.getBoundingClientRect().width;
    const availableTrack = Math.max(1, track.getBoundingClientRect().width - thumbWidth);
    scrollTo(dragState.startScrollLeft + ((event.clientX - dragState.startX) / availableTrack) * state.maxScrollLeft);
  };
  const stopDragging = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragStateRef.current = null;
  };
  const onLostPointerCapture = () => {
    dragStateRef.current = null;
  };

  const thumbWidth = state.scrollWidth > 0 ? Math.max(12, Math.min(100, (state.viewportWidth / state.scrollWidth) * 100)) : 100;
  const thumbLeft = state.maxScrollLeft > 0 ? (state.scrollLeft / state.maxScrollLeft) * (100 - thumbWidth) : 0;

  return (
    <Table
      ref={rootRef}
      className={cn("group relative max-w-full overflow-hidden", styles.table, className)}
      data-fixed-right-shadow={state.hasOverflowAfter ? "true" : "false"}
      aria-label={ariaLabel}
      variant={variant}
    >
      {children}
      {state.maxScrollLeft > 1 ? (
        <div
          id={scrollbarId}
          role="scrollbar"
          aria-controls={scrollContainerId}
          aria-label={`${ariaLabel || "表格"}横向滚动条`}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={Math.round(state.maxScrollLeft)}
          aria-valuenow={Math.round(state.scrollLeft)}
          tabIndex={0}
          className="absolute inset-x-1 bottom-0 z-40 h-3 cursor-default touch-none rounded-full opacity-0 outline-none transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1"
          onKeyDown={onKeyDown}
        >
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-default/80" />
          <span
            className="absolute bottom-0 h-1 cursor-grab touch-none rounded-full bg-muted/55 transition-colors hover:bg-muted/70 active:cursor-grabbing"
            aria-hidden="true"
            style={{ left: `${thumbLeft}%`, width: `${thumbWidth}%` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onLostPointerCapture={onLostPointerCapture}
          />
        </div>
      ) : null}
    </Table>
  );
}
