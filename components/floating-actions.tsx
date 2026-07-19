"use client";
import { AiOutlineQrcode } from "react-icons/ai";
import { Button, toast } from "@heroui/react";
import Image from "next/image";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { BiBookmarkPlus } from "react-icons/bi";
import {
	hasIntranetSitesAtom,
	layoutAtom,
	navQrCodeAtom,
	navQrCodeTextAtom,
	submissionDialogOpenAtom,
} from "@/lib/store/site";
import {
	getSiteLinkModeLabel,
	getStoredSiteLinkMode,
	setStoredSiteLinkMode,
	subscribeSiteLinkMode,
	type SiteLinkMode,
} from "@/lib/client/site-link";
import { FLOATING_ACTION_TRANSITION_CLASS } from "./ui/ui.constants";

/**
 * 悬浮按钮（Jotai 订阅版）：
 * - 只订阅 qrCode / qrCodeText，避免 nav 其它字段变化牵连
 * - showTop state 由自己的 scroll 监听调度，memo 防止父级重渲染牵连
 */
export const FloatingActions = memo(function FloatingActions({
	showActions = true,
	showQrCode = true,
	showSubmission = false,
}: {
	showActions?: boolean;
	showQrCode?: boolean;
	showSubmission?: boolean;
}) {
	const qrCode = useAtomValue(navQrCodeAtom);
	const qrCodeText = useAtomValue(navQrCodeTextAtom);
	const layout = useAtomValue(layoutAtom);
	const hasIntranetSites = useAtomValue(hasIntranetSitesAtom);
	const setSubmissionOpen = useSetAtom(submissionDialogOpenAtom);
	const autoUseIntranet = layout.autoUseIntranet === true;
	const [showTop, setShowTop] = useState(false);
	const [showQrPanel, setShowQrPanel] = useState(false);
	const [supportsHover, setSupportsHover] = useState(false);
	const [siteLinkMode, setSiteLinkMode] = useState<SiteLinkMode>("public");
	const rafRef = useRef(0);
	const qrContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const onScroll = () => {
			if (rafRef.current) return;
			rafRef.current = requestAnimationFrame(() => {
				const next = window.scrollY > 300;
				// 相等性短路：避免滚动时频繁触发相同值的 setState 导致 memo 失效
				setShowTop((prev) => (prev === next ? prev : next));
				rafRef.current = 0;
			});
		};

		window.addEventListener("scroll", onScroll, { passive: true });
		onScroll();

		return () => {
			window.removeEventListener("scroll", onScroll);
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, []);

	useEffect(() => {
		const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
		const apply = (matches: boolean) => {
			setSupportsHover(matches);
			if (matches) {
				setShowQrPanel(false);
			}
		};

		apply(mq.matches);
		const handleChange = (event: MediaQueryListEvent) => apply(event.matches);
		mq.addEventListener("change", handleChange);
		return () => mq.removeEventListener("change", handleChange);
	}, []);

	useEffect(() => {
		const applyMode = () => setSiteLinkMode(getStoredSiteLinkMode());
		applyMode();
		return subscribeSiteLinkMode((mode) => setSiteLinkMode(mode));
	}, []);

	useEffect(() => {
		if (!showQrPanel) return;

		const handlePointerDown = (event: MouseEvent | TouchEvent) => {
			if (
				qrContainerRef.current &&
				!qrContainerRef.current.contains(event.target as Node)
			) {
				setShowQrPanel(false);
			}
		};

		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("touchstart", handlePointerDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("touchstart", handlePointerDown);
		};
	}, [showQrPanel]);

	const scrollToTop = useCallback(() => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	}, []);

	const toggleQrPanel = useCallback(() => {
		if (supportsHover) return;
		setShowQrPanel((prev) => !prev);
	}, [supportsHover]);

	const goToGithub = useCallback(() => {
		window.open(
			"https://github.com/dengxiwang/go-nav",
			"_blank",
			"noopener,noreferrer",
		);
	}, []);
	const toggleSiteLinkMode = useCallback(() => {
		const nextMode = siteLinkMode === "intranet" ? "public" : "intranet";
		setStoredSiteLinkMode(nextMode);
		if (nextMode === "public") {
			toast.info("已切换到公网模式");
		} else {
			toast("已切换到内网模式");
		}
	}, [siteLinkMode]);

	const qrPanelOpenClass = showQrPanel
		? "pointer-events-auto translate-x-0 opacity-100"
		: "pointer-events-none";
	const qrPanelHoverClass = supportsHover
		? "[@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:translate-x-0 -mr-2 [@media(hover:hover)]:group-hover:opacity-100"
		: "";
	const qrPanelPositionClass =
		`absolute bottom-0 right-[calc(100%+1.5rem)] z-10 translate-x-2 opacity-0 ${FLOATING_ACTION_TRANSITION_CLASS} duration-200`;

	return (
		<div className="fixed bottom-8 right-6 z-50 flex flex-col items-center gap-3">
			{showActions && <Button
				size="lg"
				isIconOnly
				aria-label="回到顶部"
				variant="tertiary"
				className={`shadow bg-(--primary-foreground) rounded-full ${FLOATING_ACTION_TRANSITION_CLASS} duration-300 [@media(hover:hover)]:hover:-translate-y-0.5 ${
					showTop
						? "pointer-events-auto opacity-100"
						: "pointer-events-none translate-y-2 opacity-0"
				}`}
				onPress={scrollToTop}
			>
				<svg
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M5 15l7-7 7 7"
					/>
				</svg>
			</Button>}

			{showActions && showQrCode && qrCode && (
				<div ref={qrContainerRef} className="group relative flex items-center">
					<div
						id="floating-actions-qr-panel"
						className={`${qrPanelPositionClass} ${qrPanelOpenClass} ${qrPanelHoverClass}`}
					>
						<div className="relative w-44 rounded-2xl bg-(--primary-foreground) p-4 text-center shadow-lg">
							<div className="mx-auto flex h-28 w-28 items-center justify-center rounded-xl bg-default p-2 dark:bg-zinc-700">
								<Image
									src={qrCode}
									alt="公众号二维码"
									width={112}
									height={112}
									loading="eager"
									className="h-full w-full rounded-lg object-cover"
								/>
							</div>

							<p className="mt-3 text-sm font-medium">关注公众号</p>

							<p className="mt-1 text-xs leading-relaxed text-muted">
								{qrCodeText ?? "扫码关注，获取更多内容"}
							</p>

							<div className="absolute -right-1.5 bottom-5 h-3 w-3 rotate-45 border-r border-t bg-(--primary-foreground)" />
						</div>
					</div>

					<Button
						size="lg"
						isIconOnly
						aria-label="关注公众号"
						aria-controls="floating-actions-qr-panel"
						aria-expanded={showQrPanel}
						variant="tertiary"
						className={`shadow bg-(--primary-foreground) rounded-full ${FLOATING_ACTION_TRANSITION_CLASS} duration-300 [@media(hover:hover)]:hover:-translate-y-0.5`}
						onPress={toggleQrPanel}
					>
						<AiOutlineQrcode />
					</Button>
				</div>
			)}

			{showActions && !autoUseIntranet && hasIntranetSites && (
				<Button
					size="lg"
					aria-label={`当前${getSiteLinkModeLabel(siteLinkMode)}模式，点击切换`}
					isIconOnly
					variant="tertiary"
					className={`shadow bg-(--primary-foreground) rounded-full ${FLOATING_ACTION_TRANSITION_CLASS} duration-300 [@media(hover:hover)]:hover:-translate-y-0.5`}
					onPress={toggleSiteLinkMode}
				>
					{siteLinkMode === "intranet" ? (
						<svg
							viewBox="0 0 24 24"
							fill="none"
							aria-hidden="true"
							className="size-5"
						>
							<circle cx="6" cy="18" r="2.2" fill="currentColor" />
							<circle cx="12" cy="6" r="2.2" fill="currentColor" />
							<circle cx="18" cy="18" r="2.2" fill="currentColor" />
							<path
								d="M7.8 16.6 10.4 8.5M13.6 8.5l2.6 8.1M8.2 17.5h7.6"
								stroke="currentColor"
								strokeWidth="1.8"
								strokeLinecap="round"
							/>
						</svg>
					) : (
						<svg
							viewBox="0 0 24 24"
							fill="none"
							aria-hidden="true"
							className="size-5"
						>
							<circle
								cx="12"
								cy="12"
								r="8.5"
								stroke="currentColor"
								strokeWidth="1.8"
							/>
							<path
								d="M3.8 12h16.4M12 3.8c2.3 2.2 3.6 5.1 3.6 8.2s-1.3 6-3.6 8.2c-2.3-2.2-3.6-5.1-3.6-8.2s1.3-6 3.6-8.2Z"
								stroke="currentColor"
								strokeWidth="1.6"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					)}
				</Button>
			)}

			{showActions && <Button
				size="lg"
				isIconOnly
				aria-label="打开项目 GitHub"
				variant="tertiary"
				className={`shadow bg-(--primary-foreground) rounded-full ${FLOATING_ACTION_TRANSITION_CLASS} duration-300 [@media(hover:hover)]:hover:-translate-y-0.5`}
				onPress={goToGithub}
			>
				<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M12 1.25a10.75 10.75 0 0 0-3.4 20.95c.54.1.73-.23.73-.52v-1.84c-2.98.64-3.6-1.28-3.6-1.28-.49-1.23-1.18-1.55-1.18-1.55-.96-.65.07-.64.07-.64 1.06.07 1.62 1.08 1.62 1.08.95 1.61 2.48 1.15 3.08.88.09-.68.37-1.15.67-1.42-2.38-.27-4.88-1.18-4.88-5.28 0-1.17.42-2.12 1.1-2.87-.11-.27-.48-1.37.11-2.85 0 0 .9-.29 2.95 1.09a10.56 10.56 0 0 1 5.38 0c2.04-1.38 2.94-1.09 2.94-1.09.59 1.48.22 2.58.11 2.85.69.75 1.1 1.7 1.1 2.87 0 4.11-2.5 5-4.89 5.27.38.33.72.96.72 1.93v2.86c0 .29.19.63.74.52A10.75 10.75 0 0 0 12 1.25Z" />
				</svg>
			</Button>}

			{showSubmission && (
				<Button
					size="lg"
					isIconOnly
					aria-label="我要投稿"
					variant="primary"
					className={`rounded-full shadow-lg ${FLOATING_ACTION_TRANSITION_CLASS} duration-300 [@media(hover:hover)]:hover:-translate-y-0.5`}
					onPress={() => setSubmissionOpen(true)}
				>
					<BiBookmarkPlus className="size-5" />
				</Button>
			)}
		</div>
	);
});
