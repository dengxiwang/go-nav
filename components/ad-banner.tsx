"use client";

import {
	memo,
	useCallback,
	useRef,
	useState,
	type CSSProperties,
	type RefObject,
} from "react";
import { BiChevronLeft, BiChevronRight } from "react-icons/bi";
import { Autoplay, Keyboard } from "swiper/modules";
import { Swiper, SwiperSlide, type SwiperClass } from "swiper/react";
import type { AdConfig, AdDisplayPosition, CardStyle } from "@/types";
import { withAuthorBaiduTracking } from "@/lib/external-url";
import {
	DEFAULT_AD_AUTOPLAY_INTERVAL,
	DEFAULT_HOME_AD_GAP,
	resolveAdVisibleCount,
} from "@/lib/ad-display";
import {
	CARD_TRANSITION_CLASS,
	COMPACT_CARD_SURFACE_CLASS,
	FOCUS_RING_CLASS,
	PREVIEW_CARD_SURFACE_CLASS,
} from "./ui/ui.constants";

interface AdBannerProps {
	ads: AdConfig[];
	aspectRatio?: string;
	visibleCount?: number;
	autoplayInterval?: number;
	gap?: number;
	placement?: AdDisplayPosition;
	cardStyle?: CardStyle;
}

interface AdCardProps {
	ad: AdConfig;
	aspectRatio: string;
	cardSurfaceClass: string;
	imageRadiusClass: string;
	hasHoverShadow: boolean;
	isAccessible: boolean;
	isEager: boolean;
	originalIndex: number;
	total: number;
}

function AdCard({
	ad,
	aspectRatio,
	cardSurfaceClass,
	imageRadiusClass,
	hasHoverShadow,
	isAccessible,
	isEager,
	originalIndex,
	total,
}: AdCardProps) {
	return (
		<a
			href={withAuthorBaiduTracking(ad.url)}
			target="_blank"
			rel="noopener noreferrer"
			tabIndex={isAccessible ? 0 : -1}
			aria-hidden={isAccessible ? undefined : true}
			aria-label={`${ad.title}，广告 ${originalIndex + 1}/${total}`}
			className={`block h-full p-1 outline-none ${cardSurfaceClass} ${CARD_TRANSITION_CLASS} ${FOCUS_RING_CLASS} ${
				hasHoverShadow
					? "[@media(hover:hover)]:hover:shadow-[0_12px_28px_rgba(15,23,42,0.11)]"
					: ""
			}`}
		>
			<div
				className={`overflow-hidden ${imageRadiusClass} bg-surface-secondary`}
				style={{ aspectRatio }}
			>
				{ad.image ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={ad.image}
						alt={ad.title}
						className="h-full w-full object-cover"
						loading={isEager ? "eager" : "lazy"}
						decoding="async"
					/>
				) : (
					<div className="flex h-full w-full flex-col items-center justify-center bg-linear-to-br from-primary/12 to-primary/4 px-3 text-center">
						<span className="text-3xl" aria-hidden="true">
							📢
						</span>
						<span className="mt-2 line-clamp-1 text-xs font-semibold">
							{ad.title}
						</span>
						{ad.description ? (
							<span className="mt-1 line-clamp-2 text-[10px]! text-muted">
								{ad.description}
							</span>
						) : null}
					</div>
				)}
			</div>
		</a>
	);
}

function slideToOriginalAd(
	swiper: SwiperClass,
	originalIndex: number,
) {
	swiper.slideToLoop(originalIndex);
}

function AdCarouselControls({
	activeIndex,
	placement,
	swiperRef,
	total,
}: {
	activeIndex: number;
	placement: AdDisplayPosition;
	swiperRef: RefObject<SwiperClass | null>;
	total: number;
}) {
	const goToAd = (index: number) => {
		const instance = swiperRef.current;
		if (instance) {
			slideToOriginalAd(instance, index);
		}
	};
	const arrowSize = placement === "sidebar" ? "size-8" : "size-9";
	const leftInset = placement === "sidebar" ? "left-3" : "left-4";
	const rightInset = placement === "sidebar" ? "right-3" : "right-4";

	return (
		<>
			<button
				type="button"
				aria-label="上一条广告"
				className={`absolute top-1/2 ${leftInset} ${arrowSize} z-20 hidden -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-black/8 bg-white/92 text-zinc-800 shadow-[0_4px_14px_rgba(15,23,42,0.12)] backdrop-blur transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:flex dark:border-white/10 dark:bg-zinc-800/92 dark:text-zinc-100 dark:hover:bg-zinc-800`}
				onClick={() => swiperRef.current?.slidePrev()}
			>
				<BiChevronLeft className="size-5" />
			</button>
			<button
				type="button"
				aria-label="下一条广告"
				className={`absolute top-1/2 ${rightInset} ${arrowSize} z-20 hidden -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-black/8 bg-white/92 text-zinc-800 shadow-[0_4px_14px_rgba(15,23,42,0.12)] backdrop-blur transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:flex dark:border-white/10 dark:bg-zinc-800/92 dark:text-zinc-100 dark:hover:bg-zinc-800`}
				onClick={() => swiperRef.current?.slideNext()}
			>
				<BiChevronRight className="size-5" />
			</button>
			<div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-black/8 bg-white/88 px-2 py-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/85">
				{Array.from({ length: total }, (_, index) => {
					const isActive = index === activeIndex;
					return (
						<button
							key={index}
							type="button"
							aria-label={`切换到广告 ${index + 1}`}
							aria-current={isActive ? "page" : undefined}
							className={`h-1.5 cursor-pointer rounded-full transition-[width,background-color,box-shadow] duration-300 ${
								isActive
									? "w-4 bg-(--primary) shadow-[0_0_0_1px_rgba(255,255,255,0.9)] dark:shadow-[0_0_0_1px_rgba(24,24,27,0.9)]"
									: "w-1.5 bg-zinc-400/65 hover:bg-zinc-500 dark:bg-zinc-300/50 dark:hover:bg-zinc-200/70"
							}`}
							onClick={() => goToAd(index)}
						/>
					);
				})}
			</div>
		</>
	);
}

/**
 * 配置驱动的广告轮播。
 *
 * 服务端渲染和静态导出阶段直接输出最终列数、间距与平铺首屏；
 * Swiper 原生 loop 接管拖拽、自动播放与循环切换。
 */
function AdBannerImpl({
	ads,
	aspectRatio = "16/9",
	visibleCount = 1,
	autoplayInterval = DEFAULT_AD_AUTOPLAY_INTERVAL,
	gap: configuredGap = DEFAULT_HOME_AD_GAP,
	placement = "sidebar",
	cardStyle = "compact",
}: AdBannerProps) {
	const swiperRef = useRef<SwiperClass | null>(null);
	const [activeIndex, setActiveIndex] = useState(0);
	const total = ads.length;
	const requestedVisibleCount =
		placement === "sidebar"
			? 1
			: resolveAdVisibleCount(visibleCount);
	const actualVisibleCount = Math.max(
		1,
		Math.min(requestedVisibleCount, total),
	);
	const canNavigate = total > actualVisibleCount;
	const initialVisibleStart = 0;
	const initialVisibleEnd = actualVisibleCount;
	const gap = placement === "sidebar" ? 8 : configuredGap;
	const cardSurfaceClass =
		cardStyle === "preview"
			? PREVIEW_CARD_SURFACE_CLASS
			: COMPACT_CARD_SURFACE_CLASS;
	const imageRadiusClass = cardStyle === "preview" ? "rounded-xl" : "rounded-lg";
	const serverLayoutStyle = {
		"--ad-gap": `${gap}px`,
		"--ad-visible-count": actualVisibleCount,
		position: "absolute",
		inset: 0,
		visibility: "hidden",
	} as CSSProperties;
	const serverPreviewStyle = {
		display: "grid",
		gridTemplateColumns: `repeat(${actualVisibleCount}, minmax(0, 1fr))`,
		gap: `${gap}px`,
		alignItems: "stretch",
		boxSizing: "border-box",
		padding: "1px",
	} satisfies CSSProperties;
	const serverPreviewAds = ads.slice(initialVisibleStart, initialVisibleEnd);

	const updateActiveIndex = useCallback(
		(instance: SwiperClass) => {
			if (total > 0) setActiveIndex(instance.realIndex % total);
		},
		[total],
	);
	if (total === 0) return null;

	return (
		<div
			className="ad-carousel relative overflow-hidden"
			data-buffer-pages={canNavigate ? 1 : 0}
			data-effect="slide"
			data-gap={gap}
			data-placement={placement}
			data-visible-count={actualVisibleCount}
			role="region"
			aria-roledescription="carousel"
			aria-label="广告轮播"
			onFocusCapture={() => swiperRef.current?.autoplay?.stop()}
			onBlurCapture={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget)) {
					swiperRef.current?.autoplay?.start();
				}
			}}
		>
			<div
				className="ad-carousel__server-preview"
				style={serverPreviewStyle}
			>
				{serverPreviewAds.map((ad, originalIndex) => (
					<div key={`${ad.id}-server-${originalIndex}`} className="min-w-0">
						<AdCard
							ad={ad}
							aspectRatio={aspectRatio}
							cardSurfaceClass={cardSurfaceClass}
							imageRadiusClass={imageRadiusClass}
							hasHoverShadow={placement === "sidebar"}
							isAccessible
							isEager
							originalIndex={originalIndex}
							total={total}
						/>
					</div>
				))}
			</div>
			<Swiper
				key={`${placement}-${actualVisibleCount}-${total}-${gap}`}
				modules={[Autoplay, Keyboard]}
				className="ad-carousel__swiper"
				style={serverLayoutStyle}
				slidesPerView={actualVisibleCount}
				slidesPerGroup={1}
				spaceBetween={gap}
				loop={canNavigate}
				speed={500}
				watchOverflow
				watchSlidesProgress
				grabCursor={canNavigate}
				keyboard={{ enabled: true, onlyInViewport: true }}
				autoplay={
					canNavigate
							? {
								delay: autoplayInterval,
								disableOnInteraction: false,
								pauseOnMouseEnter: true,
								waitForTransition: true,
							}
						: false
				}
				onSwiper={(instance) => {
					swiperRef.current = instance;
					updateActiveIndex(instance);
					requestAnimationFrame(() => {
						if (instance.destroyed) return;
						const root = instance.el.closest<HTMLElement>(".ad-carousel");
						const preview = root?.querySelector<HTMLElement>(
							".ad-carousel__server-preview",
						);
						preview?.style.setProperty("visibility", "hidden");
						instance.el.style.visibility = "visible";
						root?.setAttribute("data-carousel-ready", "true");
					});
				}}
				onActiveIndexChange={updateActiveIndex}
				onRealIndexChange={updateActiveIndex}
			>
				{ads.map((ad, index) => {
					const originalIndex = index;
					const isInitiallyVisible =
						index >= initialVisibleStart && index < initialVisibleEnd;
					return (
						<SwiperSlide
							key={`${ad.id}-${index}`}
							className="ad-carousel__slide"
							data-initial-visible={isInitiallyVisible ? "true" : "false"}
						>
							{({ isVisible }) => {
								const isAccessible = swiperRef.current
									? isVisible
									: isInitiallyVisible;
								return (
									<AdCard
										ad={ad}
										aspectRatio={aspectRatio}
										cardSurfaceClass={cardSurfaceClass}
										imageRadiusClass={imageRadiusClass}
										hasHoverShadow={placement === "sidebar"}
										isAccessible={isAccessible}
										isEager={isInitiallyVisible}
										originalIndex={originalIndex}
										total={total}
									/>
								);
							}}
						</SwiperSlide>
					);
				})}
			</Swiper>
			{canNavigate ? (
				<AdCarouselControls
					activeIndex={activeIndex}
					placement={placement}
					swiperRef={swiperRef}
					total={total}
				/>
			) : null}
			<p className="sr-only" aria-live="polite">
				当前广告 {activeIndex + 1}，共 {total} 条：
				{ads[activeIndex]?.title}
			</p>
		</div>
	);
}

export const AdBanner = memo(AdBannerImpl);
