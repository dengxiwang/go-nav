"use client";

import { RouterProvider } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useOptimistic,
	useRef,
	useState,
	useTransition,
	type ReactNode,
} from "react";
import { AdminLoadingIndicator } from "./loading-indicator";

interface AdminNavigationState {
	activePath: string;
	isLoading: boolean;
	navigate: (href: string) => void;
	registerLoading: () => () => void;
}

export const AdminNavigationContext = createContext<AdminNavigationState | null>(null);

function normalizePath(path: string) {
	return `${path.replace(/\/+$/, "")}/`;
}

export function AdminNavigationProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const [isPending, startTransition] = useTransition();
	const [activePath, setActivePath] = useOptimistic(pathname);
	const loaders = useRef(new Set<symbol>());
	const [loaderCount, setLoaderCount] = useState(0);
	const [showLoading, setShowLoading] = useState(true);
	const isLoading = isPending || loaderCount > 0 || showLoading;

	const registerLoading = useCallback(() => {
		const token = Symbol();
		loaders.current.add(token);
		setLoaderCount(loaders.current.size);
		return () => {
			if (loaders.current.delete(token)) {
				setLoaderCount(loaders.current.size);
			}
		};
	}, []);

	useEffect(() => {
		// 等路由 fallback 与页面初始化的 layout effect 交接完，再撤掉同一个 loading。
		setShowLoading(isPending || loaders.current.size > 0);
	}, [isPending, loaderCount]);

	const navigate = useCallback((href: string) => {
		if (normalizePath(href) === normalizePath(pathname) && !isPending) return;
		setShowLoading(true);
		startTransition(() => {
			setActivePath(href);
			// 正在跳转时点回当前页面，也要发起导航以取消前一次请求。
			router.push(href);
		});
	}, [isPending, pathname, router, setActivePath]);

	const value = useMemo(() => ({
		activePath,
		isLoading,
		navigate,
		registerLoading,
	}), [activePath, isLoading, navigate, registerLoading]);

	return (
		<RouterProvider navigate={navigate}>
			<AdminNavigationContext.Provider value={value}>
				{children}
			</AdminNavigationContext.Provider>
		</RouterProvider>
	);
}

export function useAdminNavigation() {
	const value = useContext(AdminNavigationContext);
	if (!value) throw new Error("AdminNavigationProvider is required");
	return value;
}

export function AdminContent({ children }: { children: ReactNode }) {
	const { isLoading } = useAdminNavigation();
	return (
		<div aria-busy={isLoading} className="min-w-0">
			{isLoading ? <AdminLoadingIndicator /> : null}
			{/* 保留页面挂载，路由和页面内部的加载状态才能正常结束。 */}
			<div hidden={isLoading}>{children}</div>
		</div>
	);
}
