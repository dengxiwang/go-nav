"use client";

import { Table, cn } from "@heroui/react";
import type { ReactNode } from "react";
import { HorizontalScrollbar, useHorizontalScroll } from "./horizontal-scroll";
import styles from "./table-shell.module.css";

type TableShellProps = {
  children: ReactNode;
  variant?: "primary" | "secondary";
  "aria-label"?: string;
  className?: string;
  stickyScrollbar?: boolean;
};

export function TableShell({ children, variant, "aria-label": ariaLabel, className, stickyScrollbar = false }: TableShellProps) {
  const { rootRef, ...scrollbar } = useHorizontalScroll({
    children,
    viewportSelector: ".table__scroll-container",
    contentSelector: "[data-slot='table-content']",
  });

  return (
    <Table
      ref={rootRef}
      className={cn("group group/horizontal-scroll relative max-w-full", stickyScrollbar ? "overflow-visible" : "overflow-hidden", styles.table, className)}
      data-fixed-right-shadow={scrollbar.state.hasOverflowAfter ? "true" : "false"}
      aria-label={ariaLabel}
      variant={variant}
    >
      {children}
      <HorizontalScrollbar
        {...scrollbar}
        label={ariaLabel || "表格"}
        sticky={stickyScrollbar}
        className={!stickyScrollbar && variant !== "secondary" ? "inset-x-1" : undefined}
      />
    </Table>
  );
}
