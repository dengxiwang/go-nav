"use client";
import { AiOutlineQrcode } from "react-icons/ai";
import { Button } from "@heroui/react";
import Image from "next/image";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { navQrCodeAtom, navQrCodeTextAtom } from "@/lib/store/site";

/**
 * 悬浮按钮（Jotai 订阅版）：
 * - 只订阅 qrCode / qrCodeText，避免 nav 其它字段变化牵连
 * - showTop state 由自己的 scroll 监听调度，memo 防止父级重渲染牵连
 */
export const FloatingActions = memo(function FloatingActions({
	showQrCode = true,
}: {
	showQrCode?: boolean;
}) {
	const qrCode = useAtomValue(navQrCodeAtom);
	const qrCodeText = useAtomValue(navQrCodeTextAtom);
	const [showTop, setShowTop] = useState(false);
	const [isQrCodeOpen, setIsQrCodeOpen] = useState(false);
	const qrCodeRef = useRef<HTMLDivElement>(null);
	const rafRef = useRef(0);

	useEffect(() => {
		const onScroll = () => {
			if (rafRef.current) return;
			rafRef.current = requestAnimationFrame(() => {
				const next = window.scrollY > 300;
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
		const handleClickOutside = (event: MouseEvent) => {
			if (qrCodeRef.current && !qrCodeRef.current.contains(event.target as Node)) {
				setIsQrCodeOpen(false);
			}
		};

		if (isQrCodeOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isQrCodeOpen]);

	const scrollToTop = useCallback(() => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	}, []);

	const toggleQrCode = useCallback(() => {
		setIsQrCodeOpen((prev) => !prev);
	}, []);

	return (
		<div className="fixed bottom-8 right-6 z-50 flex flex-col items-center gap-3">
			<Button
				size="lg"
				isIconOnly
				aria-label="回到顶部"
				variant="tertiary"
				className={`shadow bg-(--primary-foreground) rounded-full transition-all duration-300 hover:-translate-y-0.5 ${
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
			</Button>

			{showQrCode && qrCode && (
				<div ref={qrCodeRef} className="group relative flex items-center">
					<div className={`absolute bottom-0 right-12 transition-all duration-200 ${
						isQrCodeOpen 
							? "pointer-events-auto translate-x-0 opacity-100" 
							: "pointer-events-none translate-x-2 opacity-0 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100"
					}`}>
						<div className="relative w-44 rounded-2xl bg-(--primary-foreground) p-4 text-center shadow-lg">
							<div className="mx-auto flex h-28 w-28 items-center justify-center rounded-xl bg-default dark:bg-zinc-700 p-2">
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
						variant="tertiary"
						className="shadow bg-(--primary-foreground) rounded-full transition-all duration-300 hover:-translate-y-0.5"
						onPress={toggleQrCode}
					>
						<AiOutlineQrcode />
					</Button>
				</div>
			)}
		</div>
	);
});
