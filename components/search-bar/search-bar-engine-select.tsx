"use client";

import type { Key } from "@heroui/react";
import { Label, ListBox, Select } from "@heroui/react";
import type { SearchEngine } from "@/types";
import { getIconImageSrc } from "@/lib/icon";
import { resolveEngineSelectorWidth } from "@/lib/search-config";

export function SearchBarEngineSelect({
	engineId,
	engineOptions,
	engineSelectorWidth,
	onEngineChange,
}: {
	engineId: Key | null;
	engineOptions: SearchEngine[];
	engineSelectorWidth?: number;
	onEngineChange: (id: Key | null) => void;
}) {
	const selectedEngine = engineOptions.find(
		(engine) => engine.id === String(engineId),
	);

	return (
		<div
			className="hidden shrink-0 min-[480px]:block"
			style={{ width: resolveEngineSelectorWidth(engineSelectorWidth) }}
		>
			<Select
				aria-label="选择搜索引擎"
				className="h-9 w-full"
				value={engineId}
				onChange={(value) => onEngineChange(value)}
			>
				<Label className="sr-only">搜索引擎</Label>
				<Select.Trigger className="overflow-hidden">
					<Select.Value className="min-w-0 overflow-hidden">
						{({ defaultChildren, isPlaceholder }) =>
							isPlaceholder || !selectedEngine ? (
								defaultChildren
							) : (
								<EngineContent engine={selectedEngine} />
							)
						}
					</Select.Value>
					<Select.Indicator />
				</Select.Trigger>
				<Select.Popover>
					<ListBox>
						{engineOptions.map((engine) => {
							return (
								<ListBox.Item
									key={engine.id}
									id={engine.id}
									textValue={engine.name}
									className="data-[selected=true]:bg-accent-soft data-[selected=true]:font-medium data-[selected=true]:text-accent-soft-foreground"
								>
									<EngineContent engine={engine} />
								</ListBox.Item>
							);
						})}
					</ListBox>
				</Select.Popover>
			</Select>
		</div>
	);
}

function EngineContent({ engine }: { engine: SearchEngine }) {
	const iconSrc = getIconImageSrc(engine.icon);

	return (
		<span className="flex w-full min-w-0 items-center gap-2">
			{engine.icon ? (
				iconSrc ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={iconSrc}
						alt=""
						width={16}
						height={16}
						className="inline-block h-4 w-4 shrink-0 rounded object-contain"
					/>
				) : (
					<span aria-hidden className="shrink-0 text-center">
						{engine.icon}
					</span>
				)
			) : null}
			<span className="min-w-0 flex-1 truncate">{engine.name}</span>
		</span>
	);
}
