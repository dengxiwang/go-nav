"use client";

import {
	Button,
	Input,
	InputGroup,
	Label,
	Link,
	Spinner,
	TextField,
	toast,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { BiShow, BiHide } from "react-icons/bi";
import { getIconImageSrc } from "@/lib/icon";

interface LoginFormProps {
	websiteName: string;
	websiteLogo?: string;
	showBrand?: boolean;
}

export function LoginForm({
	websiteName,
	websiteLogo,
	showBrand,
}: LoginFormProps) {
	const router = useRouter();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [status, setStatus] = useState<"idle" | "submitting" | "navigating">(
		"idle",
	);
	const [isNavigating, startNavigation] = useTransition();
	const submittingRef = useRef(false);
	const [showPwd, setShowPwd] = useState(false);
	const logoSrc = getIconImageSrc(websiteLogo);
	const loading = status !== "idle" || isNavigating;

	const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (submittingRef.current) return;
		submittingRef.current = true;
		setStatus("submitting");
		try {
			const res = await fetch("/api/auth/login/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error || `登录失败 (${res.status})`);
			}
			// 成功提示持续到后台挂载，覆盖鉴权、路由响应和页面代码加载。
			setStatus("navigating");
			startNavigation(() => {
				router.replace("/admin/categories/");
				// 登录接口更新 cookie 后，重新读取服务端鉴权和配置。
				router.refresh();
			});
		} catch (err) {
			submittingRef.current = false;
			setStatus("idle");
			toast.danger("登录失败", {
				description: (err as Error).message,
			});
		}
	};

	return (
		<div className="w-full max-w-sm">
			{showBrand ? (
				<div className="mb-6 flex items-center gap-3">
					{logoSrc ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={logoSrc}
							alt={websiteName}
							className="h-8 w-8 rounded-lg object-contain"
						/>
					) : (
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-center text-sm font-bold text-primary-foreground">
							{websiteName.charAt(0)}
						</div>
					)}
					<span className="text-lg! font-bold">{websiteName}</span>
				</div>
			) : null}

			<div className="mb-8 ">
				<h1 className="text-2xl font-bold">管理员登录</h1>
				<p className="mt-1 text-sm text-default-500">
					输入您的账号和密码登录管理后台
				</p>
			</div>

			<div className="relative">
				<form
					onSubmit={onSubmit}
					className={`flex flex-col gap-5${status === "navigating" ? " invisible" : ""}`}
					inert={status === "navigating"}
					aria-busy={loading}
				>
					<TextField
						value={username}
						onChange={setUsername}
						isRequired
						isDisabled={loading}
						name="username"
					>
						<Label>用户名</Label>
						<Input placeholder="admin" autoComplete="username" />
					</TextField>

					<TextField
						value={password}
						onChange={setPassword}
						isRequired
						isDisabled={loading}
						name="password"
					>
						<Label>密码</Label>
						<InputGroup>
							<InputGroup.Input
								type={showPwd ? "text" : "password"}
								placeholder="••••••••"
								autoComplete="current-password"
							/>
							<InputGroup.Suffix className="pr-0">
								<Button
									isIconOnly
									aria-label={showPwd ? "隐藏密码" : "显示密码"}
									size="sm"
									variant="ghost"
									isDisabled={loading}
									onPress={() => setShowPwd(!showPwd)}
								>
									{showPwd ? (
										<BiShow className="size-4" />
									) : (
										<BiHide className="size-4" />
									)}
								</Button>
							</InputGroup.Suffix>
						</InputGroup>
					</TextField>

					<Button
						type="submit"
						variant="primary"
						isDisabled={loading}
						isPending={loading}
						className="mt-1 w-full"
					>
						{loading ? <Spinner color="current" size="sm" /> : null}
						{loading ? "登录中..." : "登录"}
					</Button>
				</form>
				{status === "navigating" ? (
					<div
						role="status"
						className="absolute inset-0 flex flex-col items-center justify-center gap-3"
					>
						<Spinner size="md" color="accent" />
						<p className="text-sm text-default-500">登录成功，正在进入后台…</p>
					</div>
				) : null}
			</div>

			<p className="text-center text-xs mt-6 font-medium">
				基于开源项目：
				<Link
					href="https://github.com/dengxiwang/go-nav"
					className="text-xs text-primary"
				>
					github.com/dengxiwang/go-nav
					<Link.Icon />
				</Link>
			</p>
		</div>
	);
}
