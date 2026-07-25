"use client";

import { Button, Modal, toast } from "@heroui/react";
import { useRef, useState } from "react";
import { BiCheck, BiDownload, BiTrash, BiUpload } from "react-icons/bi";
import {
	BACKUP_IMPORT_ACTION_HEADER,
	BACKUP_IMPORT_CHUNK_BYTES,
	BACKUP_IMPORT_CHUNK_COUNT_HEADER,
	BACKUP_IMPORT_CHUNK_INDEX_HEADER,
	BACKUP_IMPORT_FILE_SIZE_HEADER,
	BACKUP_IMPORT_MAX_BYTES,
	BACKUP_IMPORT_UPLOAD_ID_HEADER,
} from "@/lib/backup-import";

type CleanupPreview = {
	orphans: string[];
	used: number;
	total: number;
	orphanCount: number;
};

type RestoreResponse = {
	restored?: { disabledJsPlugins?: number };
};

async function readImportError(res: Response): Promise<string> {
	const data = (await res.json().catch(() => ({}))) as { error?: string };
	if (data.error) return data.error;
	if (res.status === 413) {
		return "服务器或反向代理仍拒绝了 512 KB 上传分片（413）。应用已启用分片上传，请将 Nginx client_max_body_size 或托管平台的请求体限制调到至少 1 MB。";
	}
	return `还原失败 (${res.status})`;
}

function createBackupUploadId(): string {
	return typeof crypto.randomUUID === "function"
		? crypto.randomUUID()
		: `backup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function BackupEditor() {
	const [importing, setImporting] = useState(false);
	const [importProgress, setImportProgress] = useState<number | null>(null);
	const [exporting, setExporting] = useState(false);
	const [pickedFile, setPickedFile] = useState<File | null>(null);
	const [importError, setImportError] = useState<string | null>(null);
	const [importSuccess, setImportSuccess] = useState(false);
	const [scanning, setScanning] = useState(false);
	const [cleaning, setCleaning] = useState(false);
	const [preview, setPreview] = useState<CleanupPreview | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleDownload = async () => {
		if (exporting) return;
		setExporting(true);
		try {
			const res = await fetch("/api/backup/", { method: "GET" });
			if (!res.ok) {
				const d = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(d.error || `导出失败 (${res.status})`);
			}
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			const date = new Date().toISOString().slice(0, 10);
			a.download = `go-nav-backup-${date}.zip`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			toast.success("备份压缩包已下载");
		} catch (e) {
			toast.danger((e as Error).message);
		} finally {
			setExporting(false);
		}
	};

	const handleImport = async () => {
		if (importing) return;
		setImportError(null);
		setImportSuccess(false);
		if (!pickedFile) {
			setImportError("请先选择备份 zip 文件");
			return;
		}
		if (pickedFile.size <= 0) {
			setImportError("备份 zip 文件不能为空");
			return;
		}
		if (pickedFile.size > BACKUP_IMPORT_MAX_BYTES) {
			setImportError("备份文件不能超过 256 MB");
			return;
		}
		setImporting(true);
		setImportProgress(0);
		try {
			const uploadId = createBackupUploadId();
			const chunkCount = Math.ceil(
				pickedFile.size / BACKUP_IMPORT_CHUNK_BYTES,
			);
			const commonHeaders = {
				[BACKUP_IMPORT_UPLOAD_ID_HEADER]: uploadId,
				[BACKUP_IMPORT_CHUNK_COUNT_HEADER]: String(chunkCount),
				[BACKUP_IMPORT_FILE_SIZE_HEADER]: String(pickedFile.size),
			};

			for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
				const start = chunkIndex * BACKUP_IMPORT_CHUNK_BYTES;
				const end = Math.min(start + BACKUP_IMPORT_CHUNK_BYTES, pickedFile.size);
				const res = await fetch("/api/backup/", {
					method: "POST",
					headers: {
						...commonHeaders,
						"Content-Type": "application/octet-stream",
						[BACKUP_IMPORT_ACTION_HEADER]: "chunk",
						[BACKUP_IMPORT_CHUNK_INDEX_HEADER]: String(chunkIndex),
					},
					body: pickedFile.slice(start, end),
				});
				if (!res.ok) throw new Error(await readImportError(res));
				setImportProgress(
					Math.min(99, Math.round((end / pickedFile.size) * 100)),
				);
			}

			const completeRes = await fetch("/api/backup/", {
				method: "POST",
				headers: {
					...commonHeaders,
					[BACKUP_IMPORT_ACTION_HEADER]: "complete",
				},
			});
			if (!completeRes.ok) {
				throw new Error(await readImportError(completeRes));
			}
			const restored = (await completeRes
				.json()
				.catch(() => ({}))) as RestoreResponse;
			setImportProgress(100);
			setImportSuccess(true);
			setPickedFile(null);
			const disabledJsPlugins = restored.restored?.disabledJsPlugins ?? 0;
			toast.success(
				disabledJsPlugins > 0
					? `数据已还原，已默认禁用 ${disabledJsPlugins} 个脚本类插件`
					: "数据已还原，页面即将刷新",
			);
			setTimeout(() => {
				window.location.reload();
			}, 800);
		} catch (e) {
			setImportError((e as Error).message);
		} finally {
			setImporting(false);
			setImportProgress(null);
		}
	};

	const handleScanOrphans = async () => {
		if (scanning || cleaning) return;
		setScanning(true);
		try {
			const res = await fetch("/api/backup/cleanup/", { method: "GET" });
			const d = (await res.json().catch(() => ({}))) as CleanupPreview & {
				error?: string;
			};
			if (!res.ok) throw new Error(d.error || `扫描失败 (${res.status})`);
			setPreview({
				orphans: d.orphans ?? [],
				used: d.used ?? 0,
				total: d.total ?? 0,
				orphanCount: d.orphanCount ?? (d.orphans?.length ?? 0),
			});
		} catch (e) {
			toast.danger((e as Error).message);
		} finally {
			setScanning(false);
		}
	};

	const handleConfirmCleanup = async () => {
		if (cleaning) return;
		setCleaning(true);
		try {
			const res = await fetch("/api/backup/cleanup/", { method: "POST" });
			const d = (await res.json().catch(() => ({}))) as {
				deletedCount?: number;
				failed?: { name: string; error: string }[];
				error?: string;
			};
			if (!res.ok) throw new Error(d.error || `清理失败 (${res.status})`);
			const failedCount = d.failed?.length ?? 0;
			if (failedCount > 0) {
				toast.warning(
					`已删除 ${d.deletedCount ?? 0} 个，${failedCount} 个失败`,
				);
			} else {
				toast.success(`已清理 ${d.deletedCount ?? 0} 个无用素材`);
			}
			setPreview(null);
		} catch (e) {
			toast.danger((e as Error).message);
		} finally {
			setCleaning(false);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			{/* 导出区域 */}
			<section className="flex flex-col gap-3 border-b border-gray-200 pb-4 dark:border-neutral-800">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
						导出备份
					</h3>
					<p className="text-xs text-gray-500 dark:text-neutral-400">
						将 data 目录（站点设置、分类、网址）以及 uploads
						目录下所有上传的图标，一次性打包为 zip 压缩包下载
					</p>
				</div>
				<div>
					<Button
						variant="primary"
						size="sm"
						isPending={exporting}
						isDisabled={exporting}
						onPress={handleDownload}
					>
						<BiDownload data-icon="inline-start" />
						{exporting ? "导出中..." : "下载备份压缩包"}
					</Button>
				</div>
			</section>

			{/* 还原区域 */}
			<section className="flex flex-col gap-3">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
						导入还原
					</h3>
					<p className="text-xs text-gray-500 dark:text-neutral-400">
						上传之前导出的备份 zip 压缩包，将直接覆盖
						data/website.*、data/nav.* 与 data/uploads
						目录下的对应文件。文件会自动分片上传，导入的 JSON/YAML
						会按当前 DATA_FILE_FORMAT 写回。
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<Button
						variant="outline"
						size="sm"
						onPress={() => inputRef.current?.click()}
					>
						<BiUpload data-icon="inline-start" />
						选择备份文件
					</Button>
					<input
						ref={inputRef}
						type="file"
						accept="application/zip,.zip"
						className="hidden"
						onChange={(e) => {
							const f = e.target.files?.[0];
							if (f) {
								setPickedFile(f);
								setImportError(null);
								setImportSuccess(false);
							}
							e.currentTarget.value = "";
						}}
					/>
					<span className="truncate text-xs text-gray-500 dark:text-neutral-400">
						{pickedFile
							? `已选择：${pickedFile.name} (${(pickedFile.size / 1024).toFixed(1)} KB)`
							: "支持 .zip 格式"}
					</span>
				</div>

				{importError && (
					<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
						{importError}
					</div>
				)}
				{importSuccess && (
					<div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
						<BiCheck className="size-4" />
						数据已还原，页面即将刷新
					</div>
				)}

				<div>
					<Button
						variant="primary"
						size="sm"
						isPending={importing}
						isDisabled={importing || !pickedFile}
						onPress={handleImport}
					>
						<BiUpload data-icon="inline-start" />
						{importing
							? `还原中${importProgress === null ? "" : ` ${importProgress}%`}...`
							: "导入并还原"}
					</Button>
				</div>
			</section>

			{/* 清理无用素材 */}
			<section className="flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-neutral-800">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
						清理无用素材
					</h3>
					<p className="text-xs text-gray-500 dark:text-neutral-400">
						扫描 data/uploads 目录，删除当前配置中已不被引用的上传文件（图标、Logo、广告图等）。
						执行前会先预览且需手动确认。
					</p>
				</div>
				<div>
					<Button
						variant="outline"
						size="sm"
						isPending={scanning}
						isDisabled={scanning || cleaning}
						onPress={handleScanOrphans}
					>
						<BiTrash data-icon="inline-start" />
						{scanning ? "扫描中..." : "扫描并清理无用素材"}
					</Button>
				</div>
			</section>

			{/* 清理预览确认弹窗 */}
				<Modal.Backdrop
					isOpen={preview !== null}
					onOpenChange={(open) => !open && !cleaning && setPreview(null)}
				>
					<Modal.Container>
						<Modal.Dialog>
							<Modal.Header>
								<Modal.Heading>确认清理无用素材</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								{preview && (
									<div className="flex flex-col gap-3">
										<div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-neutral-300">
											<span>总文件：{preview.total}</span>
											<span>已使用：{preview.used}</span>
											<span className="text-danger font-semibold">
												待删除：{preview.orphanCount}
											</span>
										</div>
										{preview.orphanCount === 0 ? (
											<p className="text-sm text-gray-600 dark:text-neutral-300">
												没有发现可清理的无用素材。
											</p>
										) : (
											<div className="max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs dark:border-neutral-800 dark:bg-neutral-950">
												<ul className="flex flex-col gap-1 font-mono text-gray-700 dark:text-neutral-300">
													{preview.orphans.map((name) => (
														<li key={name} className="truncate">
															{name}
														</li>
													))}
												</ul>
											</div>
										)}
										<p className="text-xs text-amber-700 dark:text-amber-300">
											删除后无法恢复，建议先导出一份备份。
										</p>
									</div>
								)}
							</Modal.Body>
							<Modal.Footer>
								<Button
									variant="outline"
									isDisabled={cleaning}
									onPress={() => setPreview(null)}
								>
									取消
								</Button>
								<Button
									variant="danger"
									isPending={cleaning}
									isDisabled={
										cleaning || !preview || preview.orphanCount === 0
									}
									onPress={handleConfirmCleanup}
								>
									{cleaning ? "删除中..." : "确认删除"}
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>

			{/* 注意事项 */}
			<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
				<p className="mb-1.5 font-semibold">注意事项</p>
				<ul className="list-disc list-inside space-y-1">
					<li>导入还原会直接覆盖服务器上对应的数据文件，请谨慎操作</li>
					<li>为避免导入不可信代码，备份中的脚本类插件会默认禁用</li>
					<li>建议在导入前先导出一份当前数据的备份</li>
					<li>导入成功后页面会自动刷新以加载最新数据</li>
				</ul>
			</div>
		</div>
	);
}
