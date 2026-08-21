import type { Key } from "@heroui/react";
import type { LayoutConfig, NavSite, SearchEngine } from "@/types";

export interface HeaderBranding {
	name: string;
	logo: string;
}

export interface HeaderEngineState {
	value: Key | null;
	onChange: (id: Key | null) => void;
}

export interface HeaderSearchConfig {
	engines: SearchEngine[];
	defaultEngine: string;
	enableLocal: boolean;
	enableSuggestion?: boolean;
	enableTabFocus?: boolean;
	engineSelectorWidth?: number;
	placeholder: string;
	sites: Array<NavSite & { categoryId: string; categoryName: string }>;
	showEngineSelector?: boolean;
	layout?: Pick<
		LayoutConfig,
		"defaultIconPadding" | "iconBorderRadius" | "linkTarget" | "autoUseIntranet"
	>;
}

export interface HeaderSearchModel {
	config: HeaderSearchConfig;
	engineState: HeaderEngineState;
	onDrawerOpen?: () => void;
}
