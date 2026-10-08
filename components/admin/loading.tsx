"use client";

import { useContext, useLayoutEffect } from "react";
import { AdminNavigationContext } from "./navigation";
import { AdminLoadingIndicator } from "./loading-indicator";

export default function Loading() {
	const navigation = useContext(AdminNavigationContext);
	const registerLoading = navigation?.registerLoading;
	useLayoutEffect(() => registerLoading?.(), [registerLoading]);

	// 后台路由和编辑器共用外壳的 loading，避免切换阶段时重复闪烁。
	return navigation ? null : <AdminLoadingIndicator />;
}
