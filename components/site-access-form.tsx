"use client";

import {
    Button,
    FieldError,
    InputGroup,
    Label,
    TextField,
} from "@heroui/react";
import { useState } from "react";
import { BiHide, BiRightArrowAlt, BiShow } from "react-icons/bi";
import { getIconImageSrc } from "@/lib/icon";

export function SiteAccessForm({
	siteName,
	siteLogo,
	siteDescription,
	nextPath,
	isConfigured,
}: {
	siteName: string;
	siteLogo?: string;
	siteDescription?: string;
	nextPath?: string;
	isConfigured: boolean;
}) {
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isPending, setIsPending] = useState(false);
	const [isVisible, setIsVisible] = useState(false);
	const logoSrc = getIconImageSrc(siteLogo);
	const description = siteDescription?.trim();

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!isConfigured || isPending) return;
		setError("");
		setIsPending(true);

		try {
			const response = await fetch("/api/site-access/unlock/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password }),
			});
			const data = (await response.json().catch(() => ({}))) as {
				error?: string;
			};
			if (!response.ok) {
				throw new Error(data.error || `验证失败（${response.status}）`);
			}
			const currentPath = `${window.location.pathname}${window.location.search}`;
			window.location.replace(nextPath || currentPath);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "验证失败，请重试");
		} finally {
			setIsPending(false);
		}
	};

	return (
		<main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-5 py-10 text-foreground">
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_38%),radial-gradient(circle_at_bottom_right,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_42%)]" />
			<div
				className="pointer-events-none absolute inset-0 opacity-35"
				style={{
					backgroundImage:
						"radial-gradient(circle, color-mix(in oklab, var(--foreground) 16%, transparent) 1px, transparent 1px)",
					backgroundSize: "24px 24px",
					maskImage:
						"linear-gradient(to bottom, black, transparent 35%, transparent 65%, black)",
				}}
			/>

			<div className="relative w-full max-w-sm rounded-3xl border border-default-200 bg-background/90 p-7 shadow-2xl shadow-black/8 backdrop-blur-xl sm:p-8 dark:shadow-black/35">
				<div className="mb-8 flex items-center gap-3">
					{logoSrc ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={logoSrc}
							alt={siteName}
							className="size-10 rounded-xl object-contain"
						/>
					) : (
						<div className="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
							{siteName.charAt(0)}
						</div>
					)}
					<div className="min-w-0">
						<p className="truncate text-base font-semibold">{siteName}</p>
						{description ? (
							<p className="line-clamp-2 text-xs leading-5 text-default-500">
								{description}
							</p>
						) : null}
					</div>
				</div>

				<div className="mb-6">
					<h1 className="text-xl font-bold tracking-tight">请输入访问密码</h1>
					<p className="mt-2 text-sm leading-6 text-default-500">
						该站点已开启访问保护，验证通过后才能查看页面内容。
					</p>
				</div>

				<form className="flex flex-col gap-5" onSubmit={onSubmit}>
					<TextField
						name="password"
						value={password}
						onChange={(value) => {
							setPassword(value);
							if (error) setError("");
						}}
						isRequired
						isInvalid={Boolean(error)}
						isDisabled={!isConfigured}
						autoFocus
					>
						<Label>访问密码</Label>
						<InputGroup>
							<InputGroup.Input
								type={isVisible ? "text" : "password"}
								placeholder="请输入访问密码"
								autoComplete="current-password"
							/>
							<InputGroup.Suffix className="pr-0">
								<Button
									isIconOnly
									aria-label={isVisible ? "隐藏密码" : "显示密码"}
									size="sm"
									variant="ghost"
									onPress={() => setIsVisible((value) => !value)}
								>
									{isVisible ? (
										<BiShow className="size-4" />
									) : (
										<BiHide className="size-4" />
									)}
								</Button>
							</InputGroup.Suffix>
						</InputGroup>
						{error ? <FieldError>{error}</FieldError> : null}
					</TextField>

					{!isConfigured ? (
						<p className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
							访问保护尚未配置完成，请联系站点管理员。
						</p>
					) : null}

					<Button
						type="submit"
						variant="primary"
						fullWidth
						isPending={isPending}
						isDisabled={!password || !isConfigured}
					>
						{isPending ? "正在验证…" : "进入网站"}
						{!isPending ? <BiRightArrowAlt className="size-5" /> : null}
					</Button>
				</form>

				<p className="mt-6 text-center text-xs text-default-400">
					验证状态会在此设备上保留 7 天
				</p>
			</div>
		</main>
	);
}
