import { Spinner } from "@heroui/react";

export function AdminLoadingIndicator() {
	return (
		<div
			role="status"
			aria-label="加载中"
			className="flex min-h-[calc(100dvh-106px)] flex-col items-center justify-center gap-2"
		>
			<Spinner size="sm" aria-hidden="true" />
			<span className="text-xs text-default-500">加载中...</span>
		</div>
	);
}
