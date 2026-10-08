"use client";

import { cn } from "@heroui/react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";

const SCROLL_EDGE_TOLERANCE = 2;

type HorizontalScrollState = {
  viewportWidth: number;
  scrollWidth: number;
  scrollLeft: number;
  maxScrollLeft: number;
  hasOverflowAfter: boolean;
};

export function useHorizontalScroll({
  children,
  viewportSelector,
  contentSelector,
}: {
  children: ReactNode;
  viewportSelector: string;
  contentSelector: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollContainerId = useId();
  const [state, setState] = useState<HorizontalScrollState>({
    viewportWidth: 0,
    scrollWidth: 0,
    scrollLeft: 0,
    maxScrollLeft: 0,
    hasOverflowAfter: false,
  });

  const measure = useCallback(() => {
    const root = rootRef.current;
    const scrollContainer = root?.querySelector<HTMLElement>(viewportSelector);
    if (!scrollContainer) return;
    if (!scrollContainer.id) scrollContainer.id = scrollContainerId;
    const maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
    const scrollLeft = Math.min(maxScrollLeft, Math.max(0, scrollContainer.scrollLeft));
    const content = scrollContainer.querySelector<HTMLElement>(contentSelector);
    const remainingContentWidth = content
      ? content.getBoundingClientRect().right - scrollContainer.getBoundingClientRect().right
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
  }, [scrollContainerId, viewportSelector, contentSelector]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resizeObserver = new ResizeObserver(schedule);
    const scrollContainer = root.querySelector<HTMLElement>(viewportSelector);
    if (scrollContainer && !scrollContainer.id) scrollContainer.id = scrollContainerId;
    resizeObserver.observe(root);
    if (scrollContainer) {
      resizeObserver.observe(scrollContainer);
      scrollContainer.addEventListener("scroll", schedule, { passive: true });
    }
    const content = scrollContainer?.querySelector<HTMLElement>(contentSelector);
    if (content) resizeObserver.observe(content);
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
  }, [measure, children, scrollContainerId, viewportSelector, contentSelector]);

  const scrollTo = (value: number) => {
    const container = rootRef.current?.querySelector<HTMLElement>(viewportSelector);
    if (container) container.scrollLeft = Math.min(Math.max(0, value), state.maxScrollLeft);
  };
  return { rootRef, state, scrollContainerId, scrollTo };
}

export function HorizontalScrollbar({
  state,
  scrollContainerId,
  scrollTo,
  label,
  sticky = false,
  className,
}: Pick<ReturnType<typeof useHorizontalScroll>, "state" | "scrollContainerId" | "scrollTo"> & {
  label: string;
  sticky?: boolean;
  className?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number } | null>(null);
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
    setIsDragging(true);
    dragStateRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: state.scrollLeft };
  };
  const onPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    if (event.buttons === 0) {
      // 拖拽未正常收尾（窗口外松开、指针捕获丢失）时清理残留状态，悬停移动不再跟随。
      dragStateRef.current = null;
      setIsDragging(false);
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
    setIsDragging(false);
  };
  const onLostPointerCapture = () => {
    dragStateRef.current = null;
    setIsDragging(false);
  };

  const thumbWidth = state.scrollWidth > 0 ? Math.max(12, Math.min(100, (state.viewportWidth / state.scrollWidth) * 100)) : 100;
  const thumbLeft = state.maxScrollLeft > 0 ? (state.scrollLeft / state.maxScrollLeft) * (100 - thumbWidth) : 0;

  if (state.maxScrollLeft <= 1) return null;
  return (
    <div
      role="scrollbar"
      aria-controls={scrollContainerId}
      aria-label={`${label}横向滚动条`}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={Math.round(state.maxScrollLeft)}
      aria-valuenow={Math.round(state.scrollLeft)}
      tabIndex={0}
      data-dragging={isDragging || undefined}
      className={cn(
        "bottom-0 z-40 h-3 cursor-default touch-none rounded-full opacity-0 outline-none transition-opacity group-hover/horizontal-scroll:opacity-100 focus-visible:opacity-100 data-[dragging=true]:opacity-100 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1",
        // 负边距把 sticky 滚动条叠在内容底边，不额外占位或向内缩进。
        sticky ? "sticky -mt-3" : "absolute inset-x-0",
        className,
      )}
      onKeyDown={onKeyDown}
    >
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-default/80" />
      <span
        className="absolute inset-y-0 cursor-grab touch-none rounded-full before:absolute before:inset-x-0 before:bottom-0 before:h-1 before:rounded-full before:bg-muted/55 before:transition-colors hover:before:bg-muted/70 active:cursor-grabbing"
        aria-hidden="true"
        style={{ left: `${thumbLeft}%`, width: `${thumbWidth}%` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onLostPointerCapture={onLostPointerCapture}
      />
    </div>
  );
}

export function HorizontalScrollArea({ children, label, className }: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const { rootRef, ...scrollbar } = useHorizontalScroll({
    children,
    viewportSelector: "[data-horizontal-scroll-viewport]",
    contentSelector: "[data-horizontal-scroll-content]",
  });

  return (
    <div ref={rootRef} className={cn("group/horizontal-scroll relative min-w-0 max-w-full", className)}>
      <div data-horizontal-scroll-viewport className="overflow-x-auto rounded-[inherit]">
        <div data-horizontal-scroll-content>{children}</div>
      </div>
      {/* 滚动条留在横向视口外，长列表中才能跟随页面保持在可见区域。 */}
      <HorizontalScrollbar {...scrollbar} label={label} sticky />
    </div>
  );
}
