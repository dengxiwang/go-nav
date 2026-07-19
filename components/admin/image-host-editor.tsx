"use client";

import type { Key } from "@heroui/react";
import {
	Button,
	Card,
	Chip,
	Input,
	Label,
	ListBox,
	Select,
	Spinner,
	Tabs,
	TextField,
	toast,
} from "@heroui/react";
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	BiCheckCircle,
	BiCloudUpload,
	BiGitBranch,
	BiImage,
	BiSave,
	BiXCircle,
} from "react-icons/bi";
import { navAtom } from "@/lib/store/admin";
import { AdminSwitch } from "./admin-switch";

type ImageHostMode = "local" | "webdav" | "github" | "s3" | "oss" | "multi";
type ImageHostReturnUrlMode = "relative" | "absolute";

interface PublicImageHostConfig {
	mode: ImageHostMode;
	pathTemplate: string;
	publicUrlPrefix: string;
	returnUrlMode: ImageHostReturnUrlMode;
	github: {
		repo: string;
		branch: string;
		publicUrlPrefix: string;
		commitMessage: string;
		hasToken: boolean;
	};
	webdav: {
		url: string;
		publicUrlPrefix: string;
		username: string;
		hasPassword: boolean;
	};
	s3: {
		endpoint: string;
		region: string;
		bucket: string;
		publicUrlPrefix: string;
		accessKeyId: string;
		forcePathStyle: boolean;
		hasSecretAccessKey: boolean;
	};
	oss: {
		endpoint: string;
		bucket: string;
		publicUrlPrefix: string;
		accessKeyId: string;
		hasAccessKeySecret: boolean;
	};
}

interface ImageHostDraft extends PublicImageHostConfig {
	github: PublicImageHostConfig["github"] & { token: string };
	webdav: PublicImageHostConfig["webdav"] & { password: string };
	s3: PublicImageHostConfig["s3"] & { secretAccessKey: string };
	oss: PublicImageHostConfig["oss"] & { accessKeySecret: string };
}

const DEFAULT_DRAFT: ImageHostDraft = {
	mode: "local",
	pathTemplate: "/img/{yyyy}/{m}/{d}",
	publicUrlPrefix: "",
	returnUrlMode: "relative",
	github: {
		repo: "",
		branch: "main",
		publicUrlPrefix: "",
		token: "",
		commitMessage: "chore: upload Go Nav image",
		hasToken: false,
	},
	webdav: {
		url: "",
		publicUrlPrefix: "",
		username: "",
		password: "",
		hasPassword: false,
	},
	s3: {
		endpoint: "",
		region: "auto",
		bucket: "",
		publicUrlPrefix: "",
		accessKeyId: "",
		secretAccessKey: "",
		forcePathStyle: true,
		hasSecretAccessKey: false,
	},
	oss: {
		endpoint: "",
		bucket: "",
		publicUrlPrefix: "",
		accessKeyId: "",
		accessKeySecret: "",
		hasAccessKeySecret: false,
	},
};

const MODES: Array<{ id: ImageHostMode; name: string }> = [
	{ id: "local", name: "本地 uploads" },
	{ id: "webdav", name: "WebDAV 图床" },
	{ id: "github", name: "GitHub 图床" },
	{ id: "s3", name: "S3 兼容对象存储" },
	{ id: "oss", name: "阿里云 OSS" },
	{ id: "multi", name: "多图床策略（上传所有已配置图床）" },
];

const RETURN_MODES: Array<{ id: ImageHostReturnUrlMode; name: string }> = [
	{ id: "relative", name: "相对路径 /img/..." },
	{ id: "absolute", name: "完整图片链接" },
];

function draftFromConfig(config: PublicImageHostConfig): ImageHostDraft {
	return {
		...config,
		github: {
			...config.github,
			token: "",
		},
		webdav: {
			...config.webdav,
			password: "",
		},
		s3: {
			...config.s3,
			secretAccessKey: "",
		},
		oss: {
			...config.oss,
			accessKeySecret: "",
		},
	};
}

function Field({
	label,
	description,
	children,
}: {
	label: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-2">
			<Label className="text-sm font-medium">{label}</Label>
			{children}
			{description && (
				<p className="text-xs text-default-500 truncate" title={description}>
					{description}
				</p>
			)}
		</div>
	);
}

function parseGitHubRepo(
	input: string,
): { owner: string; repo: string } | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	const urlMatch = trimmed.match(
		/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/?#].*)?$/i,
	);
	if (urlMatch?.[1] && urlMatch[2]) {
		return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/i, "") };
	}
	const shortMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
	if (shortMatch?.[1] && shortMatch[2]) {
		return { owner: shortMatch[1], repo: shortMatch[2].replace(/\.git$/i, "") };
	}
	return null;
}

function buildGitHubRawPrefix(repo: string, branch: string): string {
	const parsed = parseGitHubRepo(repo);
	if (!parsed) return "";
	return `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch || "main"}`;
}

export function ImageHostEditor() {
	const [nav, setNav] = useAtom(navAtom);
	const [draft, setDraft] = useState<ImageHostDraft>(DEFAULT_DRAFT);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const githubRawPrefix = useMemo(
		() => buildGitHubRawPrefix(draft.github.repo, draft.github.branch),
		[draft.github.branch, draft.github.repo],
	);
	const webdavPublicPrefix = draft.webdav.publicUrlPrefix.trim();
	const githubPublicPrefix =
		draft.github.publicUrlPrefix.trim() || githubRawPrefix;
	const s3PublicPrefix = draft.s3.publicUrlPrefix.trim();
	const ossPublicPrefix = draft.oss.publicUrlPrefix.trim();
	const selectedModePublicPrefix =
		draft.mode === "webdav"
			? webdavPublicPrefix
			: draft.mode === "github"
				? githubPublicPrefix
				: draft.mode === "s3"
					? s3PublicPrefix
					: draft.mode === "oss"
						? ossPublicPrefix
						: draft.publicUrlPrefix.trim();
	const webdavConfigured =
		draft.webdav.url.trim() &&
		draft.webdav.username.trim() &&
		(draft.webdav.password || draft.webdav.hasPassword);
	const githubConfigured =
		draft.github.repo.trim() &&
		draft.github.branch.trim() &&
		(draft.github.token || draft.github.hasToken);
	const s3Configured =
		draft.s3.endpoint.trim() &&
		draft.s3.region.trim() &&
		draft.s3.bucket.trim() &&
		draft.s3.accessKeyId.trim() &&
		(draft.s3.secretAccessKey || draft.s3.hasSecretAccessKey);
	const ossConfigured =
		draft.oss.endpoint.trim() &&
		draft.oss.bucket.trim() &&
		draft.oss.accessKeyId.trim() &&
		(draft.oss.accessKeySecret || draft.oss.hasAccessKeySecret);
	const webdavReady = Boolean(
		webdavConfigured && draft.webdav.publicUrlPrefix.trim(),
	);
	const githubReady = Boolean(
		githubConfigured && draft.github.publicUrlPrefix.trim(),
	);
	const s3Ready = Boolean(s3Configured && draft.s3.publicUrlPrefix.trim());
	const ossReady = Boolean(ossConfigured && draft.oss.publicUrlPrefix.trim());
	const partialWebdav =
		Boolean(
			draft.webdav.url.trim() ||
			draft.webdav.username.trim() ||
			draft.webdav.password ||
			draft.webdav.hasPassword ||
			draft.webdav.publicUrlPrefix.trim(),
		) && !Boolean(webdavConfigured);
	const partialGithub =
		Boolean(
			draft.github.repo.trim() ||
			draft.github.token ||
			draft.github.hasToken ||
			draft.github.publicUrlPrefix.trim(),
		) && !Boolean(githubConfigured);
	const partialS3 =
		Boolean(
			draft.s3.endpoint.trim() ||
			draft.s3.bucket.trim() ||
			draft.s3.accessKeyId.trim() ||
			draft.s3.secretAccessKey ||
			draft.s3.hasSecretAccessKey ||
			draft.s3.publicUrlPrefix.trim(),
		) && !Boolean(s3Configured);
	const partialOss =
		Boolean(
			draft.oss.endpoint.trim() ||
			draft.oss.bucket.trim() ||
			draft.oss.accessKeyId.trim() ||
			draft.oss.accessKeySecret ||
			draft.oss.hasAccessKeySecret ||
			draft.oss.publicUrlPrefix.trim(),
		) && !Boolean(ossConfigured);
	const remoteReady =
		draft.mode === "local"
			? true
			: draft.mode === "multi"
				? Boolean(
						draft.returnUrlMode === "relative" &&
						draft.publicUrlPrefix.trim() &&
						(webdavReady || githubReady || s3Ready || ossReady) &&
						!partialWebdav &&
						!partialGithub &&
						!partialS3 &&
						!partialOss,
					)
				: draft.mode === "webdav"
					? Boolean(
							(draft.returnUrlMode !== "relative" ||
								Boolean(selectedModePublicPrefix)) &&
							webdavReady,
						)
					: draft.mode === "github"
						? Boolean(
								(draft.returnUrlMode !== "relative" ||
									Boolean(selectedModePublicPrefix)) &&
								githubReady,
							)
						: draft.mode === "s3"
							? Boolean(
									(draft.returnUrlMode !== "relative" ||
										Boolean(selectedModePublicPrefix)) &&
									s3Ready,
								)
							: Boolean(
									(draft.returnUrlMode !== "relative" ||
										Boolean(selectedModePublicPrefix)) &&
									ossReady,
								);
	const modeEnabled = {
		local: true,
		webdav: webdavReady,
		github: githubReady,
		s3: s3Ready,
		oss: ossReady,
		multi: webdavReady || githubReady || s3Ready || ossReady,
	} as const;
	const prefixSourceValue =
		webdavPublicPrefix && draft.publicUrlPrefix.trim() === webdavPublicPrefix
			? "webdav"
			: githubPublicPrefix &&
				  draft.publicUrlPrefix.trim() === githubPublicPrefix
				? "github"
				: s3PublicPrefix && draft.publicUrlPrefix.trim() === s3PublicPrefix
					? "s3"
					: ossPublicPrefix && draft.publicUrlPrefix.trim() === ossPublicPrefix
						? "oss"
						: null;

	const loadConfig = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/image-host/config/", { method: "GET" });
			const data = (await res.json().catch(() => ({}))) as
				| PublicImageHostConfig
				| { error?: string };
			if (!res.ok) {
				throw new Error(
					"error" in data ? data.error : `读取失败 (${res.status})`,
				);
			}
			setDraft(draftFromConfig(data as PublicImageHostConfig));
		} catch (e) {
			toast.danger((e as Error).message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadConfig();
	}, [loadConfig]);

	useEffect(() => {
		if (
			(draft.mode !== "multi" && draft.mode !== "local") ||
			draft.returnUrlMode === "relative"
		) {
			return;
		}
		setDraft((prev) => ({ ...prev, returnUrlMode: "relative" }));
	}, [draft.mode, draft.returnUrlMode]);

	const saveConfig = useCallback(async () => {
		setSaving(true);
		try {
			const res = await fetch("/api/image-host/config/", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					mode: draft.mode,
					pathTemplate: draft.pathTemplate,
					publicUrlPrefix: selectedModePublicPrefix,
					returnUrlMode: draft.returnUrlMode,
					github: {
						repo: draft.github.repo,
						branch: draft.github.branch,
						publicUrlPrefix: draft.github.publicUrlPrefix,
						token: draft.github.token,
						commitMessage: draft.github.commitMessage,
					},
					webdav: {
						url: draft.webdav.url,
						publicUrlPrefix: draft.webdav.publicUrlPrefix,
						username: draft.webdav.username,
						password: draft.webdav.password,
					},
					s3: {
						endpoint: draft.s3.endpoint,
						region: draft.s3.region,
						bucket: draft.s3.bucket,
						publicUrlPrefix: draft.s3.publicUrlPrefix,
						accessKeyId: draft.s3.accessKeyId,
						secretAccessKey: draft.s3.secretAccessKey,
						forcePathStyle: draft.s3.forcePathStyle,
					},
					oss: {
						endpoint: draft.oss.endpoint,
						bucket: draft.oss.bucket,
						publicUrlPrefix: draft.oss.publicUrlPrefix,
						accessKeyId: draft.oss.accessKeyId,
						accessKeySecret: draft.oss.accessKeySecret,
					},
				}),
			});
			const data = (await res.json().catch(() => ({}))) as
				| PublicImageHostConfig
				| { error?: string };
			if (!res.ok) {
				throw new Error(
					"error" in data ? data.error : `保存失败 (${res.status})`,
				);
			}
			setDraft(draftFromConfig(data as PublicImageHostConfig));
			toast.success("图床配置已保存");
		} catch (e) {
			toast.danger((e as Error).message);
		} finally {
			setSaving(false);
		}
	}, [draft, selectedModePublicPrefix]);

	if (loading) {
		return (
			<div
				className="flex flex-col items-center justify-center gap-2"
				style={{ height: "calc(100dvh - 106px)" }}
			>
				<Spinner size="sm" />
				<span className="text-xs text-default-500">正在读取图床配置...</span>
			</div>
		);
	}

	return (
		<div
			className="flex flex-col gap-4"
			style={{ minHeight: "calc(100dvh - 106px)" }}
		>
			<section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div className="flex min-w-0 flex-col gap-2">
					<div className="flex flex-col gap-1">
						<h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
							图床设置
						</h3>
						<p className="text-xs text-default-500">
							配置上传目标、图片前缀和生成策略。默认本地模式不改变现有
							<code>/uploads</code> 行为。
						</p>
					</div>
					<div className="flex flex-wrap gap-2 text-xs">
						<Chip
							variant="secondary"
							className={
								remoteReady
									? "text-success border-success/40"
									: "text-danger border-danger/40"
							}
						>
							<Chip.Label className="inline-flex items-center gap-1">
								{remoteReady ? (
									<BiCheckCircle className="size-3.5" />
								) : (
									<BiXCircle className="size-3.5" />
								)}
								{remoteReady ? "当前配置可用" : "当前配置未完整"}
							</Chip.Label>
						</Chip>
						<Chip variant="secondary">
							<Chip.Label className="inline-flex items-center gap-1">
								<BiImage className="size-3.5" />
								{MODES.find((mode) => mode.id === draft.mode)?.name}
							</Chip.Label>
						</Chip>
					</div>
				</div>
				<Button
					variant="primary"
					isPending={saving}
					isDisabled={saving}
					onPress={() => void saveConfig()}
					className="shrink-0"
				>
					<BiSave data-icon="inline-start" />
					{saving ? "保存中..." : "保存图床配置"}
				</Button>
			</section>

			<Tabs className="w-full" defaultSelectedKey="upload">
				<Tabs.ListContainer>
					<Tabs.List aria-label="图床设置分组" className="w-fit">
						<Tabs.Tab id="upload">
							上传配置
							<Tabs.Indicator />
						</Tabs.Tab>
						<Tabs.Tab id="host">
							图床配置
							<Tabs.Indicator />
						</Tabs.Tab>
					</Tabs.List>
				</Tabs.ListContainer>

				<Tabs.Panel id="upload" className="px-0">
					<div className="flex flex-col gap-4">
						<Card variant="secondary" className="gap-4">
							<Card.Header>
								<Card.Title>上传策略</Card.Title>
								<Card.Description>控制图片路径和返回地址。</Card.Description>
							</Card.Header>
							<Card.Content className="grid grid-cols-1 gap-4 lg:grid-cols-2">
								<Select
									value={draft.mode}
									onChange={(value: Key | null) => {
										if (!value) return;
										const nextMode = String(value) as ImageHostMode;
										setDraft((prev) => ({
											...prev,
											mode: nextMode,
											returnUrlMode:
												nextMode === "multi" || nextMode === "local"
													? "relative"
													: prev.returnUrlMode,
										}));
									}}
								>
									<Label>存储模式</Label>
									<Select.Trigger>
										<Select.Value />
										<Select.Indicator />
									</Select.Trigger>
									<Select.Popover>
										<ListBox>
											{MODES.map((mode) => (
												<ListBox.Item
													key={mode.id}
													id={mode.id}
													textValue={mode.name}
													isDisabled={!modeEnabled[mode.id]}
												>
													{mode.name}
													<ListBox.ItemIndicator />
												</ListBox.Item>
											))}
										</ListBox>
									</Select.Popover>
								</Select>

								<Select
									value={draft.returnUrlMode}
									isDisabled={draft.mode === "multi" || draft.mode === "local"}
									onChange={(value: Key | null) => {
										if (!value) return;
										setDraft((prev) => ({
											...prev,
											returnUrlMode: String(value) as ImageHostReturnUrlMode,
										}));
									}}
								>
									<Label>写入 JSON 的图片地址</Label>
									<Select.Trigger>
										<Select.Value />
										<Select.Indicator />
									</Select.Trigger>
									<Select.Popover>
										<ListBox>
											{RETURN_MODES.map((mode) => (
												<ListBox.Item
													key={mode.id}
													id={mode.id}
													textValue={mode.name}
													isDisabled={
														(draft.mode === "multi" ||
															draft.mode === "local") &&
														mode.id === "absolute"
													}
												>
													{mode.name}
													<ListBox.ItemIndicator />
												</ListBox.Item>
											))}
										</ListBox>
									</Select.Popover>
								</Select>

								{draft.mode !== "local" ? (
									<Field
										label="上传路径模板"
										description="相对路径模式需要以 /img 开头，例如 /img/{yyyy}/{m}/{d}。"
									>
										<TextField
											value={draft.pathTemplate}
											onChange={(pathTemplate) =>
												setDraft((prev) => ({ ...prev, pathTemplate }))
											}
										>
											<Label className="sr-only">上传路径模板</Label>
											<Input placeholder="/img/{yyyy}/{m}/{d}" />
										</TextField>
									</Field>
								) : (
									<Field
										label="上传路径模板"
										description="本地 uploads 模式固定写入 /uploads/...，无需配置上传路径模板。"
									>
										<div className="h-9 rounded-xl! border border-default-200 bg-default-100 px-3 text-sm leading-9 text-default-500">
											/uploads/*
										</div>
									</Field>
								)}

								<Field
									label="图片链接前缀"
									description="仅多图床策略可编辑，用于相对路径模式的统一对外访问域名。"
								>
									<div className="flex gap-2">
										<TextField
											className="flex-1 w-full"
											value={
												draft.mode === "multi"
													? draft.publicUrlPrefix
													: selectedModePublicPrefix
											}
											onChange={(publicUrlPrefix) =>
												setDraft((prev) => ({ ...prev, publicUrlPrefix }))
											}
										>
											<Label className="sr-only">图片链接前缀</Label>
											<Input
												placeholder="https://example.com/d"
												disabled={draft.mode !== "multi"}
											/>
										</TextField>
										<Select
											className={"max-w-32 w-full"}
											value={prefixSourceValue}
											isDisabled={draft.mode !== "multi"}
											onChange={(value: Key | null) => {
												if (!value) return;
												if (String(value) === "webdav" && webdavPublicPrefix) {
													setDraft((prev) => ({
														...prev,
														publicUrlPrefix: webdavPublicPrefix,
													}));
													return;
												}
												if (String(value) === "github" && githubPublicPrefix) {
													setDraft((prev) => ({
														...prev,
														publicUrlPrefix: githubPublicPrefix,
													}));
													return;
												}
												if (String(value) === "s3" && s3PublicPrefix) {
													setDraft((prev) => ({
														...prev,
														publicUrlPrefix: s3PublicPrefix,
													}));
													return;
												}
												if (String(value) === "oss" && ossPublicPrefix) {
													setDraft((prev) => ({
														...prev,
														publicUrlPrefix: ossPublicPrefix,
													}));
												}
											}}
										>
											<Select.Trigger>
												<Select.Value className={"truncate"} />
												<Select.Indicator />
											</Select.Trigger>
											<Select.Popover>
												<ListBox>
													<ListBox.Item
														id="webdav"
														textValue="WebDAV 前缀"
														isDisabled={!webdavPublicPrefix}
													>
														WebDAV 前缀
														<ListBox.ItemIndicator />
													</ListBox.Item>
													<ListBox.Item
														id="github"
														textValue="GitHub 前缀"
														isDisabled={!githubPublicPrefix}
													>
														GitHub 前缀
														<ListBox.ItemIndicator />
													</ListBox.Item>
													<ListBox.Item
														id="s3"
														textValue="S3 前缀"
														isDisabled={!s3PublicPrefix}
													>
														S3 前缀
														<ListBox.ItemIndicator />
													</ListBox.Item>
													<ListBox.Item
														id="oss"
														textValue="OSS 前缀"
														isDisabled={!ossPublicPrefix}
													>
														OSS 前缀
														<ListBox.ItemIndicator />
													</ListBox.Item>
												</ListBox>
											</Select.Popover>
										</Select>
									</div>
								</Field>
							</Card.Content>
						</Card>

						<Card variant="secondary" className="gap-4">
							<Card.Header>
								<Card.Title>上传图片处理</Card.Title>
								<Card.Description>
									控制图片上传时的压缩与统一转码策略。
								</Card.Description>
							</Card.Header>
							<Card.Content className="flex flex-col gap-4">
								<div className="flex flex-col gap-2">
									<AdminSwitch
										isSelected={nav.imageUpload?.compress === true}
										onChange={(selected) =>
											setNav({
												...nav,
												imageUpload: {
													...(nav.imageUpload ?? {}),
													compress: selected,
												},
											})
										}
									>
										<span className="text-sm">上传时压缩图片</span>
									</AdminSwitch>
									<p className="text-xs text-default-500">
										默认关闭。开启后会对图标、预览图和自动抓取的图片执行尺寸与体积优化；关闭时保留原始文件内容。
									</p>
								</div>
								<div className="flex flex-col gap-2">
									<AdminSwitch
										isSelected={nav.imageUpload?.convertToWebp === true}
										onChange={(selected) =>
											setNav({
												...nav,
												imageUpload: {
													...(nav.imageUpload ?? {}),
													convertToWebp: selected,
												},
											})
										}
									>
										<span className="text-sm">
											上传时尽量统一转换成 WebP
										</span>
									</AdminSwitch>
									<p className="text-xs text-default-500">
										开启后，PNG / JPG / WebP / SVG 会优先转成 WebP
										再保存；自动抓取 favicon
										时也会遵守这个设置。即使关闭压缩，开启转码仍会重新编码对应图片。
									</p>
								</div>
								<p className="text-xs text-default-500">
									以上开关属于站点全局配置，请点击顶部保存按钮生效。
								</p>
							</Card.Content>
						</Card>

						<div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
							<p className="mb-1.5 font-semibold">上传策略说明</p>
							<ul className="list-disc list-inside space-y-1">
								<li className="mt-1">
									系统会对上传后的最终图片内容计算
									MD5。若检测到相同文件，默认直接返回已存在路径，不重复上传。
								</li>
								<li className="mt-1">
									压缩默认关闭；压缩与 WebP 转换都关闭时，系统会保存原始图片内容，不做重新编码。
								</li>
								<li className="mt-1">
									开启压缩后，仅对可安全重编码的图片执行智能优化；如果压缩收益很小，会继续保留原图。
								</li>
								<li className="mt-1">
									在多图床策略下，如果某个图床缺失该文件，会自动补传缺失端，并继续复用同一路径。
								</li>
								<li className="mt-1">
									多图床策略会同时上传所有已完整配置的图床；该模式仅支持相对路径写入
									JSON。
								</li>
							</ul>
						</div>
					</div>
				</Tabs.Panel>

				<Tabs.Panel id="host" className="px-0">
					<div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
						<Card variant="secondary" className="h-full gap-4">
							<Card.Header>
								<div className="flex items-center gap-2">
									<BiCloudUpload className="size-5 text-emerald-600 dark:text-emerald-300" />
									<div>
										<Card.Title>WebDAV 图床</Card.Title>
										<Card.Description>
											适配 Alist / OpenList / Nextcloud 等 WebDAV 存储。
										</Card.Description>
									</div>
								</div>
							</Card.Header>
							<Card.Content className="grid grid-cols-1 content-start! gap-4 md:grid-cols-2">
								<div className="md:col-span-2">
									<Field label="WebDAV 地址">
										<TextField
											value={draft.webdav.url}
											onChange={(url) =>
												setDraft((prev) => ({
													...prev,
													webdav: { ...prev.webdav, url },
												}))
											}
										>
											<Label className="sr-only">WebDAV 地址</Label>
											<Input placeholder="http://127.0.0.1:5244/dav" />
										</TextField>
									</Field>
								</div>
								<div className="md:col-span-2">
									<Field
										label="图片访问前缀（必填）"
										description="填写后用于生成可访问的完整地址，例如 https://example.com/d"
									>
										<TextField
											value={draft.webdav.publicUrlPrefix}
											onChange={(publicUrlPrefix) =>
												setDraft((prev) => ({
													...prev,
													webdav: { ...prev.webdav, publicUrlPrefix },
												}))
											}
										>
											<Label className="sr-only">WebDAV 图片访问前缀</Label>
											<Input placeholder="https://example.com/d" />
										</TextField>
									</Field>
								</div>
								<Field label="用户名">
									<TextField
										value={draft.webdav.username}
										onChange={(username) =>
											setDraft((prev) => ({
												...prev,
												webdav: { ...prev.webdav, username },
											}))
										}
									>
										<Label className="sr-only">WebDAV 用户名</Label>
										<Input
											autoComplete="username"
											placeholder="WebDAV 用户名"
										/>
									</TextField>
								</Field>
								<Field label="密码 / 应用密码">
									<TextField
										value={draft.webdav.password}
										onChange={(password) =>
											setDraft((prev) => ({
												...prev,
												webdav: { ...prev.webdav, password },
											}))
										}
									>
										<Label className="sr-only">WebDAV 密码</Label>
										<Input
											type="password"
											autoComplete="current-password"
											placeholder="WebDAV 密码或应用专用密码"
										/>
									</TextField>
									<p className="text-xs text-default-500">
										<span
											className={`${
												draft.webdav.hasPassword
													? "text-success"
													: "text-warning"
											} font-medium`}
										>
											{draft.webdav.hasPassword
												? "已保存密码，留空保持不变"
												: "尚未保存密码"}
										</span>
									</p>
								</Field>
							</Card.Content>
						</Card>

						<Card variant="secondary" className="h-full gap-4">
							<Card.Header>
								<div className="flex items-center gap-2">
									<BiGitBranch className="size-5 text-blue-600 dark:text-blue-300" />
									<div>
										<Card.Title>GitHub 图床</Card.Title>
										<Card.Description>
											建议使用独立图片仓库，例如 owner/go-nav-img。
										</Card.Description>
									</div>
								</div>
							</Card.Header>
							<Card.Content className="grid grid-cols-1 content-start! gap-4 md:grid-cols-2">
								<Field label="仓库">
									<TextField
										value={draft.github.repo}
										onChange={(repo) =>
											setDraft((prev) => ({
												...prev,
												github: { ...prev.github, repo },
											}))
										}
									>
										<Label className="sr-only">GitHub 仓库</Label>
										<Input placeholder="dengxiwang/go-nav-img" />
									</TextField>
								</Field>
								<Field label="分支">
									<TextField
										value={draft.github.branch}
										onChange={(branch) =>
											setDraft((prev) => ({
												...prev,
												github: { ...prev.github, branch },
											}))
										}
									>
										<Label className="sr-only">GitHub 分支</Label>
										<Input placeholder="main" />
									</TextField>
								</Field>
								<div className="md:col-span-2">
									<Field
										label="图片访问前缀（必填）"
										description="填写后用于生成可访问的完整地址，例如 https://raw.githubusercontent.com/owner/repo/main"
									>
										<TextField
											value={draft.github.publicUrlPrefix}
											onChange={(publicUrlPrefix) =>
												setDraft((prev) => ({
													...prev,
													github: { ...prev.github, publicUrlPrefix },
												}))
											}
										>
											<Label className="sr-only">GitHub 图片访问前缀</Label>
											<Input placeholder="https://raw.githubusercontent.com/owner/repo/main" />
										</TextField>
									</Field>
								</div>
								<Field label="GitHub Token">
									<TextField
										value={draft.github.token}
										onChange={(token) =>
											setDraft((prev) => ({
												...prev,
												github: { ...prev.github, token },
											}))
										}
									>
										<Label className="sr-only">GitHub Token</Label>
										<Input
											type="password"
											autoComplete="off"
											placeholder="Contents 读写权限"
										/>
									</TextField>
									<p className="text-xs text-default-500">
										<span
											className={`${
												draft.github.hasToken ? "text-success" : "text-warning"
											} font-medium`}
										>
											{draft.github.hasToken
												? "已保存 Token，留空保持不变"
												: "尚未保存 Token"}
										</span>
									</p>
								</Field>
								<Field label="提交信息">
									<TextField
										value={draft.github.commitMessage}
										onChange={(commitMessage) =>
											setDraft((prev) => ({
												...prev,
												github: { ...prev.github, commitMessage },
											}))
										}
									>
										<Label className="sr-only">GitHub 提交信息</Label>
										<Input placeholder="chore: upload Go Nav image" />
									</TextField>
								</Field>
							</Card.Content>
						</Card>

						<Card variant="secondary" className="h-full gap-4">
							<Card.Header>
								<div className="flex items-center gap-2">
									<BiCloudUpload className="size-5 text-cyan-600 dark:text-cyan-300" />
									<div>
										<Card.Title>S3 兼容对象存储</Card.Title>
										<Card.Description>
											适配 MinIO、Cloudflare R2、AWS S3 等 S3 API。
										</Card.Description>
									</div>
								</div>
							</Card.Header>
							<Card.Content className="grid grid-cols-1 content-start! gap-4 md:grid-cols-2">
								<div className="md:col-span-2">
									<Field
										label="Endpoint"
										description="例如 https://s3.amazonaws.com、https://<account>.r2.cloudflarestorage.com 或 MinIO 地址。"
									>
										<TextField
											value={draft.s3.endpoint}
											onChange={(endpoint) =>
												setDraft((prev) => ({
													...prev,
													s3: { ...prev.s3, endpoint },
												}))
											}
										>
											<Label className="sr-only">S3 Endpoint</Label>
											<Input placeholder="https://s3.example.com" />
										</TextField>
									</Field>
								</div>
								<Field label="Region">
									<TextField
										value={draft.s3.region}
										onChange={(region) =>
											setDraft((prev) => ({
												...prev,
												s3: { ...prev.s3, region },
											}))
										}
									>
										<Label className="sr-only">S3 Region</Label>
										<Input placeholder="auto" />
									</TextField>
								</Field>
								<Field label="Bucket">
									<TextField
										value={draft.s3.bucket}
										onChange={(bucket) =>
											setDraft((prev) => ({
												...prev,
												s3: { ...prev.s3, bucket },
											}))
										}
									>
										<Label className="sr-only">S3 Bucket</Label>
										<Input placeholder="go-nav-images" />
									</TextField>
								</Field>
								<div className="md:col-span-2">
									<Field
										label="图片访问前缀（必填）"
										description="填写公开访问前缀，例如 https://cdn.example.com 或对象存储公开域名。"
									>
										<TextField
											value={draft.s3.publicUrlPrefix}
											onChange={(publicUrlPrefix) =>
												setDraft((prev) => ({
													...prev,
													s3: { ...prev.s3, publicUrlPrefix },
												}))
											}
										>
											<Label className="sr-only">S3 图片访问前缀</Label>
											<Input placeholder="https://cdn.example.com" />
										</TextField>
									</Field>
								</div>
								<Field label="Access Key">
									<TextField
										value={draft.s3.accessKeyId}
										onChange={(accessKeyId) =>
											setDraft((prev) => ({
												...prev,
												s3: { ...prev.s3, accessKeyId },
											}))
										}
									>
										<Label className="sr-only">S3 Access Key</Label>
										<Input autoComplete="username" placeholder="Access Key" />
									</TextField>
								</Field>
								<Field label="Secret Key">
									<TextField
										value={draft.s3.secretAccessKey}
										onChange={(secretAccessKey) =>
											setDraft((prev) => ({
												...prev,
												s3: { ...prev.s3, secretAccessKey },
											}))
										}
									>
										<Label className="sr-only">S3 Secret Key</Label>
										<Input
											type="password"
											autoComplete="current-password"
											placeholder="Secret Key"
										/>
									</TextField>
									<p className="text-xs text-default-500">
										<span
											className={`${
												draft.s3.hasSecretAccessKey
													? "text-success"
													: "text-warning"
											} font-medium`}
										>
											{draft.s3.hasSecretAccessKey
												? "已保存 Secret Key，留空保持不变"
												: "尚未保存 Secret Key"}
										</span>
									</p>
								</Field>
								<div className="md:col-span-2">
									<AdminSwitch
										isSelected={draft.s3.forcePathStyle}
										onChange={(forcePathStyle) =>
											setDraft((prev) => ({
												...prev,
												s3: { ...prev.s3, forcePathStyle },
											}))
										}
									>
										<span className="flex flex-col items-start gap-1 text-left">
											<span className="text-sm">路径风格请求</span>
											<p className="text-xs text-default-500">
												开启时上传到 endpoint/bucket/path；关闭时上传到
												bucket.endpoint/path。
											</p>
										</span>
									</AdminSwitch>
								</div>
							</Card.Content>
						</Card>

						<Card variant="secondary" className="h-full gap-4">
							<Card.Header>
								<div className="flex items-center gap-2">
									<BiCloudUpload className="size-5 text-orange-600 dark:text-orange-300" />
									<div>
										<Card.Title>阿里云 OSS</Card.Title>
										<Card.Description>
											使用 OSS 原生签名上传，适合阿里云对象存储 Bucket。
										</Card.Description>
									</div>
								</div>
							</Card.Header>
							<Card.Content className="grid grid-cols-1 content-start! gap-4 md:grid-cols-2">
								<div className="md:col-span-2">
									<Field
										label="Endpoint"
										description="例如 https://oss-cn-hangzhou.aliyuncs.com，不需要在这里填写 Bucket。"
									>
										<TextField
											value={draft.oss.endpoint}
											onChange={(endpoint) =>
												setDraft((prev) => ({
													...prev,
													oss: { ...prev.oss, endpoint },
												}))
											}
										>
											<Label className="sr-only">阿里云 OSS Endpoint</Label>
											<Input placeholder="https://oss-cn-hangzhou.aliyuncs.com" />
										</TextField>
									</Field>
								</div>
								<Field label="Bucket">
									<TextField
										value={draft.oss.bucket}
										onChange={(bucket) =>
											setDraft((prev) => ({
												...prev,
												oss: { ...prev.oss, bucket },
											}))
										}
									>
										<Label className="sr-only">阿里云 OSS Bucket</Label>
										<Input placeholder="go-nav-images" />
									</TextField>
								</Field>
								<Field label="AccessKey ID">
									<TextField
										value={draft.oss.accessKeyId}
										onChange={(accessKeyId) =>
											setDraft((prev) => ({
												...prev,
												oss: { ...prev.oss, accessKeyId },
											}))
										}
									>
										<Label className="sr-only">阿里云 OSS AccessKey ID</Label>
										<Input autoComplete="username" placeholder="AccessKey ID" />
									</TextField>
								</Field>
								<div className="md:col-span-2">
									<Field
										label="图片访问前缀（必填）"
										description="填写公开访问前缀，例如 OSS 公网域名、绑定域名或 CDN 域名。"
									>
										<TextField
											value={draft.oss.publicUrlPrefix}
											onChange={(publicUrlPrefix) =>
												setDraft((prev) => ({
													...prev,
													oss: { ...prev.oss, publicUrlPrefix },
												}))
											}
										>
											<Label className="sr-only">阿里云 OSS 图片访问前缀</Label>
											<Input placeholder="https://img.example.com" />
										</TextField>
									</Field>
								</div>
								<div className="md:col-span-2">
									<Field label="AccessKey Secret">
										<TextField
											value={draft.oss.accessKeySecret}
											onChange={(accessKeySecret) =>
												setDraft((prev) => ({
													...prev,
													oss: { ...prev.oss, accessKeySecret },
												}))
											}
										>
											<Label className="sr-only">
												阿里云 OSS AccessKey Secret
											</Label>
											<Input
												type="password"
												autoComplete="current-password"
												placeholder="AccessKey Secret"
											/>
										</TextField>
										<p className="text-xs text-default-500">
											<span
												className={`${
													draft.oss.hasAccessKeySecret
														? "text-success"
														: "text-warning"
												} font-medium`}
											>
												{draft.oss.hasAccessKeySecret
													? "已保存 AccessKey Secret，留空保持不变"
													: "尚未保存 AccessKey Secret"}
											</span>
										</p>
									</Field>
								</div>
							</Card.Content>
						</Card>
					</div>
				</Tabs.Panel>
			</Tabs>
		</div>
	);
}
