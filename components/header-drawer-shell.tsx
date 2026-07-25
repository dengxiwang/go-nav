"use client";

import type { ReactNode } from "react";
import { cn, Drawer } from "@heroui/react";

export function HeaderDrawerShell({
	open,
	onOpenChange,
	placement,
	header,
	children,
	bodyClassName,
	dialogClassName,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	placement: "left" | "right";
	header: ReactNode;
	children: ReactNode;
	bodyClassName?: string;
	dialogClassName?: string;
	}) {
	return (
			<Drawer.Backdrop isOpen={open} onOpenChange={onOpenChange}>
				<Drawer.Content placement={placement}>
					<Drawer.Dialog
						className={cn(
							"w-dvw max-w-72 bg-background p-3 shadow-2xl ring-1 ring-black/5",
							placement === "right" && "ml-auto",
							dialogClassName,
						)}
					>
						<Drawer.CloseTrigger />
						<Drawer.Header>{header}</Drawer.Header>
						<Drawer.Body className={cn("overflow-y-auto p-0", bodyClassName)}>
							{children}
						</Drawer.Body>
					</Drawer.Dialog>
				</Drawer.Content>
			</Drawer.Backdrop>
	);
}
