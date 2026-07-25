"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { submissionDialogOpenAtom } from "@/lib/store/site";

export type SubmissionDeploymentMode = "server" | "static" | "html";

const loadSubmissionDialog = () =>
	import("./submission-dialog").then((mod) => mod.SubmissionDialog);

const LazySubmissionDialog = dynamic(loadSubmissionDialog);

/** 浏览器空闲后预下载投稿代码，首次打开时才挂载和水合 Modal。 */
export function SubmissionDialogHost({
	deploymentMode,
}: {
	deploymentMode: SubmissionDeploymentMode;
}) {
	const isOpen = useAtomValue(submissionDialogOpenAtom);

	useEffect(() => {
		const preload = () => {
			void loadSubmissionDialog();
		};
		const requestIdle = window.requestIdleCallback;
		if (typeof requestIdle === "function") {
			const idleId = requestIdle(preload, { timeout: 1500 });
			return () => window.cancelIdleCallback(idleId);
		}

		const timeoutId = window.setTimeout(preload, 1);
		return () => window.clearTimeout(timeoutId);
	}, []);

	return isOpen ? <LazySubmissionDialog deploymentMode={deploymentMode} /> : null;
}
