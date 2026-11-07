"use client";

import { useRouter } from "next/navigation";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	useTransition,
	type ReactNode,
} from "react";

type NavigatePage = (
	href: string,
	options?: { scroll?: boolean; refresh?: boolean },
) => void;

const PageNavigationContext = createContext<NavigatePage | null>(null);
const LinkNavigationContext = createContext<(() => () => void) | null>(null);

const progressDelay = 240;
const initialProgress = "scaleX(0.12)";

export function PageNavigationProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [pendingLinks, setPendingLinks] = useState(0);

	const registerLink = useCallback(() => {
		setPendingLinks((count) => count + 1);
		return () => setPendingLinks((count) => count - 1);
	}, []);

	const navigate = useCallback<NavigatePage>((href, options) => {
		startTransition(() => {
			router.push(href, { scroll: options?.scroll });
			if (options?.refresh) router.refresh();
		});
	}, [router]);

	return (
		<PageNavigationContext.Provider value={navigate}>
			<LinkNavigationContext.Provider value={registerLink}>
				{children}
			</LinkNavigationContext.Provider>
			<PageNavigationProgress pending={isPending || pendingLinks > 0} />
		</PageNavigationContext.Provider>
	);
}

export function usePageNavigation() {
	const navigate = useContext(PageNavigationContext);
	if (!navigate) throw new Error("PageNavigationProvider is required");
	return navigate;
}

export function PageNavigationLinkActivity() {
	const register = useContext(LinkNavigationContext);
	useEffect(() => register?.(), [register]);
	return null;
}

function PageNavigationProgress({ pending }: { pending: boolean }) {
	const barRef = useRef<HTMLDivElement>(null);
	const motionRef = useRef<{ animation: Animation; finishing?: true } | null>(
		null,
	);

	useEffect(() => () => motionRef.current?.animation.cancel(), []);

	useEffect(() => {
		const bar = barRef.current;
		if (!bar) return;

		if (pending) {
			const timer = window.setTimeout(() => {
				motionRef.current?.animation.cancel();
				bar.hidden = false;

				if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
					motionRef.current = null;
					return;
				}

				motionRef.current = {
					animation: bar.animate(
						[{ transform: initialProgress }, { transform: "scaleX(0.9)" }],
						{
							duration: 7000,
							easing: "cubic-bezier(0.1, 0.75, 0.25, 1)",
							fill: "forwards",
						},
					),
				};
			}, progressDelay);
			return () => window.clearTimeout(timer);
		}

		const motion = motionRef.current;
		if (bar.hidden || motion?.finishing) return;
		if (!motion) {
			bar.hidden = true;
			return;
		}

		const transform = getComputedStyle(bar).transform;
		motion.animation.cancel();
		const finish = bar.animate(
			[
				{ transform, opacity: 1 },
				{ transform: "scaleX(1)", opacity: 1, offset: 0.6 },
				{ transform: "scaleX(1)", opacity: 0 },
			],
			{ duration: 300, easing: "ease-out", fill: "forwards" },
		);
		motionRef.current = { animation: finish, finishing: true };
		finish.onfinish = () => {
			if (motionRef.current?.animation !== finish) return;
			bar.hidden = true;
			finish.cancel();
			motionRef.current = null;
		};
	}, [pending]);

	return (
		<div
			ref={barRef}
			role="progressbar"
			aria-label="正在加载页面"
			hidden
			className="page-navigation-progress pointer-events-none fixed inset-x-0 top-0 z-1000 h-[2px] origin-left bg-(--primary)"
			style={{ transform: initialProgress }}
		/>
	);
}
