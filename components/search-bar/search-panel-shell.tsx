"use client";

import type { PropsWithChildren } from "react";
import { DROPDOWN_MAX_HEIGHT } from "./search-bar.utils";
import { SLIDE_DOWN_ANIMATION } from "../ui/ui.constants";

export function SearchPanelShell({ children }: PropsWithChildren) {
	return (
		<div
			className="select__popover absolute left-0 right-0 top-full z-50 mt-1.5 overscroll-auto bg-(var(--background))"
			style={{
				animation: SLIDE_DOWN_ANIMATION,
				maxHeight: DROPDOWN_MAX_HEIGHT,
			}}
		>
			{children}
		</div>
	);
}
