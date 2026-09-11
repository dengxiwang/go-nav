"use client";

import {
	Button,
	Input,
	InputGroup,
	Label,
	Link,
	TextField,
	toast,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
	const [loading, setLoading] = useState(false);
	const [showPwd, setShowPwd] = useState(false);
	const logoSrc = getIconImageSrc(websiteLogo);

	const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);
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
			router.push("/admin");
			// 登录接口更新 cookie 后，刷新目标路由的服务端鉴权和配置。
			router.refresh();
		} catch (err) {
			toast.danger("登录失败", {
				description: (err as Error).message,
			});
		} finally {
			setLoading(false);
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

			<form onSubmit={onSubmit} className="flex flex-col gap-5">
				<TextField
					value={username}
					onChange={setUsername}
					isRequired
					name="username"
				>
					<Label>用户名</Label>
					<Input placeholder="admin" autoComplete="username" />
				</TextField>

				<TextField
					value={password}
					onChange={setPassword}
					isRequired
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
					className="mt-1 w-full"
				>
					{loading ? "登录中..." : "登录"}
				</Button>
			</form>

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
