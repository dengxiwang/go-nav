"use client";

import type { ReactNode } from "react";
import { Drawer } from "@heroui/react";
import { HeaderDrawerShell } from "./header-drawer-shell";
import { IconView } from "./icon-view";

export function MobileNavDrawer({
	open,
	onOpenChange,
	title,
	logo,
	children,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	title: string;
	logo?: string;
	children: ReactNode;
}) {
	return (
		<HeaderDrawerShell
			open={open}
			onOpenChange={onOpenChange}
			placement="left"
			bodyClassName="min-h-0 overflow-hidden"
			header={
				<Drawer.Heading className="flex items-center gap-2 p-3">
					<IconView icon={logo} alt={title} size={24} />
					<span className="truncate text-base font-semibold">{title}</span>
				</Drawer.Heading>
			}
		>
			{children}
		</HeaderDrawerShell>
	);
}
