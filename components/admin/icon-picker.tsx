"use client";

import {
	Button,
	ColorArea,
	ColorPicker,
	ColorSlider,
	ColorSwatch,
	ColorField,
	Input,
	InputGroup,
	Label,
	parseColor,
	TextField,
	toast,
} from "@heroui/react";
import { useAtomValue } from "jotai";
import type React from "react";
import { useRef, useState } from "react";
import { getIconImageSrc } from "@/lib/icon";
import { uploadImageWithCompression } from "@/lib/client/image-upload";
import { isHtmlDeployment } from "@/lib/client/html-admin";
import { navAtom } from "@/lib/store/admin";
import { resolveConfiguredValue, toPx } from "../site-icon";

const TRANSPARENT_BG_COLOR = "rgba(255, 255, 255, 0)";
const WHITE_BG_COLOR = "#ffffff";
const DEFAULT_BG_COLOR = TRANSPARENT_BG_COLOR;

function parseSafeColor(value: string | undefined) {
	try {
		return parseColor(value?.trim() || DEFAULT_BG_COLOR);
	} catch {
		return parseColor(DEFAULT_BG_COLOR);
	}
}

/**
 * 图标输入框：支持直接输入 URL / emoji，或点击按钮上传图片。
 * 上传成功后自动填入 URL 到字段。
 */
export function IconPicker({
	value,
	onChange,
	isDisabled = false,
	isInline = false,
	bgColor,
	onBgColorChange,
	iconPadding,
	defaultIconPadding,
	onIconPaddingChange,
	placeholder = "URL / emoji / 留空",
	uploadPrefix = "icon",
}: {
	value: string | undefined;
	onChange: (v: string) => void;
	isDisabled?: boolean;
	/** 强制将预览、输入框和上传按钮保持在同一行。 */
	isInline?: boolean;
	bgColor?: string;
	onBgColorChange?: (v: string) => void;
	iconPadding?: string;
	defaultIconPadding?: string;
	onIconPaddingChange?: (v: string) => void;
	placeholder?: string;
	/** 上传文件保存时使用的语义化英文前缀。 */
	uploadPrefix?: string;
}) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const nav = useAtomValue(navAtom);
	const resolvedIconPadding = resolveConfiguredValue(
		iconPadding,
		defaultIconPadding,
	);
	const parsedIconPadding = resolvedIconPadding
		? Number.parseFloat(resolvedIconPadding)
		: undefined;
	const pickerColor = parseSafeColor(bgColor);

	const uploadFile = async (f: File) => {
		if (isDisabled) return;
		setUploading(true);
		try {
			const url = await uploadImageWithCompression(f, {
				maxEdge: 512,
				quality: 0.82,
				compress: nav.imageUpload?.compress === true,
				forceWebp: nav.imageUpload?.convertToWebp === true,
				fileNamePrefix: uploadPrefix,
			});
			onChange(url);
		} catch (e) {
			toast.danger((e as Error).message || "图标上传失败");
		} finally {
			setUploading(false);
		}
	};

	const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.[0];
		e.target.value = ""; // reset so same file can be reselected
		if (!f) return;
		await uploadFile(f);
	};

	const onPasteImage = async (e: React.ClipboardEvent<HTMLInputElement>) => {
		if (isDisabled) return;
		const file = e.clipboardData.items
			? Array.from(e.clipboardData.items)
					.find(
						(item) => item.kind === "file" && item.type.startsWith("image/"),
					)
					?.getAsFile()
			: null;
		if (!file) return;
		e.preventDefault();
		await uploadFile(file);
	};

	const preview = (() => {
		if (!value) return null;
			const imageSrc = getIconImageSrc(value);
			if (!imageSrc)
				return <span className="text-xl leading-none text-center">{value}</span>;
			return (
				// 使用普通 img 渲染上传/外部图标预览，避免 next/image 对来源域名和尺寸策略的限制。
				// eslint-disable-next-line @next/next/no-img-element
				<img src={imageSrc} alt="" className="h-6 w-6 rounded object-contain" />
			);
		})();

	return (
		<div className="flex flex-col gap-1">
			<div
				className={`flex items-center gap-2 ${isInline ? "flex-nowrap" : "flex-wrap"}`}
			>
				<div
					className="flex h-9 w-9 shrink-0 items-center justify-center rounded border"
					style={{
						backgroundColor: bgColor || undefined,
						padding: toPx(resolvedIconPadding) || undefined,
					}}
				>
					{preview ?? <span className="text-xs text-muted">空</span>}
				</div>
				<TextField
					className={isInline ? "min-w-0 flex-1" : undefined}
					isDisabled={isDisabled}
					value={value ?? ""}
					onChange={onChange}
				>
					<Label className="sr-only">图标</Label>
					<Input
						placeholder={placeholder}
						onPaste={isHtmlDeployment ? undefined : onPasteImage}
					/>
				</TextField>
				{!isHtmlDeployment ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						isDisabled={isDisabled || uploading}
						onPress={() => fileRef.current?.click()}
					>
						{uploading ? "上传中..." : "上传"}
					</Button>
				) : null}
				{onIconPaddingChange && (
					<TextField
						className="flex flex-row items-center"
						isDisabled={isDisabled}
						value={parsedIconPadding == null ? "" : String(parsedIconPadding)}
						onChange={onIconPaddingChange}
					>
						<InputGroup>
							<InputGroup.Input type="number" min={0} max={20} step={0.5} />
						</InputGroup>
					</TextField>
				)}
				{onBgColorChange && (
					<ColorPicker
						value={pickerColor}
						onChange={(c) => onBgColorChange(c.toString("css"))}
					>
						<ColorPicker.Trigger>
							<ColorSwatch color={pickerColor} size="sm" />
						</ColorPicker.Trigger>
						<ColorPicker.Popover className="gap-2">
							<div className="grid grid-cols-2 gap-2 px-1 *:w-full!">
								<Button
									type="button"
									size="sm"
									variant="secondary"
									onPress={() => onBgColorChange(TRANSPARENT_BG_COLOR)}
								>
									透明
								</Button>
								<Button
									type="button"
									size="sm"
									variant="secondary"
									onPress={() => onBgColorChange(WHITE_BG_COLOR)}
								>
									白色
								</Button>
							</div>
							<ColorArea
								aria-label="Color area"
								className="max-w-full"
								colorSpace="hsb"
								xChannel="saturation"
								yChannel="brightness"
							>
								<ColorArea.Thumb />
							</ColorArea>
							<ColorSlider
								channel="hue"
								className="gap-1 px-1"
								colorSpace="hsb"
							>
								<ColorSlider.Track>
									<ColorSlider.Thumb />
								</ColorSlider.Track>
							</ColorSlider>
							<ColorSlider
								aria-label="透明度"
								channel="alpha"
								className="gap-1 px-1"
							>
								<Label className="text-xs text-muted">透明度</Label>
								<ColorSlider.Track>
									<ColorSlider.Thumb />
								</ColorSlider.Track>
							</ColorSlider>
							<ColorField aria-label="背景色">
								<ColorField.Group variant="secondary">
									<ColorField.Prefix>
										<ColorSwatch color={pickerColor} size="xs" />
									</ColorField.Prefix>
									<ColorField.Input />
								</ColorField.Group>
							</ColorField>
						</ColorPicker.Popover>
					</ColorPicker>
				)}
				{!isHtmlDeployment ? (
					<input
						ref={fileRef}
						type="file"
						accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/x-icon,.ico,.svg"
						className="hidden"
						disabled={isDisabled}
						onChange={onFileChosen}
					/>
				) : null}
			</div>
		</div>
	);
}
