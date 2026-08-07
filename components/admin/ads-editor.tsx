"use client";

import {
	Button,
	Input,
	Label,
	ListBox,
	Modal,
	NumberField,
	Select,
	Separator,
	Table,
	Tabs,
	TextField,
	ToggleButton,
	ToggleButtonGroup,
	type Key,
} from "@heroui/react";
import { useAtom } from "jotai";
import { useRef, useState } from "react";
import {
	BiChevronDown,
	BiChevronUp,
	BiImage,
	BiPlus,
	BiTransferAlt,
	BiTrash,
} from "react-icons/bi";
import type { AdConfig, AdDisplayPosition, NavConfig } from "@/types";
import {
	AD_AUTOPLAY_INTERVAL_OPTIONS,
	DEFAULT_HOME_AD_ASPECT_RATIO,
	DEFAULT_SIDEBAR_AD_ASPECT_RATIO,
	resolveAdVisibleCount,
	resolveAdDisplayPosition,
	resolveAdPlacement,
	resolveHomeAdsAutoplayInterval,
	resolveHomeAdsEnabled,
	resolveHomeAdsGap,
	resolveHomeAdsVisibleCount,
	resolveSidebarAdsAutoplayInterval,
	resolveSidebarAdsEnabled,
} from "@/lib/ad-display";
import { navAtom } from "@/lib/store/admin";
import { AdminSwitch } from "./admin-switch";
import { IconPicker } from "./icon-picker";

const RATIO_PRESETS = ["16/9", "4/3", "1/1", "2/1", "3/1"];
const AUTOPLAY_INTERVAL_LABELS: Record<number, string> = {
	3000: "较快（3 秒）",
	5000: "标准（5 秒）",
	8000: "较慢（8 秒）",
	10000: "很慢（10 秒）",
};

interface AdEntry {
	ad: AdConfig;
	index: number;
}

function placementName(placement: AdDisplayPosition) {
	return placement === "home-top" ? "主页广告" : "侧边广告";
}

export function AdsEditor() {
	const [value, setValue] = useAtom(navAtom);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const onChange = (next: NavConfig) => setValue(next);
	const legacyPlacement = value.adsDisplayPosition;

	const entriesFor = (placement: AdDisplayPosition): AdEntry[] =>
		value.ads.flatMap((ad, index) =>
			resolveAdPlacement(ad, legacyPlacement) === placement
				? [{ ad, index }]
				: [],
		);
	const homeEntries = entriesFor("home-top");
	const sidebarEntries = entriesFor("sidebar");

	const legacyGlobalPlacement = resolveAdDisplayPosition(legacyPlacement);
	const homeRatio =
		value.homeAdsAspectRatio ??
		(legacyGlobalPlacement === "home-top" ? value.adsAspectRatio : undefined) ??
		DEFAULT_HOME_AD_ASPECT_RATIO;
	const sidebarRatio =
		value.sidebarAdsAspectRatio ??
		(legacyGlobalPlacement === "sidebar" ? value.adsAspectRatio : undefined) ??
		DEFAULT_SIDEBAR_AD_ASPECT_RATIO;
	const homeVisibleCount = resolveHomeAdsVisibleCount(value);
	const homeGap = resolveHomeAdsGap(value.homeAdsGap);
	const homeAutoplayInterval = resolveHomeAdsAutoplayInterval(value);
	const sidebarAutoplayInterval = resolveSidebarAdsAutoplayInterval(value);

	const setAds = (ads: AdConfig[]) => onChange({ ...value, ads });

	const updateAd = (id: string, next: AdConfig) => {
		const index = value.ads.findIndex((ad) => ad.id === id);
		if (index < 0) return;
		const copy = value.ads.slice();
		copy[index] = next;
		setAds(copy);
	};

	const addAd = (placement: AdDisplayPosition) => {
		setAds([
			...value.ads,
			{
				id: `ad-${Date.now()}`,
				title: placement === "home-top" ? "新主页广告" : "新侧边广告",
				description: "",
				image: "",
				url: "https://",
				enabled: true,
				placement,
			},
		]);
	};

	const moveAd = (
		id: string,
		placement: AdDisplayPosition,
		direction: "up" | "down",
	) => {
		const placementIndexes = value.ads.flatMap((ad, index) =>
			resolveAdPlacement(ad, legacyPlacement) === placement ? [index] : [],
		);
		const sourceIndex = value.ads.findIndex((ad) => ad.id === id);
		const position = placementIndexes.indexOf(sourceIndex);
		const targetPosition = direction === "up" ? position - 1 : position + 1;
		if (position < 0 || targetPosition < 0 || targetPosition >= placementIndexes.length) {
			return;
		}
		const targetIndex = placementIndexes[targetPosition];
		const copy = value.ads.slice();
		[copy[sourceIndex], copy[targetIndex]] = [copy[targetIndex], copy[sourceIndex]];
		setAds(copy);
	};

	const setRatio = (placement: AdDisplayPosition, ratio: string | undefined) => {
		onChange(
			placement === "home-top"
				? { ...value, homeAdsAspectRatio: ratio }
				: { ...value, sidebarAdsAspectRatio: ratio },
		);
	};

	const setVisibleCount = (next: number) => {
		onChange({
			...value,
			homeAdsVisibleCount: resolveAdVisibleCount(next),
		});
	};
	const setHomeGap = (homeAdsGap: number) => {
		onChange({ ...value, homeAdsGap: resolveHomeAdsGap(homeAdsGap) });
	};

	const deletingAd = value.ads.find((ad) => ad.id === deleteConfirm);

	return (
		<div className="flex flex-col gap-4">
			<Tabs defaultSelectedKey="home-top" className="w-full">
				<Tabs.ListContainer>
					<Tabs.List aria-label="广告位置" className="w-fit">
						<Tabs.Tab id="home-top">
							主页广告
							<span className="ml-1 rounded-full bg-default/10 px-1.5 text-xs">
								{homeEntries.length}
							</span>
							<Tabs.Indicator />
						</Tabs.Tab>
						<Tabs.Tab id="sidebar">
							侧边广告
							<span className="ml-1 rounded-full bg-default/10 px-1.5 text-xs">
								{sidebarEntries.length}
							</span>
							<Tabs.Indicator />
						</Tabs.Tab>
					</Tabs.List>
				</Tabs.ListContainer>

				<Tabs.Panel className="px-0" id="home-top">
					<AdPlacementPanel
						placement="home-top"
						entries={homeEntries}
						isPlacementEnabled={resolveHomeAdsEnabled(value)}
						onPlacementEnabledChange={(homeAdsEnabled) =>
							onChange({ ...value, homeAdsEnabled })
						}
						autoplayInterval={homeAutoplayInterval}
						onAutoplayIntervalChange={(homeAdsAutoplayInterval) =>
							onChange({ ...value, homeAdsAutoplayInterval })
						}
						ratio={homeRatio}
						gap={homeGap}
						visibleCount={homeVisibleCount}
						onRatioChange={(ratio) => setRatio("home-top", ratio)}
						onGapChange={setHomeGap}
						onVisibleCountChange={setVisibleCount}
						onAdd={() => addAd("home-top")}
						onChange={(ad) => updateAd(ad.id, ad)}
						onDelete={setDeleteConfirm}
						onMove={(id, direction) => moveAd(id, "home-top", direction)}
						onMovePlacement={(ad) =>
							updateAd(ad.id, { ...ad, placement: "sidebar" })
						}
					/>
				</Tabs.Panel>

				<Tabs.Panel className="px-0" id="sidebar">
					<AdPlacementPanel
						placement="sidebar"
						entries={sidebarEntries}
						isPlacementEnabled={resolveSidebarAdsEnabled(value)}
						onPlacementEnabledChange={(sidebarAdsEnabled) =>
							onChange({ ...value, sidebarAdsEnabled })
						}
						autoplayInterval={sidebarAutoplayInterval}
						onAutoplayIntervalChange={(sidebarAdsAutoplayInterval) =>
							onChange({ ...value, sidebarAdsAutoplayInterval })
						}
						ratio={sidebarRatio}
						onRatioChange={(ratio) => setRatio("sidebar", ratio)}
						onAdd={() => addAd("sidebar")}
						onChange={(ad) => updateAd(ad.id, ad)}
						onDelete={setDeleteConfirm}
						onMove={(id, direction) => moveAd(id, "sidebar", direction)}
						onMovePlacement={(ad) =>
							updateAd(ad.id, { ...ad, placement: "home-top" })
						}
					/>
				</Tabs.Panel>
			</Tabs>

				<Modal.Backdrop
					isOpen={deleteConfirm !== null}
					onOpenChange={(open) => !open && setDeleteConfirm(null)}
				>
					<Modal.Container>
						<Modal.Dialog>
							<Modal.Header>
								<Modal.Heading>确认删除广告</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<p className="text-sm text-gray-600 dark:text-neutral-300">
									删除“{deletingAd?.title ?? "该广告"}”后无法恢复。
								</p>
							</Modal.Body>
							<Modal.Footer>
								<Button variant="outline" onPress={() => setDeleteConfirm(null)}>
									取消
								</Button>
								<Button
									variant="danger"
									onPress={() => {
										if (deleteConfirm) {
											setAds(value.ads.filter((ad) => ad.id !== deleteConfirm));
											setDeleteConfirm(null);
										}
									}}
								>
									确认删除
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
		</div>
	);
}

function AdPlacementPanel({
	placement,
	entries,
	isPlacementEnabled,
	onPlacementEnabledChange,
	autoplayInterval,
	onAutoplayIntervalChange,
	ratio,
	gap,
	visibleCount,
	onRatioChange,
	onGapChange,
	onVisibleCountChange,
	onAdd,
	onChange,
	onDelete,
	onMove,
	onMovePlacement,
}: {
	placement: AdDisplayPosition;
	entries: AdEntry[];
	isPlacementEnabled: boolean;
	onPlacementEnabledChange: (isEnabled: boolean) => void;
	autoplayInterval: number;
	onAutoplayIntervalChange: (interval: number) => void;
	ratio: string;
	gap?: number;
	visibleCount?: number;
	onRatioChange: (ratio: string | undefined) => void;
	onGapChange?: (gap: number) => void;
	onVisibleCountChange?: (count: number) => void;
	onAdd: () => void;
	onChange: (ad: AdConfig) => void;
	onDelete: (id: string) => void;
	onMove: (id: string, direction: "up" | "down") => void;
	onMovePlacement: (ad: AdConfig) => void;
}) {
	const enabledCount = entries.filter(({ ad }) => ad.enabled).length;
	const actualVisibleCount = Math.min(visibleCount ?? 1, enabledCount);

	return (
		<div className="flex flex-col gap-4">
			<section className="flex flex-col gap-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h3 className="text-sm font-semibold">
							{placementName(placement)}展示参数
						</h3>
						<p className="mt-1 text-xs text-default-500">
							仅控制{placementName(placement)}的显示和轮播效果。
						</p>
					</div>
					<div className="shrink-0">
						<AdminSwitch
							isSelected={isPlacementEnabled}
							onChange={onPlacementEnabledChange}
							ariaLabel={`开启${placementName(placement)}`}
						>
							<span className="text-sm">
								{isPlacementEnabled ? "已开启" : "已关闭"}
							</span>
						</AdminSwitch>
					</div>
				</div>

				<Separator />

				<div
					className={
						placement === "home-top"
							? "grid items-start gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-3"
							: "grid items-start gap-x-4 gap-y-3 md:grid-cols-2"
					}
				>
					<div className="min-w-0">
						<Select
							fullWidth
							variant="secondary"
							value={String(autoplayInterval)}
							onChange={(key) => {
								if (key != null) onAutoplayIntervalChange(Number(key));
							}}
						>
							<Label>切换速度</Label>
							<Select.Trigger>
								<Select.Value />
								<Select.Indicator />
							</Select.Trigger>
							<Select.Popover>
								<ListBox>
									{AD_AUTOPLAY_INTERVAL_OPTIONS.map((interval) => (
										<ListBox.Item
											key={interval}
											id={String(interval)}
											textValue={AUTOPLAY_INTERVAL_LABELS[interval]}
										>
											{AUTOPLAY_INTERVAL_LABELS[interval]}
											<ListBox.ItemIndicator />
										</ListBox.Item>
									))}
								</ListBox>
							</Select.Popover>
						</Select>
					</div>
					{placement === "home-top" &&
					visibleCount != null &&
					onVisibleCountChange &&
					gap != null &&
						onGapChange ? (
						<>
							<div className="min-w-0">
								<NumberField
									fullWidth
									variant="secondary"
									value={visibleCount}
									minValue={1}
									step={1}
									formatOptions={{
										maximumFractionDigits: 0,
										useGrouping: false,
									}}
									onChange={(next) => {
										if (next != null) onVisibleCountChange(next);
									}}
								>
									<Label>同时展示数量</Label>
									<NumberField.Group>
										<NumberField.DecrementButton />
										<NumberField.Input />
										<NumberField.IncrementButton />
									</NumberField.Group>
								</NumberField>
							</div>
							<div className="min-w-0">
								<NumberField
									fullWidth
									variant="secondary"
									value={gap}
									minValue={0}
									maxValue={48}
									step={1}
									formatOptions={{
										maximumFractionDigits: 0,
										useGrouping: false,
									}}
									onChange={onGapChange}
								>
									<Label>广告间距（px）</Label>
									<NumberField.Group>
										<NumberField.DecrementButton />
										<NumberField.Input />
										<NumberField.IncrementButton />
									</NumberField.Group>
								</NumberField>
							</div>
						</>
					) : null}
					<div
						className={
							placement === "home-top" ? "md:col-span-2 xl:col-span-3" : ""
						}
					>
						<RatioField
							label={
								placement === "home-top" ? "顶部广告比例" : "侧边广告比例"
							}
							value={ratio}
							onChange={onRatioChange}
						/>
					</div>
				</div>

				{placement === "home-top" && visibleCount != null ? (
					<p className="text-xs text-default-500">
						最多展示 {visibleCount} 个，当前实际展示 {actualVisibleCount}
						个；广告不足时按实际数量展示，每次切换 1 个。
					</p>
				) : null}
			</section>

			<div className="flex items-center justify-between gap-3">
				<div>
					<h3 className="text-sm font-semibold">
						{placementName(placement)}列表
					</h3>
					<p className="mt-1 text-xs text-default-500">共 {entries.length} 条广告</p>
				</div>
				<Button variant="primary" size="sm" onPress={onAdd}>
					<BiPlus data-icon="inline-start" />
					新增{placementName(placement)}
				</Button>
			</div>

			{entries.length === 0 ? (
				<div className="flex h-44 items-center justify-center rounded-xl border-2 border-dashed border-default/60">
					<div className="text-center">
						<BiImage className="mx-auto mb-2 size-8 text-default-400" />
						<p className="text-sm text-default-500">
							暂无{placementName(placement)}，点击右上角新增
						</p>
					</div>
				</div>
			) : (
				<Table variant="secondary" aria-label={`${placementName(placement)}列表`}>
					<Table.ScrollContainer>
						<Table.Content aria-label={`${placementName(placement)}列表`}>
							<Table.Header>
								<Table.Column className="w-24">图片</Table.Column>
								<Table.Column isRowHeader className="w-40">标题</Table.Column>
								<Table.Column className="w-48">描述</Table.Column>
								<Table.Column className="w-52">链接</Table.Column>
								<Table.Column className="w-20">启用</Table.Column>
								<Table.Column className="w-44">操作</Table.Column>
							</Table.Header>
							<Table.Body>
								{entries.map(({ ad }, index) => (
									<AdRow
										key={ad.id}
										ad={ad}
										placement={placement}
										isFirst={index === 0}
										isLast={index === entries.length - 1}
										onChange={onChange}
										onDelete={() => onDelete(ad.id)}
										onMoveUp={() => onMove(ad.id, "up")}
										onMoveDown={() => onMove(ad.id, "down")}
										onMovePlacement={() => onMovePlacement(ad)}
									/>
								))}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
			)}
		</div>
	);
}

function RatioField({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string | undefined) => void;
}) {
	const isCustom = !RATIO_PRESETS.includes(value);
	const selectedKeys = new Set<Key>(isCustom ? [] : [value]);
	return (
		<div className="flex flex-col gap-1.5">
			<Label className="text-sm font-medium">{label}</Label>
			<div className="flex flex-wrap items-center gap-2">
				<ToggleButtonGroup
					isDetached
					size="sm"
					selectionMode="single"
					selectedKeys={selectedKeys}
					disallowEmptySelection
					aria-label={label}
					onSelectionChange={(keys) => {
						const selected = [...keys][0];
						if (selected != null) onChange(String(selected));
					}}
				>
					{RATIO_PRESETS.map((ratio) => (
						<ToggleButton
							key={ratio}
							id={ratio}
							aria-label={`${label} ${ratio}`}
							className="cursor-pointer border border-default bg-transparent text-xs data-[selected=true]:border-(--primary) data-[selected=true]:bg-(--primary) data-[selected=true]:text-(--primary-foreground) data-[selected=true]:shadow-sm"
						>
							{ratio.replace("/", " : ")}
						</ToggleButton>
					))}
				</ToggleButtonGroup>
				<TextField
					className="w-28"
					value={isCustom ? value : ""}
					onChange={(next) => onChange(next.trim() || undefined)}
				>
					<Label className="sr-only">{label}自定义值</Label>
					<Input placeholder="如 21/9" />
				</TextField>
			</div>
		</div>
	);
}

function AdRow({
	ad,
	placement,
	isFirst,
	isLast,
	onChange,
	onDelete,
	onMoveUp,
	onMoveDown,
	onMovePlacement,
}: {
	ad: AdConfig;
	placement: AdDisplayPosition;
	isFirst: boolean;
	isLast: boolean;
	onChange: (ad: AdConfig) => void;
	onDelete: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onMovePlacement: () => void;
}) {
	const titleRef = useRef<HTMLInputElement>(null);
	const descriptionRef = useRef<HTMLInputElement>(null);
	const urlRef = useRef<HTMLInputElement>(null);
	const patch = (next: Partial<AdConfig>) =>
		onChange({
			...ad,
			title: titleRef.current?.value ?? ad.title,
			description: descriptionRef.current?.value ?? ad.description ?? "",
			url: urlRef.current?.value ?? ad.url,
			...next,
		});

	const commitText = (field: "title" | "description" | "url", next: string) => {
		if (field === "description") {
			if ((ad.description ?? "") !== next) patch({ description: next });
			return;
		}
		if (ad[field] !== next) {
			patch({ [field]: next } as Pick<AdConfig, typeof field>);
		}
	};

	return (
		<Table.Row id={ad.id}>
			<Table.Cell>
				<div className="flex w-max items-center gap-2">
					<IconPicker
						value={ad.image ?? ""}
						uploadPrefix={placement === "home-top" ? "home-ad" : "sidebar-ad"}
						onChange={(image) => patch({ image })}
					/>
				</div>
			</Table.Cell>
			<Table.Cell>
				<Input
					ref={titleRef}
					aria-label="标题"
					defaultValue={ad.title}
					onBlur={(event) => commitText("title", event.currentTarget.value)}
				/>
			</Table.Cell>
			<Table.Cell>
				<Input
					ref={descriptionRef}
					aria-label="描述"
					defaultValue={ad.description ?? ""}
					placeholder="可选"
					className="w-full min-w-52"
					onBlur={(event) =>
						commitText("description", event.currentTarget.value)
					}
				/>
			</Table.Cell>
			<Table.Cell>
				<Input
					ref={urlRef}
					aria-label="链接"
					defaultValue={ad.url}
					placeholder="https://"
					className="w-full min-w-52"
					onBlur={(event) => commitText("url", event.currentTarget.value)}
				/>
			</Table.Cell>
			<Table.Cell>
				<AdminSwitch
					isSelected={ad.enabled}
					onChange={(enabled) => patch({ enabled })}
					ariaLabel="启用"
				/>
			</Table.Cell>
			<Table.Cell>
				<div className="flex items-center gap-1">
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						aria-label="上移"
						isDisabled={isFirst}
						onPress={onMoveUp}
					>
						<BiChevronUp />
					</Button>
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						aria-label="下移"
						isDisabled={isLast}
						onPress={onMoveDown}
					>
						<BiChevronDown />
					</Button>
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						aria-label={placement === "home-top" ? "移至侧边广告" : "移至主页广告"}
						onPress={onMovePlacement}
					>
						<BiTransferAlt />
					</Button>
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						className="text-danger"
						aria-label="删除"
						onPress={onDelete}
					>
						<BiTrash />
					</Button>
				</div>
			</Table.Cell>
		</Table.Row>
	);
}
