"use client";

import { cn } from "@heroui/react";
import type { ReactNode } from "react";

export function AdminSwitch({
	isSelected,
	onChange,
	children,
	ariaLabel,
	isDisabled = false,
	size = "md",
	className,
	contentClassName,
}: {
	isSelected: boolean;
	onChange: (selected: boolean) => void;
	children?: ReactNode;
	ariaLabel?: string;
	isDisabled?: boolean;
	size?: "sm" | "md" | "lg";
	className?: string;
	contentClassName?: string;
}) {
	return (
		<div
			className={cn("switch", `switch--${size}`, className)}
			data-selected={isSelected || undefined}
			data-disabled={isDisabled || undefined}
		>
			<button
				type="button"
				role="switch"
				aria-checked={isSelected}
				aria-label={ariaLabel}
				disabled={isDisabled}
				data-slot="switch-content"
				data-selected={isSelected || undefined}
				data-disabled={isDisabled || undefined}
				className={cn(
					"switch__content group focus-visible:outline-none",
					contentClassName,
				)}
				onClick={() => onChange(!isSelected)}
			>
				<span
					className="switch__control group-focus-visible:ring-2 group-focus-visible:ring-focus group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background"
					data-slot="switch-control"
				>
					<span className="switch__thumb" data-slot="switch-thumb" />
				</span>
				{children}
			</button>
		</div>
	);
}
