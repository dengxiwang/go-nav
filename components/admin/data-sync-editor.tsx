"use client";

import { useScrollContainment } from "@/hooks/use-scroll-containment";

import {
	AlertDialog,
	Button,
	Card,
	Chip,
	Input,
	Label,
	Modal,
	Radio,
	RadioGroup,
	Spinner,
	TextField,
	toast,
} from "@heroui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	BiCheckCircle,
	BiCloudDownload,
	BiCloudUpload,
	BiGitBranch,
	BiSync,
	BiXCircle,
} from "react-icons/bi";

type SyncProvider = "github" | "webdav";
type SyncAction = "push" | "pull";

interface BackupRestoreResult {
	website: boolean;
	nav: boolean;
	uploads: number;
}

interface DataSyncRunResult {
	ok: boolean;
	provider: SyncProvider;
	action: SyncAction;
	at: string;
	message: string;
	remote?: string;
	size?: number;
	restored?: BackupRestoreResult;
}

interface DataSyncProgressEvent {
	at: string;
	level: "info" | "success" | "error";
	message: string;
}

interface SyncStreamLogMessage {
	type: "log";
	event: DataSyncProgressEvent;
}

interface SyncStreamResultMessage {
	type: "result";
	result: DataSyncRunResult;
}

type SyncStreamMessage = SyncStreamLogMessage | SyncStreamResultMessage;

interface PublicDataSyncConfig {
	github: {
		repo: string;
		branch: string;
		filePath: string;
		commitMessage: string;
		hasToken: boolean;
	};
	webdav: {
		url: string;
		filePath: string;
		username: string;
		hasPassword: boolean;
	};
}

interface SyncDraft {
	github: PublicDataSyncConfig["github"] & { token: string };
	webdav: PublicDataSyncConfig["webdav"] & { password: string };
}

interface WebDavBackupItem {
	name: string;
	path: string;
	size?: number;
	createdAt?: string;
	modifiedAt?: string;
}

const DEFAULT_DRAFT: SyncDraft = {
	github: {
		repo: "",
		branch: "main",
		filePath: "data",
		token: "",
		commitMessage: "chore: backup Go Nav data",
		hasToken: false,
	},
	webdav: {
		url: "",
		filePath: "backup/go-nav",
		username: "",
		password: "",
		hasPassword: false,
	},
};

function draftFromConfig(config: PublicDataSyncConfig): SyncDraft {
	return {
		github: {
			...config.github,
			token: "",
		},
		webdav: {
			...config.webdav,
			password: "",
		},
	};
}

function providerLabel(provider: SyncProvider): string {
	return provider === "github" ? "GitHub" : "WebDAV";
}

function actionLabel(action: SyncAction): string {
	return action === "push" ? "推送" : "拉取";
}

function formatBytes(size?: number): string {
	if (!size || size <= 0) return "未知大小";
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
	return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function formatLogTime(at: string): string {
	const date = new Date(at);
	if (Number.isNaN(date.getTime())) return "--:--:--";
	return date.toLocaleTimeString("zh-CN", { hour12: false });
}

function syncLogMessageClass(level: DataSyncProgressEvent["level"]): string {
	if (level === "error") {
		return "text-danger/80";
	}
	if (level === "success") {
		return "text-success/80";
	}
	return "text-default/80";
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
			{description && <p className="text-xs text-default-500">{description}</p>}
		</div>
	);
}

export function DataSyncEditor() {
	const [draft, setDraft] = useState<SyncDraft>(DEFAULT_DRAFT);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [running, setRunning] = useState<string | null>(null);
	const [syncLogOpen, setSyncLogOpen] = useState(false);
	const [syncLogRunning, setSyncLogRunning] = useState(false);
	const [syncLogStatus, setSyncLogStatus] = useState<
		"idle" | "success" | "error"
	>("idle");
	const [syncLogTitle, setSyncLogTitle] = useState("");
	const [syncLogs, setSyncLogs] = useState<DataSyncProgressEvent[]>([]);
	const syncLogBodyRef = useRef<HTMLDivElement | null>(null);
	const syncLogScrollRef = useScrollContainment(syncLogBodyRef);
	const backupListScrollRef = useScrollContainment<HTMLDivElement>();

	const [webdavPickerOpen, setWebdavPickerOpen] = useState(false);
	const [webdavBackupsLoading, setWebdavBackupsLoading] = useState(false);
	const [webdavBackups, setWebdavBackups] = useState<WebDavBackupItem[]>([]);
	const [webdavTarget, setWebdavTarget] = useState("");
	const [webdavDeleteOpen, setWebdavDeleteOpen] = useState(false);
	const [webdavDeleting, setWebdavDeleting] = useState(false);

	const isBusy = loading || saving || running !== null || webdavDeleting;

	const loadConfig = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/sync/config/", { method: "GET" });
			const data = (await res.json().catch(() => ({}))) as
				| PublicDataSyncConfig
				| { error?: string };
			if (!res.ok) {
				throw new Error(
					"error" in data ? data.error : `读取失败 (${res.status})`,
				);
			}
			setDraft(draftFromConfig(data as PublicDataSyncConfig));
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
		const el = syncLogBodyRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [syncLogs, syncLogOpen]);

	const saveConfig = useCallback(
		async (silent = false) => {
			setSaving(true);
			try {
				const res = await fetch("/api/sync/config/", {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						github: {
							repo: draft.github.repo,
							branch: draft.github.branch,
							filePath: draft.github.filePath,
							token: draft.github.token,
							commitMessage: draft.github.commitMessage,
						},
						webdav: {
							url: draft.webdav.url,
							filePath: draft.webdav.filePath,
							username: draft.webdav.username,
							password: draft.webdav.password,
						},
					}),
				});
				const data = (await res.json().catch(() => ({}))) as
					| PublicDataSyncConfig
					| { error?: string };
				if (!res.ok) {
					throw new Error(
						"error" in data ? data.error : `保存失败 (${res.status})`,
					);
				}
				setDraft(draftFromConfig(data as PublicDataSyncConfig));
				if (!silent) toast.success("同步配置已保存");
			} catch (e) {
				if (!silent) toast.danger((e as Error).message);
				throw e;
			} finally {
				setSaving(false);
			}
		},
		[draft],
	);

	const runAction = useCallback(
		async (
			provider: SyncProvider,
			action: SyncAction,
			target?: string,
		): Promise<boolean> => {
			const key = `${provider}:${action}`;
			const enableLogModal = provider === "github" && action === "push";
			setRunning(key);
			try {
				if (enableLogModal) {
					setSyncLogTitle(
						`${providerLabel(provider)} ${actionLabel(action)}日志`,
					);
					setSyncLogOpen(true);
					setSyncLogRunning(true);
					setSyncLogStatus("idle");
					setSyncLogs([]);
				}

				await saveConfig(true);
				let result: DataSyncRunResult | null = null;

				if (enableLogModal) {
					const res = await fetch("/api/sync/action/", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ provider, action, target, stream: true }),
					});
					if (!res.ok) {
						const data = (await res.json().catch(() => ({}))) as {
							error?: string;
							message?: string;
						};
						throw new Error(
							data.message ||
								data.error ||
								`${actionLabel(action)}失败 (${res.status})`,
						);
					}
					if (!res.body) {
						throw new Error("同步日志流读取失败，请稍后重试");
					}

					const reader = res.body.getReader();
					const decoder = new TextDecoder();
					let buffer = "";

					while (true) {
						const { value, done } = await reader.read();
						if (done) break;
						buffer += decoder.decode(value, { stream: true });
						let newlineIndex = buffer.indexOf("\n");
						while (newlineIndex >= 0) {
							const line = buffer.slice(0, newlineIndex).trim();
							buffer = buffer.slice(newlineIndex + 1);
							if (line) {
								const payload = JSON.parse(line) as SyncStreamMessage;
								if (payload.type === "log") {
									setSyncLogs((prev) => [...prev, payload.event]);
								} else {
									result = payload.result;
								}
							}
							newlineIndex = buffer.indexOf("\n");
						}
					}
					const tail = buffer.trim();
					if (tail) {
						const payload = JSON.parse(tail) as SyncStreamMessage;
						if (payload.type === "log") {
							setSyncLogs((prev) => [...prev, payload.event]);
						} else {
							result = payload.result;
						}
					}
					if (!result) {
						throw new Error("同步已结束，但未收到最终结果");
					}
				} else {
					const res = await fetch("/api/sync/action/", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ provider, action, target }),
					});
					const data = (await res.json().catch(() => ({}))) as
						| DataSyncRunResult
						| { error?: string; message?: string };
					if (!res.ok) {
						throw new Error(
							"message" in data && data.message
								? data.message
								: "error" in data && data.error
									? data.error
									: `${actionLabel(action)}失败 (${res.status})`,
						);
					}
					result = data as DataSyncRunResult;
				}

				if (!result.ok) {
					throw new Error(result.message || `${actionLabel(action)}失败`);
				}
				const successMessage =
					result.message ||
					`${providerLabel(provider)} ${actionLabel(action)}成功`;
				toast.success(successMessage);
				if (enableLogModal) {
					setSyncLogStatus("success");
				}
				if (action === "pull") {
					setTimeout(() => window.location.reload(), 900);
				}
				return true;
			} catch (e) {
				if (enableLogModal) {
					setSyncLogStatus("error");
					setSyncLogs((prev) => [
						...prev,
						{
							at: new Date().toISOString(),
							level: "error",
							message: (e as Error).message,
						},
					]);
				}
				toast.danger((e as Error).message);
				return false;
			} finally {
				if (enableLogModal) {
					setSyncLogRunning(false);
				}
				setRunning(null);
			}
		},
		[saveConfig],
	);

	const loadWebDavBackups = useCallback(async () => {
		setWebdavBackupsLoading(true);
		try {
			await saveConfig(true);
			const res = await fetch("/api/sync/webdav-backups/", { method: "GET" });
			const data = (await res.json().catch(() => ({}))) as
				| { items?: WebDavBackupItem[]; error?: string }
				| { message?: string };
			if (!res.ok) {
				throw new Error(
					"error" in data && data.error
						? data.error
						: `读取 WebDAV 备份失败 (${res.status})`,
				);
			}
			const items =
				"items" in data && Array.isArray(data.items) ? data.items : [];
			setWebdavBackups(items);
			setWebdavTarget(items[0]?.path ?? "");
			if (items.length === 0) {
				toast.danger("当前 WebDAV 目录下没有可恢复的备份文件");
			}
		} catch (e) {
			toast.danger((e as Error).message);
			setWebdavBackups([]);
			setWebdavTarget("");
		} finally {
			setWebdavBackupsLoading(false);
		}
	}, [saveConfig]);

	const openWebDavRestoreDialog = useCallback(async () => {
		if (isBusy) return;
		setWebdavPickerOpen(true);
		await loadWebDavBackups();
	}, [isBusy, loadWebDavBackups]);

	const confirmWebDavRestore = useCallback(async () => {
		if (!webdavTarget) {
			toast.danger("请先选择一个备份文件");
			return;
		}
		const ok = await runAction("webdav", "pull", webdavTarget);
		if (ok) setWebdavPickerOpen(false);
	}, [runAction, webdavTarget]);

	const deleteSelectedWebDavBackup = useCallback(async () => {
		if (!webdavTarget) {
			toast.danger("请先选择一个备份文件");
			return;
		}
		setWebdavDeleting(true);
		try {
			const res = await fetch("/api/sync/webdav-backups/", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: webdavTarget }),
			});
			const data = (await res.json().catch(() => ({}))) as { error?: string };
			if (!res.ok) {
				throw new Error(data.error || `删除失败 (${res.status})`);
			}
			toast.success("备份文件已删除");
			setWebdavDeleteOpen(false);
			await loadWebDavBackups();
		} catch (e) {
			toast.danger((e as Error).message);
		} finally {
			setWebdavDeleting(false);
		}
	}, [loadWebDavBackups, webdavTarget]);

	const selectedWebDavBackup = useMemo(
		() => webdavBackups.find((item) => item.path === webdavTarget) || null,
		[webdavBackups, webdavTarget],
	);

	const githubReady = useMemo(
		() =>
			Boolean(
				draft.github.repo &&
				draft.github.branch &&
				draft.github.filePath &&
				draft.github.hasToken,
			),
		[
			draft.github.branch,
			draft.github.filePath,
			draft.github.hasToken,
			draft.github.repo,
		],
	);

	const webdavReady = useMemo(
		() =>
			Boolean(
				draft.webdav.url &&
				draft.webdav.username &&
				draft.webdav.filePath &&
				draft.webdav.hasPassword,
			),
		[
			draft.webdav.filePath,
			draft.webdav.hasPassword,
			draft.webdav.url,
			draft.webdav.username,
		],
	);

	if (loading) {
		return (
			<div
				className="flex flex-col items-center justify-center gap-2"
				style={{
					height: `calc(100dvh - 106px)`,
				}}
			>
				<Spinner size="sm" />
				<span className="text-xs text-default-500">正在读取同步配置...</span>
			</div>
		);
	}

	return (
		<>
			<div
				className="flex flex-col gap-4"
				style={{
					minHeight: `calc(100dvh - 106px)`,
				}}
			>
				<section className="flex flex-col gap-3">
					<div className="flex flex-col gap-1">
						<h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
							远端备份
						</h3>
						<p className="text-xs text-default-500">
							GitHub 同步为目录文件模式（website.yaml/json、nav.yaml/json、
							uploads），WebDAV 同步为 zip 备份模式。同步凭据只保存在本机
							data/sync.*，不会写入远端备份数据。
						</p>
					</div>
					<div className="flex flex-wrap gap-2 text-xs">
						<Chip
							variant="secondary"
							className={
								githubReady
									? "text-success border-success/40"
									: "text-danger border-danger/40"
							}
						>
							<Chip.Label className="inline-flex items-center gap-1">
								{githubReady ? (
									<BiCheckCircle className="size-3.5" />
								) : (
									<BiXCircle className="size-3.5" />
								)}
								GitHub {githubReady ? "完整配置" : "未完整配置"}
							</Chip.Label>
						</Chip>
						<Chip
							variant="secondary"
							className={
								webdavReady
									? "text-success border-success/40"
									: "text-danger border-danger/40"
							}
						>
							<Chip.Label className="inline-flex items-center gap-1">
								{webdavReady ? (
									<BiCheckCircle className="size-3.5" />
								) : (
									<BiXCircle className="size-3.5" />
								)}
								WebDAV {webdavReady ? "完整配置" : "未完整配置"}
							</Chip.Label>
						</Chip>
					</div>
				</section>

				<div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
					<div>
						<Card variant="secondary" className="h-full gap-4">
							<Card.Header>
								<div className="flex items-center gap-2">
									<BiGitBranch className="size-5 text-blue-600 dark:text-blue-300" />
									<div className="flex-1 overflow-hidden">
										<Card.Title>GitHub 同步</Card.Title>
										<Card.Description className="truncate">
											按目录增量同步 `website.yaml/json`、`nav.yaml/json` 和
											`uploads/*`。
										</Card.Description>
									</div>
								</div>
							</Card.Header>
							<Card.Content className="grid grid-cols-1 gap-4 md:grid-cols-2">
								<Field
									label="仓库"
									description="支持 owner/repo 或完整 GitHub 仓库 URL"
								>
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
										<Input placeholder="dengxiwang/go-nav-data" />
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
								<Field label="备份目录" description="例如 data 或 backups">
									<TextField
										value={draft.github.filePath}
										onChange={(filePath) =>
											setDraft((prev) => ({
												...prev,
												github: { ...prev.github, filePath },
											}))
										}
									>
										<Label className="sr-only">GitHub 备份目录</Label>
										<Input placeholder="data" />
									</TextField>
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
										<Input placeholder="chore: backup Go Nav data" />
									</TextField>
								</Field>
								<div className="md:col-span-2">
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
												placeholder="Fine-grained token，需 Contents 读写权限"
											/>
										</TextField>
										<p className="text-xs text-default-500">
											<span
												className={`${
													draft.github.hasToken
														? "text-success"
														: "text-warning"
												} font-medium`}
											>
												{draft.github.hasToken
													? "已保存 Token，留空则保持不变"
													: "尚未保存 Token，请填写后再同步"}
											</span>
										</p>
									</Field>
								</div>
							</Card.Content>
							<Card.Footer className="flex flex-wrap gap-2">
								<Button
									variant="primary"
									size="sm"
									isPending={running === "github:push"}
									isDisabled={isBusy}
									onPress={() => void runAction("github", "push")}
								>
									<BiCloudUpload data-icon="inline-start" />
									推送到 GitHub
								</Button>
								<Button
									variant="outline"
									size="sm"
									isPending={running === "github:pull"}
									isDisabled={isBusy}
									onPress={() => void runAction("github", "pull")}
								>
									<BiCloudDownload data-icon="inline-start" />从 GitHub 拉取
								</Button>
							</Card.Footer>
						</Card>
					</div>
					<div>
						<Card variant="secondary" className="h-full gap-4">
							<Card.Header>
								<div className="flex items-center gap-2">
									<BiSync className="size-5 text-emerald-600 dark:text-emerald-300" />
									<div className="flex-1 overflow-hidden">
										<Card.Title>WebDAV 同步</Card.Title>
										<Card.Description className="truncate">
											适配坚果云、Nextcloud、Alist 等支持 WebDAV 的存储。
										</Card.Description>
									</div>
								</div>
							</Card.Header>
							<Card.Content className="grid grid-cols-1 gap-4 md:grid-cols-2">
								<div className="md:col-span-2">
									<Field
										label="WebDAV 地址"
										description="填写目录地址，备份目录会拼接在这个地址后面"
									>
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
											<Input placeholder="https://dav.example.com/dav/go-nav/" />
										</TextField>
									</Field>
								</div>
								<Field
									label="备份目录"
									description="备份文件会自动生成为 go-nav-data-YYYYMMDDHHmmss.zip"
								>
									<TextField
										value={draft.webdav.filePath}
										onChange={(filePath) =>
											setDraft((prev) => ({
												...prev,
												webdav: { ...prev.webdav, filePath },
											}))
										}
									>
										<Label className="sr-only">WebDAV 备份目录</Label>
										<Input placeholder="backup/go-nav" />
									</TextField>
								</Field>
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
								<div className="md:col-span-2">
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
													? "已保存密码，留空则保持不变"
													: "尚未保存密码，请填写后再同步"}
											</span>
										</p>
									</Field>
								</div>
							</Card.Content>
							<Card.Footer className="flex flex-wrap gap-2">
								<Button
									variant="primary"
									size="sm"
									isPending={running === "webdav:push"}
									isDisabled={isBusy}
									onPress={() => void runAction("webdav", "push")}
								>
									<BiCloudUpload data-icon="inline-start" />
									推送到 WebDAV
								</Button>
								<Button
									variant="outline"
									size="sm"
									isPending={webdavBackupsLoading || running === "webdav:pull"}
									isDisabled={isBusy}
									onPress={() => void openWebDavRestoreDialog()}
								>
									<BiCloudDownload data-icon="inline-start" />从 WebDAV 拉取
								</Button>
							</Card.Footer>
						</Card>
					</div>
				</div>

				<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
					<p className="mb-1.5 font-semibold">操作提示</p>
					<ul className="list-disc list-inside space-y-1">
						<li>
							GitHub 推送会增量提交当前服务器 data 中有变更的 website/nav 配置与
							uploads 文件（例如配置为 backups 时路径为
							<code>backups/website.yaml</code>、
							<code>backups/website.json</code>、<code>backups/nav.yaml</code>、
							<code>backups/nav.json</code>、<code>backups/uploads/*</code>）
						</li>
						<li>
							WebDAV 推送会在备份目录下生成一个新文件（例如
							<code>go-nav-data-20260519093300.zip</code>），不会覆盖旧备份
						</li>
						<li>
							WebDAV 拉取需先在弹窗中选择备份文件，恢复后会覆盖本机 website/nav
							配置，并写入备份中的 uploads 文件
						</li>
						<li>
							GitHub Token 获取路径：GitHub 右上角头像 → Settings → Developer
							settings → Personal access tokens → Fine-grained
							tokens。创建时请在 Repository access 里选中目标仓库，并将
							Repository permissions 的 Contents 设为 Read and write
						</li>
						<li>
							WebDAV 建议优先使用应用专用密码；若推送失败，请先用 WebDAV
							客户端验证该地址、用户名、密码是否具备写入权限
						</li>
						<li>
							若提示分支不存在，请先使用仓库默认分支（常见为
							<code>main</code>），再按需切换到自定义分支
						</li>
					</ul>
				</div>
			</div>

			<Modal.Backdrop
				isOpen={syncLogOpen}
				onOpenChange={(open) => {
					if (syncLogRunning) return;
					setSyncLogOpen(open);
				}}
				isDismissable={!syncLogRunning}
			>
				<Modal.Container size="lg" scroll="inside">
					<Modal.Dialog>
						{!syncLogRunning ? <Modal.CloseTrigger /> : null}
						<Modal.Header>
							<Modal.Heading>{syncLogTitle || "同步日志"}</Modal.Heading>
						</Modal.Header>
						<Modal.Body className="space-y-3">
							<div className="flex items-center justify-between font-medium rounded-xl border border-default-200 bg-default-50 px-3 py-2 text-xs">
								<span className="text-default-600">
									{syncLogRunning ? "正在执行中..." : "执行完成"}
								</span>
								<span
									className={`${
										syncLogStatus === "success"
											? "text-success"
											: syncLogStatus === "error"
												? "text-danger"
												: "text-default-500"
									}`}
								>
									{syncLogStatus === "success"
										? "成功"
										: syncLogStatus === "error"
											? "失败"
											: "进行中"}
								</span>
							</div>
							<div
								ref={syncLogScrollRef}
								className="sync-log-terminal h-80 overflow-y-auto rounded-lg border border-slate-700/80 bg-[#0b1220] px-3 py-2 shadow-inner"
							>
								{syncLogs.length === 0 ? (
									<div className="flex h-full items-center justify-center text-slate-500">
										<Spinner size="sm" />
									</div>
								) : (
									syncLogs.map((item, index) => (
										<div key={`${item.at}-${index}`} className="flex gap-2">
											<span className="shrink-0 text-slate-500">
												[{formatLogTime(item.at)}]
											</span>
											<span className={syncLogMessageClass(item.level)}>
												{item.message}
											</span>
										</div>
									))
								)}
							</div>
						</Modal.Body>
						<Modal.Footer>
							<Button
								variant="secondary"
								slot="close"
								isDisabled={syncLogRunning}
							>
								关闭
							</Button>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>

			<Modal.Backdrop
				isOpen={webdavPickerOpen}
				onOpenChange={setWebdavPickerOpen}
				isDismissable={!webdavBackupsLoading && running !== "webdav:pull"}
			>
				<Modal.Container size="lg" scroll="inside">
					<Modal.Dialog>
						<Modal.CloseTrigger />
						<Modal.Header>
							<Modal.Heading>选择 WebDAV 备份并恢复</Modal.Heading>
						</Modal.Header>
						<Modal.Body className="space-y-3">
							<p className="text-xs! text-default-600 font-medium">
								备份目录：<code>{draft.webdav.filePath}</code>
							</p>
							<div
								ref={backupListScrollRef}
								className="h-72 overflow-y-auto rounded-lg border border-default-200 p-3"
								style={{
									maxHeight: `calc(100% - 28.3px)`,
								}}
							>
								{webdavBackupsLoading ? (
									<div className="flex flex-col items-center justify-center w-full h-full gap-2 py-2 text-sm text-default-500">
										<Spinner size="sm" />
										正在读取 WebDAV 备份列表...
									</div>
								) : webdavBackups.length === 0 ? (
									<p className="text-sm h-full flex items-center justify-center text-warning">
										未发现可恢复的备份文件
									</p>
								) : (
									<RadioGroup
										name="webdav-restore-file"
										value={webdavTarget}
										onChange={setWebdavTarget}
										variant="secondary"
									>
										{webdavBackups.map((item, index) => (
											<Radio
												key={item.path}
												value={item.path}
												isDisabled={running === "webdav:pull"}
												style={{
													marginTop: index === 0 ? "0px" : "12px",
												}}
											>
												<Radio.Control>
													<Radio.Indicator />
												</Radio.Control>
												<Radio.Content>
													<Label>
														{item.name} ({formatBytes(item.size)})
													</Label>
												</Radio.Content>
											</Radio>
										))}
									</RadioGroup>
								)}
							</div>
						</Modal.Body>
						<Modal.Footer className="flex w-full items-center justify-between">
							<Button
								variant="danger-soft"
								isDisabled={
									webdavBackupsLoading ||
									webdavBackups.length === 0 ||
									!webdavTarget ||
									webdavDeleting ||
									running === "webdav:pull"
								}
								onPress={() => setWebdavDeleteOpen(true)}
							>
								删除所选备份
							</Button>
							<div className="flex items-center gap-2">
								<Button
									variant="secondary"
									slot="close"
									isDisabled={running === "webdav:pull" || webdavDeleting}
								>
									取消
								</Button>
								<Button
									variant="primary"
									isPending={running === "webdav:pull"}
									isDisabled={
										webdavBackupsLoading ||
										webdavBackups.length === 0 ||
										webdavDeleting
									}
									onPress={() => void confirmWebDavRestore()}
								>
									恢复所选备份
								</Button>
							</div>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
			<AlertDialog.Backdrop
				isOpen={webdavDeleteOpen}
				onOpenChange={setWebdavDeleteOpen}
			>
				<AlertDialog.Container size="sm">
					<AlertDialog.Dialog>
						<AlertDialog.CloseTrigger />
						<AlertDialog.Header>
							<AlertDialog.Icon status="danger" />
							<AlertDialog.Heading>确认删除备份文件？</AlertDialog.Heading>
						</AlertDialog.Header>
						<AlertDialog.Body>
							<p className="text-sm text-default-600">
								该操作不可撤销，将删除：
								<code className="ml-1">
									{selectedWebDavBackup?.name || webdavTarget}
								</code>
							</p>
						</AlertDialog.Body>
						<AlertDialog.Footer>
							<Button
								variant="tertiary"
								slot="close"
								isDisabled={webdavDeleting}
							>
								取消
							</Button>
							<Button
								variant="danger"
								isPending={webdavDeleting}
								onPress={() => void deleteSelectedWebDavBackup()}
							>
								确认删除
							</Button>
						</AlertDialog.Footer>
					</AlertDialog.Dialog>
				</AlertDialog.Container>
			</AlertDialog.Backdrop>
		</>
	);
}
