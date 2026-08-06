"use client";

import { Button, Modal } from "@heroui/react";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
} from "react";
import {
    BiChevronLeft,
    BiChevronRight,
    BiExpand,
    BiReset,
    BiRotateLeft,
    BiRotateRight,
    BiX,
    BiZoomIn,
    BiZoomOut,
} from "react-icons/bi";
import { Autoplay, Keyboard } from "swiper/modules";
import { Swiper, SwiperSlide, type SwiperClass } from "swiper/react";

interface GalleryCardProps {
	isAccessible: boolean;
	isEager: boolean;
	onOpen: () => void;
	originalIndex: number;
	src: string;
	title: string;
}

interface ViewerDragState {
	originX: number;
	originY: number;
	pointerId: number;
	startX: number;
	startY: number;
}

interface ViewerPoint {
	x: number;
	y: number;
}

interface ViewerPinchState {
	centerX: number;
	centerY: number;
	distance: number;
	focalX: number;
	focalY: number;
	originX: number;
	originY: number;
	zoom: number;
}

interface ViewerSwipeState {
	currentX: number;
	currentY: number;
	pointerId: number;
	startX: number;
	startY: number;
}

interface ViewerThumbnailDragState {
	lastTime: number;
	lastX: number;
	moved: boolean;
	pointerId: number;
	scrollLeft: number;
	startX: number;
	velocity: number;
}

interface ViewerWheelSwipeState {
	distance: number;
	lastEventAt: number;
	locked: boolean;
}

type ViewerTransitionDirection = "initial" | "next" | "previous";

interface ViewerTransform {
	x: number;
	y: number;
	zoom: number;
}

interface ViewerLayoutMetrics {
	imageHeight: number;
	imageWidth: number;
	viewportHeight: number;
	viewportWidth: number;
}

interface WebKitGestureEvent extends Event {
	clientX: number;
	clientY: number;
	scale: number;
}

const VIEWER_MIN_ZOOM = 0.5;
const VIEWER_MAX_ZOOM = 3;
const VIEWER_ZOOM_STEP = 0.25;
const VIEWER_SWIPE_THRESHOLD = 52;
const VIEWER_WHEEL_SWIPE_IDLE_MS = 180;
const VIEWER_WHEEL_SWIPE_THRESHOLD = 60;
const VIEWER_SURFACE_CLASS =
	"border border-black/8 bg-white/94 text-zinc-900 shadow-md shadow-black/10 backdrop-blur-md dark:border-white/12 dark:bg-zinc-700/90 dark:text-zinc-100 dark:shadow-black/30";
const VIEWER_NAV_BUTTON_CLASS =
	"size-10! min-h-10! min-w-10! shrink-0 rounded-full! border-0! text-zinc-950! shadow-none! backdrop-blur-none! dark:text-zinc-100!";
const VIEWER_CLOSE_BUTTON_CLASS =
	"size-10! min-h-10! min-w-10! shrink-0 rounded-full! border-0! bg-transparent! text-zinc-950! shadow-none! backdrop-blur-none! hover:bg-default! data-[hovered=true]:bg-default! dark:text-zinc-100!";
const VIEWER_TOOL_BUTTON_CLASS =
	"size-8! min-w-8! shrink-0 rounded-full! bg-transparent! text-zinc-900! hover:bg-black/5! dark:text-zinc-100! dark:hover:bg-white/10!";

function clampViewerZoom(zoom: number) {
	return Math.min(VIEWER_MAX_ZOOM, Math.max(VIEWER_MIN_ZOOM, zoom));
}

function getPointerDistance(first: ViewerPoint, second: ViewerPoint) {
	return Math.hypot(second.x - first.x, second.y - first.y);
}

function GalleryCard({
	isAccessible,
	isEager,
	onOpen,
	originalIndex,
	src,
	title,
}: GalleryCardProps) {
	return (
		<button
			type="button"
			tabIndex={isAccessible ? 0 : -1}
			aria-hidden={isAccessible ? undefined : true}
			aria-label={`放大查看第 ${originalIndex + 1} 张预览图`}
			onClick={onOpen}
			className="group/image relative block h-full w-full cursor-zoom-in overflow-hidden rounded-2xl border border-black/8 bg-white p-2 text-left outline-none transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-[0_10px_28px_rgba(15,23,42,0.07)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-white/10 dark:bg-zinc-950 dark:focus-visible:ring-offset-zinc-900"
		>
			<span className="block h-full overflow-hidden rounded-xl bg-white">
				{/* 动态配置允许任意远程图床，无法预先写入 Next Image remotePatterns。 */}
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={src}
					alt={`${title} 预览图 ${originalIndex + 1}`}
					loading={isEager ? "eager" : "lazy"}
					decoding="async"
					className="h-full w-full object-contain transition-transform duration-300 group-hover/image:scale-[1.015]"
				/>
			</span>
			<span className="pointer-events-none absolute top-4 right-4 flex size-8 translate-y-1 items-center justify-center rounded-full border border-black/8 bg-white/92 text-zinc-700 opacity-0 shadow-sm backdrop-blur transition group-hover/image:translate-y-0 group-hover/image:opacity-100 group-focus-visible/image:translate-y-0 group-focus-visible/image:opacity-100 dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-200">
				<BiExpand className="size-4" />
			</span>
		</button>
	);
}

function slideToImage(swiper: SwiperClass, originalIndex: number) {
	swiper.slideToLoop(originalIndex);
}

export function SiteDetailGallery({
	images,
	title,
}: {
	images: string[];
	title: string;
}) {
	const swiperRef = useRef<SwiperClass | null>(null);
	const viewerDragRef = useRef<ViewerDragState | null>(null);
	const viewerPinchRef = useRef<ViewerPinchState | null>(null);
	const viewerSwipeRef = useRef<ViewerSwipeState | null>(null);
	const viewerThumbnailDragRef = useRef<ViewerThumbnailDragState | null>(null);
	const viewerThumbnailSuppressClickRef = useRef(false);
	const viewerWheelSwipeRef = useRef<ViewerWheelSwipeState>({
		distance: 0,
		lastEventAt: 0,
		locked: false,
	});
	const viewerPointersRef = useRef(new Map<number, ViewerPoint>());
	const viewerTransformRef = useRef<ViewerTransform>({ x: 0, y: 0, zoom: 1 });
	const viewerRotationRef = useRef(0);
	const viewerStageRef = useRef<HTMLDivElement | null>(null);
	const viewerImageRef = useRef<HTMLImageElement | null>(null);
	const viewerThumbnailTrackRef = useRef<HTMLDivElement | null>(null);
	const viewerThumbnailItemsRef = useRef<Array<HTMLButtonElement | null>>([]);
	const viewerThumbnailMomentumFrameRef = useRef<number | null>(null);
	const viewerZoomLabelRef = useRef<HTMLSpanElement | null>(null);
	const viewerInteractionMovedRef = useRef(false);
	const viewerLayoutRef = useRef<ViewerLayoutMetrics | null>(null);
	const viewerAnimationFrameRef = useRef<number | null>(null);
	const viewerPendingPaintRef = useRef<{
		animate: boolean;
		transform: ViewerTransform;
	} | null>(null);
	const [activeIndex, setActiveIndex] = useState(0);
	const [isWideLayout, setIsWideLayout] = useState(false);
	const [previewIndex, setPreviewIndex] = useState<number | null>(null);
	const [viewerTransitionDirection, setViewerTransitionDirection] =
		useState<ViewerTransitionDirection>("initial");
	const total = images.length;
	const hasMultipleImages = total > 1;
	const canNavigate = hasMultipleImages && (!isWideLayout || total > 2);
	const initialVisibleStart = 0;
	const initialVisibleEnd = Math.min(2, total);
	const serverPreviewImages = images.slice(0, Math.min(2, total));
	const swiperLayoutStyle = {
		position: "absolute",
		inset: 0,
		visibility: "hidden",
	} satisfies CSSProperties;

	const updateActiveIndex = useCallback(
		(instance: SwiperClass) => {
			if (total > 0) setActiveIndex(instance.realIndex % total);
		},
		[total],
	);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(min-width: 640px)");
		const syncLayout = () => setIsWideLayout(mediaQuery.matches);
		syncLayout();
		mediaQuery.addEventListener("change", syncLayout);
		return () => mediaQuery.removeEventListener("change", syncLayout);
	}, []);
	const setViewerDragging = useCallback((dragging: boolean) => {
		const stage = viewerStageRef.current;
		if (stage) stage.dataset.dragging = dragging ? "true" : "false";
	}, []);
	const settleViewerSwipe = useCallback((animate = true) => {
		const image = viewerImageRef.current;
		if (!image) return;
		image.style.transition = animate
			? "translate 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease-out"
			: "none";
		image.style.translate = "0 0";
		image.style.scale = "1";
		image.style.opacity = "1";
	}, []);
	const updateViewerLayout = useCallback(() => {
		const stage = viewerStageRef.current;
		const image = viewerImageRef.current;
		if (!stage || !image) return;
		const style = window.getComputedStyle(stage);
		const horizontalPadding =
			Number.parseFloat(style.paddingLeft) +
			Number.parseFloat(style.paddingRight);
		const verticalPadding =
			Number.parseFloat(style.paddingTop) +
			Number.parseFloat(style.paddingBottom);
		viewerLayoutRef.current = {
			imageHeight: image.offsetHeight,
			imageWidth: image.offsetWidth,
			viewportHeight: Math.max(1, stage.clientHeight - verticalPadding),
			viewportWidth: Math.max(1, stage.clientWidth - horizontalPadding),
		};
	}, []);
	const clampViewerTransform = useCallback((transform: ViewerTransform) => {
		if (transform.zoom <= 1) return { ...transform, x: 0, y: 0 };
		const layout = viewerLayoutRef.current;
		if (!layout) return transform;
		const quarterTurns = Math.round(viewerRotationRef.current / 90);
		const swapsAxes = Math.abs(quarterTurns) % 2 === 1;
		const rotatedWidth = swapsAxes ? layout.imageHeight : layout.imageWidth;
		const rotatedHeight = swapsAxes ? layout.imageWidth : layout.imageHeight;
		const maxX = Math.max(
			0,
			(rotatedWidth * transform.zoom - layout.viewportWidth) / 2,
		);
		const maxY = Math.max(
			0,
			(rotatedHeight * transform.zoom - layout.viewportHeight) / 2,
		);
		return {
			...transform,
			x: Math.min(maxX, Math.max(-maxX, transform.x)),
			y: Math.min(maxY, Math.max(-maxY, transform.y)),
		};
	}, []);
	const commitViewerTransform = useCallback(
		(
			updater: (current: ViewerTransform) => ViewerTransform,
			animate = false,
		) => {
			const next = clampViewerTransform(updater(viewerTransformRef.current));
			viewerTransformRef.current = next;
			viewerPendingPaintRef.current = { animate, transform: next };

			const stage = viewerStageRef.current;
			if (stage) stage.dataset.zoomed = next.zoom > 1 ? "true" : "false";
			if (viewerZoomLabelRef.current) {
				viewerZoomLabelRef.current.textContent = `${Math.round(next.zoom * 100)}%`;
			}

			if (viewerAnimationFrameRef.current !== null) return;
			viewerAnimationFrameRef.current = requestAnimationFrame(() => {
				viewerAnimationFrameRef.current = null;
				const pending = viewerPendingPaintRef.current;
				const image = viewerImageRef.current;
				if (!pending || !image) return;
				viewerPendingPaintRef.current = null;
				image.style.transition = pending.animate
					? "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)"
					: "none";
				image.style.transform = `translate3d(${pending.transform.x}px, ${pending.transform.y}px, 0) rotate(${viewerRotationRef.current}deg) scale(${pending.transform.zoom})`;
			});
		},
		[clampViewerTransform],
	);
	const resetViewer = useCallback(
		(animate = true) => {
			viewerDragRef.current = null;
			viewerPinchRef.current = null;
			viewerSwipeRef.current = null;
			viewerPointersRef.current.clear();
			viewerInteractionMovedRef.current = false;
			viewerRotationRef.current = 0;
			setViewerDragging(false);
			commitViewerTransform(() => ({ x: 0, y: 0, zoom: 1 }), animate);
		},
		[commitViewerTransform, setViewerDragging],
	);
	const zoomViewerAt = useCallback(
		(nextZoom: number, focalX = 0, focalY = 0, animate = false) => {
			commitViewerTransform((current) => {
				const zoom = clampViewerZoom(nextZoom);
				if (zoom <= 1) return { x: 0, y: 0, zoom };
				const ratio = zoom / current.zoom;
				return {
					x: focalX - (focalX - current.x) * ratio,
					y: focalY - (focalY - current.y) * ratio,
					zoom,
				};
			}, animate);
		},
		[commitViewerTransform],
	);
	const stepViewerZoom = useCallback(
		(delta: number) => {
			zoomViewerAt(
				Number((viewerTransformRef.current.zoom + delta).toFixed(2)),
				0,
				0,
				true,
			);
		},
		[zoomViewerAt],
	);
	const rotateViewer = useCallback(
		(degrees: number) => {
			viewerRotationRef.current += degrees;
			commitViewerTransform((current) => ({ ...current, x: 0, y: 0 }), true);
		},
		[commitViewerTransform],
	);
	const openPreview = useCallback((index: number) => {
		setViewerTransitionDirection("initial");
		setPreviewIndex(index);
	}, []);
	const selectPreview = useCallback(
		(index: number) => {
			if (previewIndex === index) return;
			setViewerTransitionDirection(
				previewIndex === null
					? "initial"
					: index > previewIndex
						? "next"
						: "previous",
			);
			setPreviewIndex(index);
		},
		[previewIndex],
	);
	const showPreviousPreview = useCallback(() => {
		if (previewIndex === null || previewIndex <= 0) return;
		setViewerTransitionDirection("previous");
		setPreviewIndex(previewIndex - 1);
	}, [previewIndex]);
	const showNextPreview = useCallback(() => {
		if (previewIndex === null || previewIndex >= total - 1) return;
		setViewerTransitionDirection("next");
		setPreviewIndex(previewIndex + 1);
	}, [previewIndex, total]);
	const stopViewerThumbnailMomentum = useCallback(() => {
		if (viewerThumbnailMomentumFrameRef.current === null) return;
		cancelAnimationFrame(viewerThumbnailMomentumFrameRef.current);
		viewerThumbnailMomentumFrameRef.current = null;
	}, []);
	const startViewerThumbnailMomentum = useCallback(
		(track: HTMLDivElement, initialVelocity: number) => {
			stopViewerThumbnailMomentum();
			if (
				Math.abs(initialVelocity) < 0.08 ||
				window.matchMedia("(prefers-reduced-motion: reduce)").matches
			) {
				return;
			}
			let velocity = initialVelocity;
			let previousTime = performance.now();
			const step = (time: number) => {
				const elapsed = Math.min(32, time - previousTime);
				previousTime = time;
				const previousScrollLeft = track.scrollLeft;
				track.scrollLeft -= velocity * elapsed;
				velocity *= 0.94 ** (elapsed / 16.67);
				const reachedBoundary = track.scrollLeft === previousScrollLeft;
				if (Math.abs(velocity) < 0.02 || reachedBoundary) {
					viewerThumbnailMomentumFrameRef.current = null;
					return;
				}
				viewerThumbnailMomentumFrameRef.current = requestAnimationFrame(step);
			};
			viewerThumbnailMomentumFrameRef.current = requestAnimationFrame(step);
		},
		[stopViewerThumbnailMomentum],
	);

	useEffect(() => {
		if (previewIndex === null) return;
		stopViewerThumbnailMomentum();
		let centerFrame: number | null = null;
		const centerActiveThumbnail = (behavior: ScrollBehavior) => {
			const track = viewerThumbnailTrackRef.current;
			const item = viewerThumbnailItemsRef.current[previewIndex];
			if (!track || !item) return;
			const target = Math.min(
				Math.max(0, track.scrollWidth - track.clientWidth),
				Math.max(
					0,
					item.offsetLeft + item.offsetWidth / 2 - track.clientWidth / 2,
				),
			);
			track.scrollTo({ behavior, left: target });
		};
		const frame = requestAnimationFrame(() => centerActiveThumbnail("smooth"));
		const observer = new ResizeObserver(() => {
			if (centerFrame !== null) cancelAnimationFrame(centerFrame);
			centerFrame = requestAnimationFrame(() => centerActiveThumbnail("auto"));
		});
		const track = viewerThumbnailTrackRef.current;
		if (track) observer.observe(track);
		return () => {
			cancelAnimationFrame(frame);
			if (centerFrame !== null) cancelAnimationFrame(centerFrame);
			observer.disconnect();
		};
	}, [previewIndex, stopViewerThumbnailMomentum]);

	useEffect(() => {
		const autoplay = swiperRef.current?.autoplay;
		if (!autoplay) return;
		if (previewIndex === null) autoplay.start();
		else autoplay.stop();
	}, [previewIndex]);

	useEffect(() => {
		if (previewIndex !== null) return;
		viewerWheelSwipeRef.current = {
			distance: 0,
			lastEventAt: 0,
			locked: false,
		};
	}, [previewIndex]);

	useEffect(() => {
		resetViewer(false);
	}, [previewIndex, resetViewer]);

	useEffect(
		() => () => {
			if (viewerAnimationFrameRef.current !== null) {
				cancelAnimationFrame(viewerAnimationFrameRef.current);
			}
			stopViewerThumbnailMomentum();
		},
		[stopViewerThumbnailMomentum],
	);

	useEffect(() => {
		if (previewIndex === null) return;
		const syncViewerBounds = () => {
			updateViewerLayout();
			commitViewerTransform((current) => current);
		};
		const frame = requestAnimationFrame(syncViewerBounds);
		window.addEventListener("resize", syncViewerBounds);
		window.visualViewport?.addEventListener("resize", syncViewerBounds);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("resize", syncViewerBounds);
			window.visualViewport?.removeEventListener("resize", syncViewerBounds);
		};
	}, [commitViewerTransform, previewIndex, updateViewerLayout]);

	useEffect(() => {
		if (previewIndex === null) return;
		const stage = viewerStageRef.current;
		if (!stage) return;

		const handleWheel = (event: WheelEvent) => {
			if (
				event.target instanceof Element &&
				event.target.closest("[data-viewer-thumbnail-track]")
			) {
				return;
			}
			event.preventDefault();
			const current = viewerTransformRef.current;
			const isTrackpadPinch = event.ctrlKey || event.metaKey;
			const isMouseWheelZoom =
				current.zoom <= 1 &&
				Math.abs(event.deltaY) >= 40 &&
				Math.abs(event.deltaX) < 4;
			if (isTrackpadPinch || isMouseWheelZoom) {
				const rect = stage.getBoundingClientRect();
				const focalX = event.clientX - rect.left - rect.width / 2;
				const focalY = event.clientY - rect.top - rect.height / 2;
				const factor = isTrackpadPinch
					? Math.exp(-event.deltaY * 0.006)
					: event.deltaY < 0
						? 1.2
						: 1 / 1.2;
				zoomViewerAt(current.zoom * factor, focalX, focalY);
				return;
			}
			if (current.zoom > 1) {
				commitViewerTransform((transform) => ({
					...transform,
					x: transform.x - event.deltaX,
					y: transform.y - event.deltaY,
				}));
				return;
			}
			if (Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.15) {
				const now = performance.now();
				const swipe = viewerWheelSwipeRef.current;
				if (now - swipe.lastEventAt > VIEWER_WHEEL_SWIPE_IDLE_MS) {
					swipe.distance = 0;
					swipe.locked = false;
				}
				swipe.lastEventAt = now;
				if (swipe.locked) return;
				swipe.distance += event.deltaX;
				if (Math.abs(swipe.distance) < VIEWER_WHEEL_SWIPE_THRESHOLD) return;
				swipe.locked = true;
				if (swipe.distance > 0) showNextPreview();
				else showPreviousPreview();
			}
		};

		const preventBrowserZoom = (event: WheelEvent) => {
			if (
				(event.ctrlKey || event.metaKey) &&
				event.target instanceof Node &&
				stage.contains(event.target)
			) {
				event.preventDefault();
			}
		};

		let gestureStartZoom = 1;
		let gestureFocalX = 0;
		let gestureFocalY = 0;
		const handleGestureStart = (rawEvent: Event) => {
			if (
				!(rawEvent.target instanceof Node) ||
				!stage.contains(rawEvent.target)
			) {
				return;
			}
			const event = rawEvent as WebKitGestureEvent;
			event.preventDefault();
			const rect = stage.getBoundingClientRect();
			gestureStartZoom = viewerTransformRef.current.zoom;
			gestureFocalX = event.clientX - rect.left - rect.width / 2;
			gestureFocalY = event.clientY - rect.top - rect.height / 2;
		};
		const handleGestureChange = (rawEvent: Event) => {
			if (
				!(rawEvent.target instanceof Node) ||
				!stage.contains(rawEvent.target)
			) {
				return;
			}
			const event = rawEvent as WebKitGestureEvent;
			event.preventDefault();
			zoomViewerAt(
				gestureStartZoom * event.scale,
				gestureFocalX,
				gestureFocalY,
			);
		};
		const preventGestureEnd = (event: Event) => {
			if (event.target instanceof Node && stage.contains(event.target)) {
				event.preventDefault();
			}
		};

		stage.addEventListener("wheel", handleWheel, { passive: false });
		window.addEventListener("wheel", preventBrowserZoom, {
			capture: true,
			passive: false,
		});
		window.addEventListener("gesturestart", handleGestureStart, {
			capture: true,
			passive: false,
		});
		window.addEventListener("gesturechange", handleGestureChange, {
			capture: true,
			passive: false,
		});
		window.addEventListener("gestureend", preventGestureEnd, {
			capture: true,
			passive: false,
		});

		return () => {
			stage.removeEventListener("wheel", handleWheel);
			window.removeEventListener("wheel", preventBrowserZoom, true);
			window.removeEventListener("gesturestart", handleGestureStart, true);
			window.removeEventListener("gesturechange", handleGestureChange, true);
			window.removeEventListener("gestureend", preventGestureEnd, true);
		};
	}, [
		commitViewerTransform,
		previewIndex,
		showNextPreview,
		showPreviousPreview,
		zoomViewerAt,
	]);

	useEffect(() => {
		if (previewIndex === null) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			switch (event.key) {
				case "ArrowLeft":
					event.preventDefault();
					showPreviousPreview();
					break;
				case "ArrowRight":
					event.preventDefault();
					showNextPreview();
					break;
				case "+":
				case "=":
					event.preventDefault();
					stepViewerZoom(VIEWER_ZOOM_STEP);
					break;
				case "-":
					event.preventDefault();
					stepViewerZoom(-VIEWER_ZOOM_STEP);
					break;
				case "0":
					event.preventDefault();
					resetViewer();
					break;
				case "r":
				case "R":
					event.preventDefault();
					rotateViewer(90);
					break;
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		previewIndex,
		resetViewer,
		rotateViewer,
		showNextPreview,
		showPreviousPreview,
		stepViewerZoom,
	]);

	if (images.length === 0) return null;

	return (
		<>
			<div
				className="site-detail-gallery relative overflow-hidden"
				data-single-image={total === 1 ? "true" : "false"}
				role="region"
				aria-roledescription={canNavigate ? "carousel" : undefined}
				aria-label={`${title} 预览图`}
				onFocusCapture={() => swiperRef.current?.autoplay?.stop()}
				onBlurCapture={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget)) {
						swiperRef.current?.autoplay?.start();
					}
				}}
			>
				<div className="site-detail-gallery__track relative">
					<div className="site-detail-gallery__server-preview">
						{serverPreviewImages.map((src, originalIndex) => (
							<div
								key={`${src}-server-${originalIndex}`}
								className="site-detail-gallery__server-item min-w-0"
							>
								<GalleryCard
									isAccessible
									isEager
									onOpen={() => openPreview(originalIndex)}
									originalIndex={originalIndex}
									src={src}
									title={title}
								/>
							</div>
						))}
					</div>

					<Swiper
						key={`${total}-${isWideLayout ? "wide" : "compact"}-${canNavigate ? "loop" : "static"}`}
						modules={[Autoplay, Keyboard]}
						className="site-detail-gallery__swiper"
						style={swiperLayoutStyle}
						slidesPerView={hasMultipleImages ? 1.08 : 1}
						spaceBetween={10}
						breakpoints={{
							640: {
								slidesPerView: hasMultipleImages ? 2 : 1,
								spaceBetween: 14,
							},
						}}
						loop={canNavigate}
						speed={520}
						watchOverflow
						watchSlidesProgress
						grabCursor={canNavigate}
						keyboard={{ enabled: true, onlyInViewport: true }}
						autoplay={
							canNavigate
								? {
										delay: 3800,
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
								const root = instance.el.closest<HTMLElement>(
									".site-detail-gallery",
								);
								const serverPreview = root?.querySelector<HTMLElement>(
									".site-detail-gallery__server-preview",
								);
								serverPreview?.style.setProperty("visibility", "hidden");
								instance.el.style.visibility = "visible";
								root?.setAttribute("data-carousel-ready", "true");
							});
						}}
						onActiveIndexChange={updateActiveIndex}
						onRealIndexChange={updateActiveIndex}
					>
						{images.map((src, index) => {
							const originalIndex = index;
							const isInitiallyVisible =
								index >= initialVisibleStart && index < initialVisibleEnd;
							return (
								<SwiperSlide
									key={`${src}-${index}`}
									className="site-detail-gallery__slide"
								>
									{({ isVisible }) => {
										const isAccessible = swiperRef.current
											? isVisible
											: isInitiallyVisible;
										return (
											<GalleryCard
												isAccessible={isAccessible}
												isEager={isInitiallyVisible}
												onOpen={() => openPreview(originalIndex)}
												originalIndex={originalIndex}
												src={src}
												title={title}
											/>
										);
									}}
								</SwiperSlide>
							);
						})}
					</Swiper>

					{canNavigate ? (
						<>
							<Button
								isIconOnly
								size="sm"
								variant="tertiary"
								aria-label="上一组预览图"
								onPress={() => swiperRef.current?.slidePrev()}
								className="absolute top-1/2 left-2 z-10 hidden -translate-y-1/2 border border-black/8 bg-white/94 shadow-md backdrop-blur sm:flex dark:border-white/10 dark:bg-zinc-900/92"
							>
								<BiChevronLeft className="size-5" />
							</Button>
							<Button
								isIconOnly
								size="sm"
								variant="tertiary"
								aria-label="下一组预览图"
								onPress={() => swiperRef.current?.slideNext()}
								className="absolute top-1/2 right-2 z-10 hidden -translate-y-1/2 border border-black/8 bg-white/94 shadow-md backdrop-blur sm:flex dark:border-white/10 dark:bg-zinc-900/92"
							>
								<BiChevronRight className="size-5" />
							</Button>
						</>
					) : null}
				</div>

				{canNavigate ? (
					<div className="mt-4 flex items-center justify-center gap-1.5">
						{images.map((image, index) => (
							<button
								key={`${image}-dot-${index}`}
								type="button"
								aria-label={`切换到第 ${index + 1} 张预览图`}
								aria-current={index === activeIndex ? "page" : undefined}
								onClick={() => {
									const instance = swiperRef.current;
									if (instance) {
										slideToImage(instance, index);
									}
								}}
								className={`h-1.5 cursor-pointer rounded-full transition-[width,background-color] ${
									index === activeIndex
										? "w-5 bg-primary"
										: "w-1.5 bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-600 dark:hover:bg-zinc-500"
								}`}
							/>
						))}
					</div>
				) : null}
			</div>

			<Modal>
				<Modal.Backdrop
					isDismissable
					isOpen={previewIndex !== null}
					onOpenChange={(open) => {
						if (!open) setPreviewIndex(null);
					}}
					className="z-1000"
				>
					<Modal.Container size="full" placement="center" className="p-0!">
						<Modal.Dialog className="h-dvh max-h-dvh w-screen max-w-none! overflow-hidden rounded-none! border-0 bg-transparent p-0 text-zinc-900 shadow-none">
							<Modal.Header className="sr-only">
								<Modal.Heading>{title} 预览图</Modal.Heading>
							</Modal.Header>
							<Modal.Body className="m-0! p-0!">
								<div
									ref={viewerStageRef}
									data-dragging="false"
									data-zoomed="false"
									className="relative flex h-dvh min-h-80 cursor-default select-none items-center justify-center overflow-hidden bg-transparent px-3 pt-12 pb-32 data-[dragging=true]:cursor-grabbing data-[zoomed=true]:cursor-grab sm:px-8 sm:pt-8 sm:pb-36"
									onDoubleClick={(event) => {
										if (
											(event.target as HTMLElement).closest("[data-viewer-ui]")
										)
											return;
										const rect = event.currentTarget.getBoundingClientRect();
										zoomViewerAt(
											viewerTransformRef.current.zoom === 1 ? 2 : 1,
											event.clientX - rect.left - rect.width / 2,
											event.clientY - rect.top - rect.height / 2,
											true,
										);
									}}
									onPointerDown={(event) => {
										if (
											(event.target as HTMLElement).closest("[data-viewer-ui]")
										)
											return;
										if (viewerPointersRef.current.size === 0) {
											viewerInteractionMovedRef.current = false;
										}
										const current = viewerTransformRef.current;
										if (current.zoom <= 1 && event.pointerType === "mouse")
											return;
										event.preventDefault();
										event.currentTarget.setPointerCapture(event.pointerId);
										if (
											current.zoom <= 1 &&
											event.pointerType !== "mouse" &&
											viewerPointersRef.current.size === 0
										) {
											const image = viewerImageRef.current;
											if (image) {
												image.style.animation = "none";
												image.style.transition = "none";
												image.style.scale = "1";
											}
											viewerSwipeRef.current = {
												currentX: event.clientX,
												currentY: event.clientY,
												pointerId: event.pointerId,
												startX: event.clientX,
												startY: event.clientY,
											};
										}
										viewerPointersRef.current.set(event.pointerId, {
											x: event.clientX,
											y: event.clientY,
										});
										const points = Array.from(
											viewerPointersRef.current.values(),
										);
										if (points.length >= 2) {
											viewerInteractionMovedRef.current = true;
											settleViewerSwipe(false);
											viewerSwipeRef.current = null;
											const [first, second] = points;
											const centerX = (first.x + second.x) / 2;
											const centerY = (first.y + second.y) / 2;
											const rect = event.currentTarget.getBoundingClientRect();
											viewerPinchRef.current = {
												centerX,
												centerY,
												distance: Math.max(
													1,
													getPointerDistance(first, second),
												),
												focalX: centerX - rect.left - rect.width / 2,
												focalY: centerY - rect.top - rect.height / 2,
												originX: current.x,
												originY: current.y,
												zoom: current.zoom,
											};
											viewerDragRef.current = null;
											setViewerDragging(true);
										} else if (current.zoom > 1) {
											viewerDragRef.current = {
												originX: current.x,
												originY: current.y,
												pointerId: event.pointerId,
												startX: event.clientX,
												startY: event.clientY,
											};
											setViewerDragging(true);
										}
									}}
									onPointerMove={(event) => {
										if (!viewerPointersRef.current.has(event.pointerId)) return;
										event.preventDefault();
										viewerPointersRef.current.set(event.pointerId, {
											x: event.clientX,
											y: event.clientY,
										});
										const points = Array.from(
											viewerPointersRef.current.values(),
										);
										const pinch = viewerPinchRef.current;
										if (points.length >= 2 && pinch) {
											viewerInteractionMovedRef.current = true;
											const [first, second] = points;
											const centerX = (first.x + second.x) / 2;
											const centerY = (first.y + second.y) / 2;
											const zoom = clampViewerZoom(
												pinch.zoom *
													(getPointerDistance(first, second) / pinch.distance),
											);
											if (zoom <= 1) {
												commitViewerTransform(() => ({ x: 0, y: 0, zoom }));
											} else {
												const ratio = zoom / pinch.zoom;
												commitViewerTransform(() => ({
													x:
														pinch.focalX -
														(pinch.focalX - pinch.originX) * ratio +
														(centerX - pinch.centerX),
													y:
														pinch.focalY -
														(pinch.focalY - pinch.originY) * ratio +
														(centerY - pinch.centerY),
													zoom,
												}));
											}
											return;
										}
										const swipe = viewerSwipeRef.current;
										if (
											points.length === 1 &&
											swipe?.pointerId === event.pointerId &&
											viewerTransformRef.current.zoom <= 1
										) {
											swipe.currentX = event.clientX;
											swipe.currentY = event.clientY;
											if (
												Math.hypot(
													swipe.currentX - swipe.startX,
													swipe.currentY - swipe.startY,
												) > 6
											) {
												viewerInteractionMovedRef.current = true;
											}
											const deltaX = swipe.currentX - swipe.startX;
											const atStart = previewIndex === 0 && deltaX > 0;
											const atEnd = previewIndex === total - 1 && deltaX < 0;
											const resistance = atStart || atEnd ? 0.24 : 1;
											const maxPull = Math.max(
												72,
												event.currentTarget.clientWidth * 0.32,
											);
											const visualDelta = Math.min(
												maxPull,
												Math.max(-maxPull, deltaX * resistance),
											);
											const progress = Math.min(
												1,
												Math.abs(visualDelta) / VIEWER_SWIPE_THRESHOLD,
											);
											const image = viewerImageRef.current;
											if (image) {
												image.style.translate = `${visualDelta}px 0`;
												image.style.opacity = `${1 - progress * 0.1}`;
											}
											return;
										}
										const drag = viewerDragRef.current;
										if (!drag || drag.pointerId !== event.pointerId) return;
										if (
											Math.hypot(
												event.clientX - drag.startX,
												event.clientY - drag.startY,
											) > 4
										) {
											viewerInteractionMovedRef.current = true;
										}
										commitViewerTransform((current) => ({
											...current,
											x: drag.originX + event.clientX - drag.startX,
											y: drag.originY + event.clientY - drag.startY,
										}));
									}}
									onPointerUp={(event) => {
										const swipe = viewerSwipeRef.current;
										if (swipe?.pointerId === event.pointerId) {
											const deltaX = swipe.currentX - swipe.startX;
											const deltaY = swipe.currentY - swipe.startY;
											const shouldSwitch =
												Math.abs(deltaX) >= VIEWER_SWIPE_THRESHOLD &&
												Math.abs(deltaX) > Math.abs(deltaY) * 1.15;
											const canSwitch =
												previewIndex !== null &&
												(deltaX < 0
													? previewIndex < total - 1
													: previewIndex > 0);
											if (shouldSwitch && canSwitch) {
												if (deltaX < 0) showNextPreview();
												else showPreviousPreview();
											} else {
												settleViewerSwipe();
											}
											viewerSwipeRef.current = null;
										}
										viewerPointersRef.current.delete(event.pointerId);
										viewerDragRef.current = null;
										viewerPinchRef.current = null;
										if (
											event.currentTarget.hasPointerCapture(event.pointerId)
										) {
											event.currentTarget.releasePointerCapture(
												event.pointerId,
											);
										}
										const remaining = viewerPointersRef.current.entries().next()
											.value as [number, ViewerPoint] | undefined;
										const current = viewerTransformRef.current;
										if (remaining && current.zoom > 1) {
											viewerDragRef.current = {
												originX: current.x,
												originY: current.y,
												pointerId: remaining[0],
												startX: remaining[1].x,
												startY: remaining[1].y,
											};
											setViewerDragging(true);
										} else {
											setViewerDragging(false);
										}
									}}
									onPointerCancel={(event) => {
										settleViewerSwipe();
										viewerPointersRef.current.delete(event.pointerId);
										viewerDragRef.current = null;
										viewerPinchRef.current = null;
										viewerSwipeRef.current = null;
										setViewerDragging(viewerPointersRef.current.size > 0);
									}}
									style={{ touchAction: "none" }}
								>
									<Button
										type="button"
										variant="ghost"
										aria-label="关闭图片预览"
										className="absolute! inset-0 z-0 h-auto! w-auto! min-w-0! cursor-default rounded-none! bg-transparent! p-0!"
										onPress={() => {
											if (viewerInteractionMovedRef.current) {
												viewerInteractionMovedRef.current = false;
												return;
											}
											setPreviewIndex(null);
										}}
									/>
									<Modal.CloseTrigger
										data-viewer-ui
										className={`top-3! right-3! z-30 sm:top-5! sm:right-5! ${VIEWER_CLOSE_BUTTON_CLASS}`}
									>
										<BiX className="size-6" />
									</Modal.CloseTrigger>
									{previewIndex !== null ? (
										// eslint-disable-next-line @next/next/no-img-element
										<img
											key={`${images[previewIndex]}-${previewIndex}`}
											ref={viewerImageRef}
											src={images[previewIndex]}
											alt={`${title} 预览图 ${previewIndex + 1}`}
											data-direction={viewerTransitionDirection}
											draggable={false}
											onLoad={() => {
												updateViewerLayout();
												commitViewerTransform((current) => current);
											}}
											className="site-detail-viewer-image relative z-10 max-h-[calc(100dvh-9.5rem)] max-w-[calc(100vw-1.5rem)] object-contain shadow-[0_12px_40px_rgba(15,23,42,0.16)] dark:shadow-black/35 sm:max-h-[calc(100dvh-11rem)] sm:max-w-[calc(100vw-5rem)]"
											style={{
												transform: "translate3d(0, 0, 0) rotate(0deg) scale(1)",
											}}
										/>
									) : null}
									{hasMultipleImages ? (
										<>
											<Button
												data-viewer-ui
												isIconOnly
												size="sm"
												variant="ghost"
												aria-label="上一张预览图"
												isDisabled={previewIndex === null || previewIndex <= 0}
												onPress={showPreviousPreview}
												className={`absolute top-1/2 left-2 z-20 -translate-y-1/2 sm:left-5 ${VIEWER_NAV_BUTTON_CLASS}`}
											>
												<BiChevronLeft className="size-7" />
											</Button>
											<Button
												data-viewer-ui
												isIconOnly
												size="sm"
												variant="ghost"
												aria-label="下一张预览图"
												isDisabled={
													previewIndex === null || previewIndex >= total - 1
												}
												onPress={showNextPreview}
												className={`absolute top-1/2 right-2 z-20 -translate-y-1/2 sm:right-5 ${VIEWER_NAV_BUTTON_CLASS}`}
											>
												<BiChevronRight className="size-7" />
											</Button>
										</>
									) : null}
									{hasMultipleImages && previewIndex !== null ? (
										<div
											data-viewer-ui
											className="pointer-events-none absolute right-2 bottom-16 left-2 z-20 flex justify-center sm:right-5 sm:bottom-19 sm:left-5"
										>
											<div
												className={`pointer-events-auto w-full max-w-96 overflow-hidden rounded-xl ${VIEWER_SURFACE_CLASS}`}
											>
												<div
													ref={viewerThumbnailTrackRef}
													data-viewer-thumbnail-track
													role="group"
													aria-label="预览图画廊"
													className="w-full cursor-grab overflow-x-auto overscroll-x-contain px-1 py-1 [scrollbar-width:none] active:cursor-grabbing sm:px-1.5 sm:py-1.5 [&::-webkit-scrollbar]:hidden"
													style={{ touchAction: "pan-x" }}
													onWheel={(event) => {
														event.stopPropagation();
														if (
															Math.abs(event.deltaX) >= Math.abs(event.deltaY)
														)
															return;
														event.preventDefault();
														event.currentTarget.scrollBy({
															behavior: "smooth",
															left: event.deltaY,
														});
													}}
													onPointerDown={(event) => {
														if (
															event.button !== 0 ||
															event.pointerType !== "mouse"
														) {
															return;
														}
														stopViewerThumbnailMomentum();
														viewerThumbnailSuppressClickRef.current = false;
														const now = performance.now();
														viewerThumbnailDragRef.current = {
															lastTime: now,
															lastX: event.clientX,
															moved: false,
															pointerId: event.pointerId,
															scrollLeft: event.currentTarget.scrollLeft,
															startX: event.clientX,
															velocity: 0,
														};
													}}
													onPointerMove={(event) => {
														const drag = viewerThumbnailDragRef.current;
														if (!drag || drag.pointerId !== event.pointerId)
															return;
														const deltaX = event.clientX - drag.startX;
														if (Math.abs(deltaX) > 3 && !drag.moved) {
															drag.moved = true;
															event.currentTarget.setPointerCapture(
																event.pointerId,
															);
														}
														if (!drag.moved) return;
														event.preventDefault();
														const now = performance.now();
														const elapsed = Math.max(1, now - drag.lastTime);
														const instantVelocity =
															(event.clientX - drag.lastX) / elapsed;
														drag.velocity =
															drag.velocity * 0.65 + instantVelocity * 0.35;
														drag.lastTime = now;
														drag.lastX = event.clientX;
														event.currentTarget.scrollLeft =
															drag.scrollLeft - deltaX;
													}}
													onPointerUp={(event) => {
														const drag = viewerThumbnailDragRef.current;
														if (!drag || drag.pointerId !== event.pointerId)
															return;
														viewerThumbnailSuppressClickRef.current =
															drag.moved;
														viewerThumbnailDragRef.current = null;
														if (drag.moved) {
															startViewerThumbnailMomentum(
																event.currentTarget,
																drag.velocity,
															);
														}
														if (
															event.currentTarget.hasPointerCapture(
																event.pointerId,
															)
														) {
															event.currentTarget.releasePointerCapture(
																event.pointerId,
															);
														}
													}}
													onPointerCancel={(event) => {
														viewerThumbnailSuppressClickRef.current = false;
														viewerThumbnailDragRef.current = null;
														stopViewerThumbnailMomentum();
														if (
															event.currentTarget.hasPointerCapture(
																event.pointerId,
															)
														) {
															event.currentTarget.releasePointerCapture(
																event.pointerId,
															);
														}
													}}
													onClickCapture={(event) => {
														if (!viewerThumbnailSuppressClickRef.current)
															return;
														event.preventDefault();
														event.stopPropagation();
														viewerThumbnailSuppressClickRef.current = false;
													}}
												>
													<div className="flex w-max items-center gap-1 sm:gap-1.5">
														{images.map((src, index) => (
															<button
																key={`${src}-viewer-thumbnail-${index}`}
																ref={(element) => {
																	viewerThumbnailItemsRef.current[index] =
																		element;
																}}
																type="button"
																aria-label={`查看第 ${index + 1} 张预览图`}
																aria-current={
																	index === previewIndex ? "true" : undefined
																}
																onClick={() => selectPreview(index)}
																className={`h-7 w-9 shrink-0 cursor-pointer overflow-hidden rounded-md border-2 bg-white transition-[border-color,opacity,transform] duration-200 hover:opacity-85 active:scale-95 sm:h-9 sm:w-12 ${
																	index === previewIndex
																		? "scale-105 border-primary shadow-sm"
																		: "border-transparent opacity-70 hover:border-black/15 dark:hover:border-white/20"
																}`}
															>
																{/* eslint-disable-next-line @next/next/no-img-element */}
																<img
																	src={src}
																	alt=""
																	draggable={false}
																	className="h-full w-full object-cover"
																/>
															</button>
														))}
													</div>
												</div>
											</div>
										</div>
									) : null}
									<div
										data-viewer-ui
										className={`absolute bottom-3 left-1/2 z-20 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-0.5 rounded-full p-1 sm:bottom-5 sm:gap-1 sm:p-1.5 ${VIEWER_SURFACE_CLASS}`}
									>
										<Button
											isIconOnly
											size="sm"
											variant="tertiary"
											aria-label="缩小图片"
											onPress={() => stepViewerZoom(-VIEWER_ZOOM_STEP)}
											className={VIEWER_TOOL_BUTTON_CLASS}
										>
											<BiZoomOut className="size-5" />
										</Button>
										<span
											ref={viewerZoomLabelRef}
											className="w-10 shrink-0 text-center text-xs tabular-nums text-zinc-700 dark:text-zinc-200 sm:w-11"
										>
											100%
										</span>
										<Button
											isIconOnly
											size="sm"
											variant="tertiary"
											aria-label="放大图片"
											onPress={() => stepViewerZoom(VIEWER_ZOOM_STEP)}
											className={VIEWER_TOOL_BUTTON_CLASS}
										>
											<BiZoomIn className="size-5" />
										</Button>
										<span className="mx-0.5 hidden h-5 w-px shrink-0 bg-black/10 dark:bg-white/15 sm:mx-1 sm:block" />
										<Button
											isIconOnly
											size="sm"
											variant="tertiary"
											aria-label="向左旋转"
											onPress={() => rotateViewer(-90)}
											className={`${VIEWER_TOOL_BUTTON_CLASS} hidden! sm:inline-flex!`}
										>
											<BiRotateLeft className="size-5" />
										</Button>
										<Button
											isIconOnly
											size="sm"
											variant="tertiary"
											aria-label="向右旋转"
											onPress={() => rotateViewer(90)}
											className={`${VIEWER_TOOL_BUTTON_CLASS} hidden! sm:inline-flex!`}
										>
											<BiRotateRight className="size-5" />
										</Button>
										<Button
											isIconOnly
											size="sm"
											variant="tertiary"
											aria-label="复位图片"
											onPress={() => resetViewer()}
											className={`${VIEWER_TOOL_BUTTON_CLASS} hidden! sm:inline-flex!`}
										>
											<BiReset className="size-5" />
										</Button>
										<span className="mx-0.5 h-5 w-px shrink-0 bg-black/10 dark:bg-white/15 sm:mx-1" />
										<span className="w-9 shrink-0 text-center font-medium text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
											{previewIndex === null ? 1 : previewIndex + 1} / {total}
										</span>
									</div>
								</div>
							</Modal.Body>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</>
	);
}
