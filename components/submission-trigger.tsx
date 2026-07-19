"use client";

import { Button } from "@heroui/react";
import { useSetAtom } from "jotai";
import { BiBookmarkPlus } from "react-icons/bi";
import { submissionDialogOpenAtom } from "@/lib/store/site";

export function SubmissionSidebarButton() {
	const setOpen = useSetAtom(submissionDialogOpenAtom);
	return (
		<div className="shrink-0 px-4 pt-4">
			<Button
				fullWidth
				variant="outline"
				className="justify-center"
				onPress={() => setOpen(true)}
			>
				<BiBookmarkPlus className="size-4" />
				我要投稿
			</Button>
		</div>
	);
}
