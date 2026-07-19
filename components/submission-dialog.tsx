"use client";

import {
    Button,
    Form,
    Input,
    Label,
    Modal,
    TextArea,
    TextField,
    toast,
} from "@heroui/react";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import { BiBookmarkPlus, BiEnvelope } from "react-icons/bi";
import type { SubmissionInput } from "@/types";
import {
    normalizeSubmissionInput,
    SUBMISSION_FIELD_LIMITS,
} from "@/lib/submission";
import {
    submissionConfigAtom,
    submissionDialogOpenAtom,
} from "@/lib/store/site";
import type { SubmissionDeploymentMode } from "./submission-dialog-host";

const EMPTY_FORM: SubmissionInput = {
	title: "",
	url: "",
	icon: "",
	description: "",
	submitterName: "",
	contact: "",
	note: "",
	company: "",
};

function isValidEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildMailto(email: string, input: SubmissionInput): string {
	const subject = `网站投稿：${input.title}`;
	const body = [
		`网站名称：${input.title}`,
		`网站地址：${input.url}`,
		`网站图标：${input.icon || "未填写"}`,
		`网站简介：${input.description || "未填写"}`,
		`投稿人：${input.submitterName || "未填写"}`,
		`联系方式：${input.contact || "未填写"}`,
		`补充说明：${input.note || "未填写"}`,
		"",
		"此邮件由 Go Nav 投稿收录功能生成。",
	].join("\n");
	return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function SubmissionDialog({
	deploymentMode,
}: {
	deploymentMode: SubmissionDeploymentMode;
}) {
	const config = useAtomValue(submissionConfigAtom);
	const [isOpen, setIsOpen] = useAtom(submissionDialogOpenAtom);
	const [form, setForm] = useState<SubmissionInput>(EMPTY_FORM);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const isStatic = deploymentMode === "static";

	const patch = (value: Partial<SubmissionInput>) => {
		setForm((current) => ({ ...current, ...value }));
	};

	const close = () => {
		if (!isSubmitting) setIsOpen(false);
	};

	const resetAndClose = () => {
		setForm(EMPTY_FORM);
		setIsOpen(false);
	};

	const submit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isSubmitting) return;
		try {
			const input = normalizeSubmissionInput(form);
			if (!input.title) throw new Error("请填写网站名称");

			if (isStatic) {
				const email = config.staticEmail.trim();
				if (!isValidEmail(email)) {
					throw new Error("站长尚未配置有效的投稿接收邮箱");
				}
				window.location.href = buildMailto(email, input);
				toast.success("已打开邮件客户端，请确认并发送投稿邮件");
				resetAndClose();
				return;
			}

			setIsSubmitting(true);
			const response = await fetch("/api/submissions/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			});
			const data = (await response.json().catch(() => ({}))) as {
				error?: string;
			};
			if (!response.ok) {
				throw new Error(data.error || `提交失败 (${response.status})`);
			}
			toast.success("投稿已提交，等待站长审核");
			resetAndClose();
		} catch (error) {
			toast.danger((error as Error).message || "提交失败");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal>
			<Modal.Backdrop
				isOpen={isOpen && config.enabled}
				isDismissable={!isSubmitting}
				isKeyboardDismissDisabled={isSubmitting}
				onOpenChange={(open) => {
					if (!open) close();
				}}
			>
				<Modal.Container placement="auto" size="md" scroll="inside">
					<Modal.Dialog className="sm:max-w-lg">
						<Modal.CloseTrigger />
						<Modal.Header className="gap-2">
							<Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
								{isStatic ? (
									<BiEnvelope className="size-5" />
								) : (
									<BiBookmarkPlus className="size-5" />
								)}
							</Modal.Icon>
							<Modal.Heading>投稿收录</Modal.Heading>
							<p className="text-sm leading-5 text-muted">
								{isStatic
									? "填写后会唤起你的邮件客户端，由站长手动审核收录"
									: "提交后将进入待审核队列，站长审核通过后会加入对应分类"}
							</p>
						</Modal.Header>

						<Modal.Body className="p-6 mt-3!">
							<Form
								id="site-submission-form"
								className="flex flex-col gap-4"
								onSubmit={submit}
							>
								<input
									tabIndex={-1}
									autoComplete="off"
									aria-hidden="true"
									className="absolute -left-2499.75 h-px w-px opacity-0"
									name="company"
									value={form.company}
									onChange={(event) => patch({ company: event.target.value })}
								/>
								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<TextField
										className="w-full"
										isRequired
										autoFocus
										name="title"
										value={form.title}
										onChange={(title) => patch({ title })}
									>
										<Label>网站名称</Label>
										<Input
											autoComplete="organization"
											placeholder="例如：Go Nav"
											maxLength={SUBMISSION_FIELD_LIMITS.title}
										/>
									</TextField>
									<TextField
										className="w-full"
										isRequired
										name="url"
										value={form.url}
										onChange={(url) => patch({ url })}
									>
										<Label>网站地址</Label>
										<Input
											autoComplete="url"
											inputMode="url"
											placeholder="https://example.com"
											maxLength={SUBMISSION_FIELD_LIMITS.url}
										/>
									</TextField>
								</div>

								<TextField
									className="w-full"
									name="icon"
									value={form.icon}
									onChange={(icon) => patch({ icon })}
								>
									<Label>网站图标（可选）</Label>
									<Input
										placeholder="图标 URL 或 emoji"
										maxLength={SUBMISSION_FIELD_LIMITS.icon}
									/>
								</TextField>

								<TextField
									className="w-full"
									name="description"
									value={form.description}
									onChange={(description) => patch({ description })}
								>
									<Label>网站简介（可选）</Label>
									<TextArea
										fullWidth
										variant="primary"
										rows={3}
										placeholder="简单介绍网站提供的内容或服务"
										maxLength={SUBMISSION_FIELD_LIMITS.description}
									/>
								</TextField>

								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<TextField
										className="w-full"
										name="submitterName"
										value={form.submitterName}
										onChange={(submitterName) => patch({ submitterName })}
									>
										<Label>投稿人（可选）</Label>
										<Input
											autoComplete="name"
											placeholder="你的称呼"
											maxLength={SUBMISSION_FIELD_LIMITS.submitterName}
										/>
									</TextField>
									<TextField
										className="w-full"
										name="contact"
										value={form.contact}
										onChange={(contact) => patch({ contact })}
									>
										<Label>联系方式（可选）</Label>
										<Input
											placeholder="邮箱、微信等"
											maxLength={SUBMISSION_FIELD_LIMITS.contact}
										/>
									</TextField>
								</div>

								<TextField
									className="w-full"
									name="note"
									value={form.note}
									onChange={(note) => patch({ note })}
								>
									<Label>补充说明（可选）</Label>
									<TextArea
										fullWidth
										variant="primary"
										rows={2}
										placeholder="希望站长了解的其他信息"
										maxLength={SUBMISSION_FIELD_LIMITS.note}
									/>
								</TextField>
							</Form>
						</Modal.Body>

						<Modal.Footer>
							<Button
								variant="secondary"
								isDisabled={isSubmitting}
								onPress={close}
							>
								取消
							</Button>
							<Button
								form="site-submission-form"
								type="submit"
								isPending={isSubmitting}
								isDisabled={isSubmitting}
							>
								{isStatic ? <BiEnvelope /> : <BiBookmarkPlus />}
								{isSubmitting
									? "提交中..."
									: isStatic
										? "发送投稿邮件"
										: "提交投稿"}
							</Button>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
