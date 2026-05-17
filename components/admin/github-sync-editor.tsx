"use client";

import {
	Button,
	TextField,
	Input,
	Label,
	toast,
} from "@heroui/react";
import { useEffect, useState } from "react";
import {
	BiCloudUpload,
	BiCloudDownload,
	BiCheckCircle,
	BiRefresh,
	BiTrash,
	BiServer,
	BiGitRepoForked,
	BiInfoCircle,
	BiHide,
	BiShow,
} from "react-icons/bi";

type SyncMode = "github" | "webdav";

export function GithubSyncEditor() {
	const [mode, setMode] = useState<SyncMode>("github");

	// GitHub 配置
	const [ghRepoUrl, setGhRepoUrl] = useState("");
	const [ghBranch, setGhBranch] = useState("main");
	const [ghVerifying, setGhVerifying] = useState(false);
	const [ghVerified, setGhVerified] = useState(false);
	const [ghVerifyInfo, setGhVerifyInfo] = useState<{ user: string; repo: string; branch: string } | null>(null);
	const [ghHasSavedConfig, setGhHasSavedConfig] = useState(false);

	// WebDAV 配置
	const [wdUrl, setWdUrl] = useState("");
	const [wdUsername, setWdUsername] = useState("");
	const [wdRemotePath, setWdRemotePath] = useState("/go-nav/backups");
	const [wdShowPassword, setWdShowPassword] = useState(false);
	const [wdVerifying, setWdVerifying] = useState(false);
	const [wdVerified, setWdVerified] = useState(false);
	const [wdHasSavedConfig, setWdHasSavedConfig] = useState(false);
	const [wdBackups, setWdBackups] = useState<{ fileName: string; filePath: string; time: string; size?: number }[]>([]);
	const [wdLoadingBackups, setWdLoadingBackups] = useState(false);

	// 通用状态
	const [loading, setLoading] = useState(true);
	const [syncing, setSyncing] = useState(false);
	const [pulling, setPulling] = useState(false);
	const [lastSync, setLastSync] = useState<{
		commitSha?: string;
		fileCount: number;
		repo?: string;
		branch?: string;
		time: string;
	} | null>(null);

	// 加载已保存的配置
	useEffect(() => {
		async function loadConfigs() {
			try {
				const [ghRes, wdRes] = await Promise.all([
					fetch("/api/github-sync"),
					fetch("/api/webdav-sync"),
				]);

				if (ghRes.ok) {
					const ghData = await ghRes.json();
					if (ghData.saved) {
						setGhRepoUrl(ghData.repoUrl);
						setGhBranch(ghData.branch);
						setGhHasSavedConfig(true);
						setGhVerified(true);
						setGhVerifyInfo(ghData.verifyInfo);
					}
				}

				if (wdRes.ok) {
					const wdData = await wdRes.json();
					if (wdData.saved) {
						setWdUrl(wdData.url);
						setWdUsername(wdData.username);
						setWdRemotePath(wdData.remotePath);
						setWdHasSavedConfig(true);
						setWdVerified(true);
						setWdBackups(wdData.backups ?? []);
					}
				}
			} catch {
				// ignore
			} finally {
				setLoading(false);
			}
		}
		loadConfigs();
	}, []);

	// === GitHub 操作 ===
	const handleGhVerify = async () => {
		if (ghVerifying) return;
		setGhVerifying(true);
		setGhVerified(false);
		setGhVerifyInfo(null);
		try {
			const res = await fetch("/api/github-sync", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ repoUrl: ghRepoUrl.trim(), branch: ghBranch.trim() || "main" }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || `验证失败 (${res.status})`);
			setGhVerified(true);
			setGhVerifyInfo(data.verifyInfo);
			setGhHasSavedConfig(true);
			toast.success("验证通过，配置已保存");
		} catch (e) {
			setGhVerified(false);
			toast.danger((e as Error).message);
		} finally {
			setGhVerifying(false);
		}
	};

	const handleGhSync = async () => {
		if (syncing) return;
		if (!ghVerified) { toast.danger("请先验证连接"); return; }
		setSyncing(true);
		try {
			const res = await fetch("/api/github-sync", { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || `推送失败 (${res.status})`);
			setLastSync({ commitSha: data.commitSha, fileCount: data.fileCount, time: data.time || new Date().toISOString() });
			toast.success(`推送成功，共 ${data.fileCount} 个文件`);
		} catch (e) {
			toast.danger((e as Error).message);
		} finally {
			setSyncing(false);
		}
	};

	const handleGhPull = async () => {
		if (pulling) return;
		if (!ghVerified) { toast.danger("请先验证连接"); return; }
		setPulling(true);
		try {
			const res = await fetch("/api/github-sync", { method: "PATCH" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || `拉取失败 (${res.status})`);
			setLastSync({ fileCount: data.fileCount, time: data.time || new Date().toISOString() });
			toast.success(`拉取成功，共 ${data.fileCount} 个文件`);
		} catch (e) {
			toast.danger((e as Error).message);
		} finally {
			setPulling(false);
		}
	};

	const handleGhClearConfig = async () => {
		try {
			await fetch("/api/github-sync", { method: "DELETE" });
			setGhRepoUrl(""); setGhBranch("main");
			setGhHasSavedConfig(false); setGhVerified(false); setGhVerifyInfo(null);
			toast.success("GitHub 配置已清除");
		} catch (e) {
			toast.danger((e as Error).message);
		}
	};

	// === WebDAV 操作 ===
	const loadWdBackups = async () => {
		setWdLoadingBackups(true);
		try {
			const res = await fetch("/api/webdav-sync");
			if (res.ok) {
				const data = await res.json();
				setWdBackups(data.backups ?? []);
				if (data.error) {
					toast.danger(`获取备份列表失败: ${data.error}`);
				}
			}
		} catch (e) {
			toast.danger(`请求失败: ${(e as Error).message}`);
		} finally {
			setWdLoadingBackups(false);
		}
	};

	const handleWdVerify = async () => {
		if (wdVerifying) return;
		if (!wdUrl.trim() || !wdUsername.trim()) {
			toast.danger("请填写服务器地址和用户名");
			return;
		}
		setWdVerifying(true);
		setWdVerified(false);
		try {
			const res = await fetch("/api/webdav-sync", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: wdUrl.trim(), username: wdUsername.trim(), remotePath: wdRemotePath.trim() || "/go-nav/backups" }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || `验证失败 (${res.status})`);
			setWdVerified(true);
			setWdHasSavedConfig(true);
			toast.success("验证通过，配置已保存");
		} catch (e) {
			setWdVerified(false);
			toast.danger((e as Error).message);
		} finally {
			setWdVerifying(false);
		}
	};

	const handleWdSync = async () => {
		if (syncing) return;
		if (!wdVerified) { toast.danger("请先验证连接"); return; }
		setSyncing(true);
		try {
			const res = await fetch("/api/webdav-sync", { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || `备份失败 (${res.status})`);
			setLastSync({ fileCount: data.fileCount, time: data.time || new Date().toISOString() });
			toast.success(`备份成功，共 ${data.fileCount} 个文件`);
			await loadWdBackups();
		} catch (e) {
			toast.danger((e as Error).message);
		} finally {
			setSyncing(false);
		}
	};

	const handleWdPull = async (filePath: string) => {
		if (pulling) return;
		if (!wdVerified) { toast.danger("请先验证连接"); return; }
		setPulling(true);
		try {
			const res = await fetch("/api/webdav-sync", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ filePath }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || `恢复失败 (${res.status})`);
			setLastSync({ fileCount: data.fileCount, time: data.time || new Date().toISOString() });
			toast.success(`恢复成功，共 ${data.fileCount} 个文件`);
		} catch (e) {
			toast.danger((e as Error).message);
		} finally {
			setPulling(false);
		}
	};

	const handleWdDeleteBackup = async (filePath: string) => {
		try {
			const res = await fetch(`/api/webdav-sync?file=${encodeURIComponent(filePath)}`, { method: "DELETE" });
			if (!res.ok) throw new Error("删除失败");
			toast.success("备份已删除");
			await loadWdBackups();
		} catch (e) {
			toast.danger((e as Error).message);
		}
	};

	const handleWdClearConfig = async () => {
		try {
			await fetch("/api/webdav-sync", { method: "DELETE" });
			setWdUrl(""); setWdUsername(""); setWdRemotePath("/go-nav/backups");
			setWdHasSavedConfig(false); setWdVerified(false); setWdBackups([]);
			toast.success("WebDAV 配置已清除");
		} catch (e) {
			toast.danger((e as Error).message);
		}
	};

	const isVerified = mode === "github" ? ghVerified : wdVerified;

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			{/* 模式切换 */}
			<div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1.5 dark:border-neutral-800 dark:bg-neutral-900">
				<button
					type="button"
					onClick={() => setMode("github")}
					className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
						mode === "github"
							? "bg-blue-600 text-white"
							: "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-neutral-800"
					}`}
				>
					<BiGitRepoForked className="size-4" />
					GitHub
				</button>
				<button
					type="button"
					onClick={() => setMode("webdav")}
					className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
						mode === "webdav"
							? "bg-blue-600 text-white"
							: "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-neutral-800"
					}`}
				>
					<BiServer className="size-4" />
					WebDAV
				</button>
			</div>

			{/* GitHub 配置 */}
			{mode === "github" && (
				<div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
					<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
						<BiInfoCircle className="mt-0.5 size-5 text-amber-600 dark:text-amber-400" />
						<div className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
							<p className="font-medium">Token 通过环境变量设置：</p>
							<code className="block rounded bg-amber-100 px-2 py-1 font-mono text-xs dark:bg-amber-900/30">GITHUB_TOKEN=ghp_xxxxxxxxxxxx</code>
						</div>
					</div>

					<TextField value={ghRepoUrl} onChange={setGhRepoUrl} isDisabled={loading}>
						<Label>仓库地址</Label>
						<Input placeholder="https://github.com/username/repo" />
					</TextField>

					<TextField value={ghBranch} onChange={setGhBranch} isDisabled={loading}>
						<Label>分支</Label>
						<Input placeholder="main" />
					</TextField>

					{ghHasSavedConfig && ghVerifyInfo && (
						<div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
							<BiCheckCircle className="size-4" />
							<span>{ghVerifyInfo.user ? `${ghVerifyInfo.user} / ` : ""}{ghVerifyInfo.repo} ({ghVerifyInfo.branch})</span>
						</div>
					)}

					<div className="flex items-center gap-3">
						<Button variant="outline" onPress={handleGhVerify} isDisabled={ghVerifying || loading || !ghRepoUrl.trim()}>
							<BiRefresh className={ghVerifying ? "animate-spin" : ""} />
							{ghVerifying ? "验证中..." : ghHasSavedConfig ? "更新配置" : "验证并保存"}
						</Button>
						{ghVerified && (
							<div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
								<BiCheckCircle className="size-4" />
								<span>连接正常</span>
							</div>
						)}
						{ghHasSavedConfig && (
							<Button variant="tertiary" onPress={handleGhClearConfig}>
								清除配置
							</Button>
						)}
					</div>
				</div>
			)}

			{/* WebDAV 配置 */}
			{mode === "webdav" && (
				<div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
					<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
						<BiInfoCircle className="mt-0.5 size-5 text-amber-600 dark:text-amber-400" />
						<div className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
							<p className="font-medium">密码通过环境变量设置：</p>
							<code className="block rounded bg-amber-100 px-2 py-1 font-mono text-xs dark:bg-amber-900/30">WEBDAV_PASSWORD=your_password</code>
						</div>
					</div>

					<TextField value={wdUrl} onChange={setWdUrl} isDisabled={loading}>
						<Label>服务器地址</Label>
						<Input placeholder="https://dav.example.com" />
					</TextField>

					<TextField value={wdUsername} onChange={setWdUsername} isDisabled={loading}>
						<Label>用户名</Label>
						<Input placeholder="username" />
					</TextField>

					<TextField value={wdRemotePath} onChange={setWdRemotePath} isDisabled={loading}>
						<Label>远程目录</Label>
						<Input placeholder="/go-nav/backups" />
					</TextField>

					{wdHasSavedConfig && (
						<div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
							<BiCheckCircle className="size-4" />
							<span>{wdUrl} ({wdRemotePath})</span>
						</div>
					)}

					<div className="flex items-center gap-3">
						<Button variant="outline" onPress={handleWdVerify} isDisabled={wdVerifying || loading || !wdUrl.trim() || !wdUsername.trim()}>
							<BiRefresh className={wdVerifying ? "animate-spin" : ""} />
							{wdVerifying ? "验证中..." : wdHasSavedConfig ? "更新配置" : "验证并保存"}
						</Button>
						{wdVerified && (
							<div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
								<BiCheckCircle className="size-4" />
								<span>连接正常</span>
							</div>
						)}
						{wdHasSavedConfig && (
							<Button variant="tertiary" onPress={handleWdClearConfig}>
								清除配置
							</Button>
						)}
					</div>
				</div>
			)}

			{/* 同步操作 */}
			<div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
				<div className="space-y-1">
					<h3 className="text-sm font-medium">同步操作</h3>
					<p className="text-xs text-default-500">
						{mode === "github"
							? "将本地 data 目录内容推送到 GitHub 仓库，或从仓库拉取到本地"
							: "将本地 data 目录备份到 WebDAV 服务器，或从服务器恢复"}
					</p>
				</div>

				<div className="flex items-center gap-3">
					<Button
						variant="primary"
						onPress={mode === "github" ? handleGhSync : handleWdSync}
						isDisabled={!isVerified || syncing || pulling}
					>
						<BiCloudUpload />
						{syncing ? "备份中..." : mode === "webdav" ? "创建备份" : "推送到远程"}
					</Button>

					{mode === "github" && (
						<Button
							variant="outline"
							onPress={handleGhPull}
							isDisabled={!isVerified || pulling || syncing}
						>
							<BiCloudDownload />
							{pulling ? "拉取中..." : "从远程拉取"}
						</Button>
					)}
				</div>

				{/* WebDAV 备份列表 */}
				{mode === "webdav" && wdVerified && (
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<h4 className="text-sm font-medium">远程备份列表（{wdBackups.length}）</h4>
							<Button size="sm" variant="tertiary" onPress={loadWdBackups} isDisabled={wdLoadingBackups}>
								<BiRefresh className={wdLoadingBackups ? "animate-spin" : ""} />
								{wdLoadingBackups ? "刷新中..." : "刷新"}
							</Button>
						</div>

						{wdBackups.length === 0 ? (
							<p className="text-xs text-default-400">暂无备份</p>
						) : (
							<div className="max-h-60 space-y-1 overflow-y-auto rounded-lg border border-gray-200 dark:border-neutral-700">
								{wdBackups.map((backup) => (
									<div
										key={backup.fileName}
										className="flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-default/50"
									>
										<div className="flex flex-1 items-center gap-2">
											<span className="font-mono text-xs">{backup.time}</span>
											{backup.size && (
												<span className="text-xs text-default-400">
													{(backup.size / 1024).toFixed(1)} KB
												</span>
											)}
										</div>
										<div className="flex items-center gap-1">
											<Button
												size="sm"
												variant="tertiary"
												onPress={() => handleWdPull(backup.filePath)}
												isDisabled={pulling || syncing}
											>
												<BiCloudDownload className="size-3.5" />
												恢复
											</Button>
											<Button
												size="sm"
												variant="tertiary"
												onPress={() => handleWdDeleteBackup(backup.filePath)}
											>
												<BiTrash className="size-3.5" />
											</Button>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				)}

				{lastSync && (
					<div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
						<div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300">
							<BiCheckCircle className="size-4" />
							<span>
								{mode === "github" && lastSync.commitSha
									? `已同步 ${lastSync.fileCount} 个文件 (${lastSync.commitSha.slice(0, 7)})`
									: `已同步 ${lastSync.fileCount} 个文件`}
							</span>
						</div>
						<p className="mt-1 text-xs text-green-600 dark:text-green-400">
							{new Date(lastSync.time).toLocaleString()}
						</p>
					</div>
				)}
			</div>

			{/* 注意事项 */}
			<div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
				<h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">注意事项</h4>
				<ul className="list-inside list-disc space-y-1 text-xs text-gray-600 dark:text-gray-400">
					{mode === "github" ? (
						<>
							<li>Token 需要具有 repo 权限的 Personal Access Token</li>
							<li>首次推送会自动创建分支（如果不存在）</li>
							<li>同步采用完全同步模式，远程仓库与本地完全一致</li>
							<li>Token 通过环境变量设置，不会泄露到仓库</li>
						</>
					) : (
						<>
							<li>支持坚果云、Nextcloud、群晖等 WebDAV 服务</li>
							<li>每次备份打包为 zip 文件，按时间命名</li>
							<li>恢复时选择指定备份，解压覆盖本地 data 目录</li>
							<li>密码通过环境变量设置，不会泄露到备份</li>
						</>
					)}
				</ul>
			</div>
		</div>
	);
}
