"use client";

import { SubmissionDialog } from "./submission-dialog";

export type SubmissionDeploymentMode = "server" | "static" | "html";

/** 保持受控 Modal 常驻；首次打开时再挂载会破坏 React Aria 的焦点与滚动状态。 */
export function SubmissionDialogHost({
	deploymentMode,
}: {
	deploymentMode: SubmissionDeploymentMode;
}) {
	return <SubmissionDialog deploymentMode={deploymentMode} />;
}
