"use client";

import { cn } from "@heroui/react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";

const SCROLL_EDGE_TOLERANCE = 2;

type HorizontalScrollState = {
  viewportWidth: number;
  scrollWidth: number;
  maxScrollLeft: number;
};

type ScrollMeasurements = HorizontalScrollState & { contentEnd: number };

function getThumbWidth(state: HorizontalScrollState) {
  return state.scrollWidth > 0 ? Math.max(12, Math.min(100, (state.viewportWidth / state.scrollWidth) * 100)) : 100;
}

function setAttributeIfChanged(element: HTMLElement | null, name: string, value: string) {
  if (element && element.getAttribute(name) !== value) element.setAttribute(name, value);
}

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
  const viewportRef = useRef<HTMLElement | null>(null);
  const measurementsRef = useRef<ScrollMeasurements | null>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const scrollContainerId = useId();
  const [state, setState] = useState<HorizontalScrollState>({
    viewportWidth: 0,
    scrollWidth: 0,
    maxScrollLeft: 0,
  });

  const getScrollLeft = useCallback(() => viewportRef.current?.scrollLeft ?? 0, []);

  const syncScrollPosition = useCallback(() => {
    const viewport = viewportRef.current;
    const measurements = measurementsRef.current;
    if (!viewport || !measurements) return;
    const { maxScrollLeft, contentEnd } = measurements;
    const scrollLeft = Math.min(maxScrollLeft, Math.max(0, viewport.scrollLeft));
    const hasOverflowAfter = maxScrollLeft > SCROLL_EDGE_TOLERANCE
      && contentEnd - scrollLeft > SCROLL_EDGE_TOLERANCE;
    setAttributeIfChanged(rootRef.current, "data-fixed-right-shadow", String(hasOverflowAfter));
    setAttributeIfChanged(scrollbarRef.current, "aria-valuenow", String(Math.round(scrollLeft)));
    // translateX percentages use the thumb's width, not the track's width.
    // Keep high-frequency positioning out of React rendering and layout.
    const width = getThumbWidth(measurements);
    const progress = maxScrollLeft > 0 ? scrollLeft / maxScrollLeft : 0;
    const transform = `translateX(${progress * (100 - width) / width * 100}%)`;
    if (thumbRef.current && thumbRef.current.style.transform !== transform) {
      thumbRef.current.style.transform = transform;
    }
  }, []);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const viewportWidth = viewport?.clientWidth ?? 0;
    const scrollWidth = viewport && viewportWidth > 0 ? viewport.scrollWidth : 0;
    const maxScrollLeft = Math.max(0, scrollWidth - viewportWidth);
    const content = viewport?.querySelector<HTMLElement>(contentSelector);
    // Geometry is only read when content or size changes, never on scroll.
    const contentEnd = viewport && viewportWidth > 0 && content
      ? content.getBoundingClientRect().right - viewport.getBoundingClientRect().right + viewport.scrollLeft
      : maxScrollLeft;
    const nextState = {
      viewportWidth: Math.floor(viewportWidth),
      scrollWidth: Math.floor(scrollWidth),
      maxScrollLeft,
    };
    measurementsRef.current = viewportWidth > 0 ? { ...nextState, contentEnd } : null;
    if (!measurementsRef.current) setAttributeIfChanged(rootRef.current, "data-fixed-right-shadow", "false");
    setState((current) => (
      current.viewportWidth === nextState.viewportWidth
        && current.scrollWidth === nextState.scrollWidth
        && current.maxScrollLeft === nextState.maxScrollLeft
        ? current
        : nextState
    ));
    syncScrollPosition();
  }, [contentSelector, syncScrollPosition]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    let observedViewport: HTMLElement | null = null;
    let observedContent: HTMLElement | null = null;
    const refresh = () => {
      frame = 0;
      const viewport = root.querySelector<HTMLElement>(viewportSelector);
      const content = viewport?.querySelector<HTMLElement>(contentSelector) ?? null;
      // Collections can mount/replace their viewport or content after the shell.
      if (viewport !== observedViewport) {
        if (observedViewport) {
          resizeObserver.unobserve(observedViewport);
          observedViewport.removeEventListener("scroll", syncScrollPosition);
        }
        observedViewport = viewport;
        if (viewport) {
          if (!viewport.id) viewport.id = scrollContainerId;
          resizeObserver.observe(viewport);
          viewport.addEventListener("scroll", syncScrollPosition, { passive: true });
        }
      }
      if (content !== observedContent) {
        if (observedContent) resizeObserver.unobserve(observedContent);
        observedContent = content;
        if (content) resizeObserver.observe(content);
      }
      viewportRef.current = viewport;
      measure();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(refresh);
    };
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(root);
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(root, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    refresh();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      observedViewport?.removeEventListener("scroll", syncScrollPosition);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      viewportRef.current = null;
      measurementsRef.current = null;
    };
  }, [measure, syncScrollPosition, children, scrollContainerId, viewportSelector, contentSelector]);

  const scrollTo = useCallback((value: number) => {
    const viewport = viewportRef.current;
    const measurements = measurementsRef.current;
    if (viewport && measurements) viewport.scrollLeft = Math.min(Math.max(0, value), measurements.maxScrollLeft);
  }, []);
  return { rootRef, state, scrollContainerId, scrollTo, getScrollLeft, scrollbarRef, thumbRef, syncScrollPosition };
}

export function HorizontalScrollbar({
  state,
  scrollContainerId,
  scrollTo,
  getScrollLeft,
  scrollbarRef,
  thumbRef,
  syncScrollPosition,
  label,
  sticky = false,
  className,
}: Pick<ReturnType<typeof useHorizontalScroll>, "state" | "scrollContainerId" | "scrollTo" | "getScrollLeft" | "scrollbarRef" | "thumbRef" | "syncScrollPosition"> & {
  label: string;
  sticky?: boolean;
  className?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number } | null>(null);
  // Overflow/size changes can mount a new thumb or change its width.
  useLayoutEffect(syncScrollPosition, [state, syncScrollPosition]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = 48;
    if (event.key === "ArrowLeft") scrollTo(getScrollLeft() - step);
    else if (event.key === "ArrowRight") scrollTo(getScrollLeft() + step);
    else if (event.key === "Home") scrollTo(0);
    else if (event.key === "End") scrollTo(state.maxScrollLeft);
    else return;
    event.preventDefault();
  };
  const onPointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    dragStateRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: getScrollLeft() };
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

  const thumbWidth = getThumbWidth(state);

  if (state.maxScrollLeft <= 1) return null;
  return (
    <div
      ref={scrollbarRef}
      role="scrollbar"
      aria-controls={scrollContainerId}
      aria-label={`${label}横向滚动条`}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={Math.round(state.maxScrollLeft)}
      aria-valuenow={0}
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
        ref={thumbRef}
        className="absolute inset-y-0 cursor-grab touch-none rounded-full before:absolute before:inset-x-0 before:bottom-0 before:h-1 before:rounded-full before:bg-muted/55 before:transition-colors hover:before:bg-muted/70 active:cursor-grabbing"
        aria-hidden="true"
        style={{ left: 0, width: `${thumbWidth}%` }}
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
