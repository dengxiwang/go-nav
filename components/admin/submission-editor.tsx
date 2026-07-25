"use client";

import { CircleCheckFill, Clock, Tray, Xmark } from "@gravity-ui/icons";
import type { Key } from "@heroui/react";
import {
    Button,
    Chip,
    EmptyState,
    Input,
    Label,
    ListBox,
    Modal,
    Pagination,
    Select,
    Spinner,
    Table,
    TextArea,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    toast,
} from "@heroui/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BiCheck, BiLinkExternal, BiRefresh, BiX } from "react-icons/bi";
import { SiteIcon } from "@/components/site-icon";
import { AdminSwitch } from "./admin-switch";
import type {
    NavCategory,
    NavSite,
    SiteSubmission,
    SubmissionConfig,
    SubmissionStatus,
    WebsiteData,
} from "@/types";
import {
    categoriesAtom,
    dirtyAtom,
    navFieldAtom,
    syncDataWithoutDirtyAtom,
} from "@/lib/store/admin";
import { isHtmlDeployment } from "@/lib/client/html-admin";
import { resolveSubmissionConfig } from "@/lib/submission";
import { IconPicker } from "./icon-picker";

interface CategoryOption {
	id: string;
	name: string;
}

interface ReviewForm {
	title: string;
	url: string;
	description: string;
	icon: string;
	tags: string;
	categoryId: string;
	reviewNote: string;
}

interface SubmissionApiResponse {
	error?: string;
	submissions?: SiteSubmission[];
	websiteData?: WebsiteData;
	revision?: string;
}

type SubmissionStatusFilter = "all" | SubmissionStatus;
type PaginationItem = number | "ellipsis-start" | "ellipsis-end";

const SUBMISSIONS_PER_PAGE = 10;

const EMPTY_REVIEW_FORM: ReviewForm = {
	title: "",
	url: "",
	description: "",
	icon: "",
	tags: "",
	categoryId: "",
	reviewNote: "",
};

function collectLeafCategories(
	categories: NavCategory[],
	parents: string[] = [],
): CategoryOption[] {
	const result: CategoryOption[] = [];
	for (const category of categories) {
		const path = [...parents, category.name];
		if (category.children?.length) {
			result.push(...collectLeafCategories(category.children, path));
		} else {
			result.push({ id: category.id, name: path.join(" / ") });
		}
	}
	return result;
}

function statusMeta(status: SubmissionStatus) {
	if (status === "approved") {
		return {
			label: "已收录",
			color: "success" as const,
			icon: <CircleCheckFill width={12} height={12} />,
		};
	}
	if (status === "rejected") {
		return {
			label: "已驳回",
			color: "danger" as const,
			icon: <Xmark width={12} height={12} />,
		};
	}
	return {
		label: "待审核",
		color: "warning" as const,
		icon: <Clock width={12} height={12} />,
	};
}

function getPaginationItems(
	page: number,
	totalPages: number,
): PaginationItem[] {
	if (totalPages <= 7) {
		return Array.from({ length: totalPages }, (_, index) => index + 1);
	}

	const items: PaginationItem[] = [1];
	if (page > 3) items.push("ellipsis-start");

	const start = Math.max(2, page - 1);
	const end = Math.min(totalPages - 1, page + 1);
	for (let current = start; current <= end; current += 1) {
		items.push(current);
	}

	if (page < totalPages - 2) items.push("ellipsis-end");
	items.push(totalPages);
	return items;
}

function formatDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

function SubmissionSwitch({
	label,
	isSelected,
	onChange,
}: {
	label: string;
	isSelected: boolean;
	onChange: (selected: boolean) => void;
}) {
	return (
		<AdminSwitch isSelected={isSelected} onChange={onChange}>
			<span className="text-sm">{label}</span>
		</AdminSwitch>
	);
}

export function SubmissionEditor() {
	const [storedConfig, setStoredConfig] = useAtom(navFieldAtom("submission"));
	const config = resolveSubmissionConfig(storedConfig);
	const categories = useAtomValue(categoriesAtom);
	const dirty = useAtomValue(dirtyAtom);
	const syncData = useSetAtom(syncDataWithoutDirtyAtom);
	const categoryOptions = useMemo(
		() => collectLeafCategories(categories),
		[categories],
	);
	const [submissions, setSubmissions] = useState<SiteSubmission[]>([]);
	const [loading, setLoading] = useState(true);
	const [reviewing, setReviewing] = useState<SiteSubmission | null>(null);
	const [reviewForm, setReviewForm] = useState<ReviewForm>(EMPTY_REVIEW_FORM);
	const [reviewPending, setReviewPending] = useState(false);
	const [statusFilter, setStatusFilter] =
		useState<SubmissionStatusFilter>("all");
	const [page, setPage] = useState(1);

	const patchConfig = (patch: Partial<SubmissionConfig>) => {
		setStoredConfig({ ...config, ...patch });
	};

	const loadSubmissions = useCallback(async () => {
		if (isHtmlDeployment) {
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			const response = await fetch("/api/submissions/", { cache: "no-store" });
			const data = (await response
				.json()
				.catch(() => ({}))) as SubmissionApiResponse;
			if (!response.ok) {
				throw new Error(data.error || `读取失败 (${response.status})`);
			}
			setSubmissions(data.submissions ?? []);
		} catch (error) {
			toast.danger((error as Error).message || "读取投稿失败");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadSubmissions();
	}, [loadSubmissions]);

	const openReview = (submission: SiteSubmission) => {
		setReviewing(submission);
		setReviewForm({
			title: submission.title,
			url: submission.url,
			description: submission.description ?? "",
			icon: submission.publishedSite?.icon ?? submission.icon ?? "",
			tags: submission.publishedSite?.tags?.join(", ") ?? "",
			categoryId: submission.targetCategoryId ?? categoryOptions[0]?.id ?? "",
			reviewNote: submission.reviewNote ?? "",
		});
	};

	const closeReview = () => {
		if (reviewPending) return;
		setReviewing(null);
		setReviewForm(EMPTY_REVIEW_FORM);
	};

	const submitReview = async (action: "approve" | "reject") => {
		if (!reviewing || reviewPending) return;
		if (action === "approve" && dirty) {
			toast.warning("请先保存页面顶部的配置改动，再执行收录");
			return;
		}
		if (action === "approve" && !reviewForm.categoryId) {
			toast.warning("请选择收录分类");
			return;
		}
		setReviewPending(true);
		try {
			const site: Partial<NavSite> = {
				title: reviewForm.title,
				url: reviewForm.url,
				description: reviewForm.description,
				icon: reviewForm.icon,
				tags: reviewForm.tags
					.split(/[,，]/)
					.map((tag) => tag.trim())
					.filter(Boolean),
			};
			const response = await fetch("/api/submissions/", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: reviewing.id,
					action,
					reviewNote: reviewForm.reviewNote,
					categoryId: reviewForm.categoryId,
					site,
				}),
			});
			const data = (await response
				.json()
				.catch(() => ({}))) as SubmissionApiResponse;
			if (!response.ok) {
				throw new Error(data.error || `审核失败 (${response.status})`);
			}
			setSubmissions(data.submissions ?? submissions);
			if (data.websiteData) {
				syncData({
					websiteData: data.websiteData,
					revision: data.revision,
				});
			}
			toast.success(action === "approve" ? "已收录到指定分类" : "已驳回投稿");
			setReviewing(null);
			setReviewForm(EMPTY_REVIEW_FORM);
		} catch (error) {
			toast.danger((error as Error).message || "审核失败");
		} finally {
			setReviewPending(false);
		}
	};

	const counts = useMemo(
		() => ({
			pending: submissions.filter((item) => item.status === "pending").length,
			approved: submissions.filter((item) => item.status === "approved").length,
			rejected: submissions.filter((item) => item.status === "rejected").length,
		}),
		[submissions],
	);
	const selectedStatusKeys = useMemo(
		() => new Set<Key>([statusFilter]),
		[statusFilter],
	);
	const filteredSubmissions = useMemo(
		() =>
			statusFilter === "all"
				? submissions
				: submissions.filter((item) => item.status === statusFilter),
		[submissions, statusFilter],
	);
	const totalPages = Math.max(
		1,
		Math.ceil(filteredSubmissions.length / SUBMISSIONS_PER_PAGE),
	);
	const currentPage = Math.min(page, totalPages);
	const paginatedSubmissions = useMemo(() => {
		const start = (currentPage - 1) * SUBMISSIONS_PER_PAGE;
		return filteredSubmissions.slice(start, start + SUBMISSIONS_PER_PAGE);
	}, [currentPage, filteredSubmissions]);
	const paginationItems = getPaginationItems(currentPage, totalPages);
	const firstVisibleItem = filteredSubmissions.length
		? (currentPage - 1) * SUBMISSIONS_PER_PAGE + 1
		: 0;
	const lastVisibleItem = Math.min(
		currentPage * SUBMISSIONS_PER_PAGE,
		filteredSubmissions.length,
	);
	const isReviewEditable = reviewing?.status === "pending";

	const changeStatusFilter = (keys: Set<Key>) => {
		const next = [...keys][0] as SubmissionStatusFilter | undefined;
		if (!next) return;
		setStatusFilter(next);
		setPage(1);
	};

	return (
		<div className="flex flex-col gap-4">
			<section className="flex flex-col gap-4">
				<div>
					<h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
						投稿功能配置
					</h3>
					<p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
						统一管理前台投稿入口和接收方式，修改后需点击页面顶部保存。
					</p>
				</div>

				<SubmissionSwitch
					label="开启投稿收录"
					isSelected={config.enabled}
					onChange={(enabled) => patchConfig({ enabled })}
				/>

				<div className="flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-neutral-800">
					<div>
						<h4 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
							入口位置
						</h4>
						<p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
							左侧入口显示在分类列表广告上方；右下角入口不受布局配置中的悬浮操作按钮总开关影响。
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-2">
						<SubmissionSwitch
							label="左侧分类入口"
							isSelected={config.showSidebarButton}
							onChange={(showSidebarButton) =>
								patchConfig({ showSidebarButton })
							}
						/>
						<SubmissionSwitch
							label="右下角悬浮入口"
							isSelected={config.showFloatingButton}
							onChange={(showFloatingButton) =>
								patchConfig({ showFloatingButton })
							}
						/>
					</div>
				</div>

				<div className="flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-neutral-800">
					<div>
						<h4 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
							静态部署投稿邮箱
						</h4>
						<p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
							仅静态部署使用；留空时静态站点不会开放投稿入口。
						</p>
					</div>
					<TextField
						className="max-w-xl"
						type="email"
						value={config.staticEmail}
						onChange={(staticEmail) => patchConfig({ staticEmail })}
					>
						<Label className="sr-only">静态部署投稿邮箱</Label>
						<Input placeholder="owner@example.com" />
					</TextField>
				</div>

				<div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/30">
					<p className="text-xs font-medium text-blue-700 dark:text-blue-300">
						部署方式由系统自动识别
					</p>
					<div className="mt-1.5 grid gap-1 text-xs leading-5 text-blue-700/80 md:grid-cols-2 dark:text-blue-300/80">
						<p>动态部署：投稿进入本地审核队列，通过后加入所选分类。</p>
						<p>静态部署：投稿表单生成预填邮件，发送到上方配置的邮箱。</p>
					</div>
				</div>
			</section>

			{isHtmlDeployment ? (
				<div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-xs leading-5 text-warning-soft-foreground">
					纯静态部署没有服务端投稿审核队列；这里保留投稿入口和接收邮箱配置，访客投稿时会打开邮件客户端。
				</div>
			) : null}

			<section
				className={`flex flex-col gap-4 border-t border-gray-100 pt-4 dark:border-neutral-800 ${
					isHtmlDeployment ? "hidden" : ""
				}`}
			>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h3 className="text-base font-semibold">投稿审核</h3>
						<ToggleButtonGroup
							aria-label="按审核状态筛选"
							className="mt-2"
							disallowEmptySelection
							selectedKeys={selectedStatusKeys}
							selectionMode="single"
							size="sm"
							onSelectionChange={changeStatusFilter}
						>
							<ToggleButton className="text-xs!" id="all">
								全部 {submissions.length}
							</ToggleButton>
							<ToggleButton className="text-xs!" id="pending">
								<ToggleButtonGroup.Separator />
								待审核 {counts.pending}
							</ToggleButton>
							<ToggleButton className="text-xs!" id="approved">
								<ToggleButtonGroup.Separator />
								已收录 {counts.approved}
							</ToggleButton>
							<ToggleButton className="text-xs!" id="rejected">
								<ToggleButtonGroup.Separator />
								已驳回 {counts.rejected}
							</ToggleButton>
						</ToggleButtonGroup>
					</div>
					<Button
						variant="outline"
						size="sm"
						isPending={loading}
						onPress={() => void loadSubmissions()}
					>
						<BiRefresh className="size-4" />
						刷新
					</Button>
				</div>

				<Table
					variant="secondary"
					aria-label="投稿审核列表"
					className={paginatedSubmissions.length === 0 ? "min-h-70" : undefined}
				>
					<Table.ScrollContainer>
						<Table.Content
							aria-label="投稿审核列表"
							className="h-full min-w-472"
						>
							<Table.Header>
								<Table.Column className="w-20 whitespace-nowrap">
									图标
								</Table.Column>
								<Table.Column
									isRowHeader
									className="min-w-40 whitespace-nowrap"
								>
									网站名称
								</Table.Column>
								<Table.Column className="min-w-64 whitespace-nowrap">
									网站地址
								</Table.Column>
								<Table.Column className="min-w-56 whitespace-nowrap">
									网站简介
								</Table.Column>
								<Table.Column className="min-w-48 whitespace-nowrap">
									投稿备注
								</Table.Column>
								<Table.Column className="min-w-32 whitespace-nowrap">
									投稿人
								</Table.Column>
								<Table.Column className="min-w-44 whitespace-nowrap">
									联系方式
								</Table.Column>
								<Table.Column className="min-w-28 whitespace-nowrap">
									状态
								</Table.Column>
								<Table.Column className="min-w-32 whitespace-nowrap">
									收录分类
								</Table.Column>
								<Table.Column className="min-w-40 whitespace-nowrap">
									审核备注
								</Table.Column>
								<Table.Column className="w-40 whitespace-nowrap">
									提交时间
								</Table.Column>
								<Table.Column className="w-24 whitespace-nowrap">
									操作
								</Table.Column>
							</Table.Header>
							<Table.Body>
								{paginatedSubmissions.map((submission) => {
									const meta = statusMeta(submission.status);
									return (
										<Table.Row
											key={submission.id}
											id={submission.id}
											textValue={submission.title}
										>
											<Table.Cell>
												<SiteIcon
													site={{
														title: submission.title,
														icon:
															submission.publishedSite?.icon ?? submission.icon,
													}}
													size={32}
													className="border border-default-200"
													initialClassName="text-xs"
												/>
											</Table.Cell>
											<Table.Cell className="whitespace-nowrap font-medium">
												{submission.title}
											</Table.Cell>
											<Table.Cell>
												<a
													href={submission.url}
													target="_blank"
													rel="noopener noreferrer"
													title={submission.url}
													className="flex max-w-64 items-center gap-1 whitespace-nowrap text-primary"
												>
													<span className="truncate">{submission.url}</span>
													<BiLinkExternal className="size-3 shrink-0" />
												</a>
											</Table.Cell>
											<Table.Cell className="max-w-56 truncate whitespace-nowrap">
												<span title={submission.description || ""}>
													{submission.description || "—"}
												</span>
											</Table.Cell>
											<Table.Cell className="max-w-48 truncate whitespace-nowrap">
												<span title={submission.note || ""}>
													{submission.note || "—"}
												</span>
											</Table.Cell>
											<Table.Cell className="whitespace-nowrap">
												{submission.submitterName || "匿名"}
											</Table.Cell>
											<Table.Cell className="max-w-44 truncate whitespace-nowrap">
												<span title={submission.contact || ""}>
													{submission.contact || "—"}
												</span>
											</Table.Cell>
											<Table.Cell>
												<Chip color={meta.color} size="sm">
													{meta.icon}
													<Chip.Label>{meta.label}</Chip.Label>
												</Chip>
											</Table.Cell>
											<Table.Cell className="whitespace-nowrap">
												{submission.targetCategoryName || "—"}
											</Table.Cell>
											<Table.Cell className="max-w-40 truncate whitespace-nowrap">
												<span title={submission.reviewNote || ""}>
													{submission.reviewNote || "—"}
												</span>
											</Table.Cell>
											<Table.Cell className="whitespace-nowrap text-xs text-default-500">
												{formatDate(submission.createdAt)}
											</Table.Cell>
											<Table.Cell>
												<Button
													size="sm"
													variant="outline"
													onPress={() => openReview(submission)}
												>
													{submission.status === "pending" ? "审核" : "查看"}
												</Button>
											</Table.Cell>
										</Table.Row>
									);
								})}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
					{filteredSubmissions.length === 0 ? (
						<Table.Footer className="min-h-52 justify-center p-0">
							<EmptyState className="flex w-full flex-col items-center justify-center gap-3 text-center">
								{loading ? (
									<Spinner size="sm" aria-label="正在读取投稿" />
								) : (
									<Tray width={28} height={28} className="text-muted" />
								)}
								<div className="space-y-1">
									<p className="font-medium text-foreground">
										{loading
											? "正在读取投稿"
											: submissions.length > 0
												? "当前状态暂无投稿"
												: "暂无投稿记录"}
									</p>
									<p className="text-xs text-muted">
										{loading
											? "请稍候，正在加载本地审核队列。"
											: submissions.length > 0
												? "可以切换其他审核状态查看投稿记录。"
												: "收到的新投稿会显示在这里。"}
									</p>
								</div>
							</EmptyState>
						</Table.Footer>
					) : (
						<Table.Footer>
							<Pagination className="w-full flex-wrap gap-3" size="sm">
								<Pagination.Summary className="text-xs! text-default-500">
									显示 {firstVisibleItem}-{lastVisibleItem}，共{" "}
									{filteredSubmissions.length} 条
								</Pagination.Summary>
								<Pagination.Content>
									<Pagination.Item>
										<Pagination.Previous
											isDisabled={currentPage === 1}
											onPress={() => setPage(Math.max(1, currentPage - 1))}
										>
											<Pagination.PreviousIcon />
											<span>上一页</span>
										</Pagination.Previous>
									</Pagination.Item>
									{paginationItems.map((item) =>
										typeof item === "number" ? (
											<Pagination.Item key={item}>
												<Pagination.Link
													isActive={item === currentPage}
													onPress={() => setPage(item)}
												>
													{item}
												</Pagination.Link>
											</Pagination.Item>
										) : (
											<Pagination.Item key={item}>
												<Pagination.Ellipsis />
											</Pagination.Item>
										),
									)}
									<Pagination.Item>
										<Pagination.Next
											isDisabled={currentPage === totalPages}
											onPress={() =>
												setPage(Math.min(totalPages, currentPage + 1))
											}
										>
											<span>下一页</span>
											<Pagination.NextIcon />
										</Pagination.Next>
									</Pagination.Item>
								</Pagination.Content>
							</Pagination>
						</Table.Footer>
					)}
				</Table>
			</section>

				<Modal.Backdrop
					isOpen={reviewing !== null}
					isDismissable={!reviewPending}
					isKeyboardDismissDisabled={reviewPending}
					onOpenChange={(open) => !open && closeReview()}
				>
					<Modal.Container size="lg" scroll="inside">
						<Modal.Dialog className="sm:max-w-2xl">
							<Modal.CloseTrigger />
							<Modal.Header className="gap-1">
								<Modal.Heading>
									{reviewing?.status === "pending" ? "审核投稿" : "投稿详情"}
								</Modal.Heading>
								{reviewing && (
									<p className="mt-1 text-sm text-default-500">
										投稿人：{reviewing.submitterName || "匿名"} ·{" "}
										{reviewing.contact || "未留联系方式"}
									</p>
								)}
							</Modal.Header>
							<Modal.Body className="flex flex-col gap-4 p-6 mt-3!">
								<TextField
									isDisabled={!isReviewEditable}
									value={reviewForm.title}
									onChange={(title) =>
										setReviewForm((form) => ({ ...form, title }))
									}
								>
									<Label>网站名称</Label>
									<Input />
								</TextField>
								<TextField
									isDisabled={!isReviewEditable}
									value={reviewForm.url}
									onChange={(url) =>
										setReviewForm((form) => ({ ...form, url }))
									}
								>
									<Label>网站地址</Label>
									<Input inputMode="url" />
								</TextField>
								<TextField
									isDisabled={!isReviewEditable}
									value={reviewForm.description}
									onChange={(description) =>
										setReviewForm((form) => ({ ...form, description }))
									}
								>
									<Label>网站简介</Label>
									<TextArea rows={3} />
								</TextField>
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="flex flex-col gap-1">
										<span className="text-sm font-medium">
											网站图标（可选）
										</span>
										<IconPicker
											value={reviewForm.icon}
											isDisabled={!isReviewEditable}
											placeholder="图标 URL、emoji 或上传"
											onChange={(icon) =>
												setReviewForm((form) => ({ ...form, icon }))
											}
										/>
									</div>
									<TextField
										isDisabled={!isReviewEditable}
										value={reviewForm.tags}
										onChange={(tags) =>
											setReviewForm((form) => ({ ...form, tags }))
										}
									>
										<Label>标签（逗号分隔）</Label>
										<Input placeholder="工具, 设计" />
									</TextField>
								</div>
								<Select
									placeholder="选择收录分类"
									selectedKey={reviewForm.categoryId || null}
									isDisabled={!isReviewEditable}
									onSelectionChange={(key) =>
										setReviewForm((form) => ({
											...form,
											categoryId: key ? String(key) : "",
										}))
									}
								>
									<Label>收录分类</Label>
									<Select.Trigger>
										<Select.Value />
										<Select.Indicator />
									</Select.Trigger>
									<Select.Popover>
										<ListBox>
											{categoryOptions.map((category) => (
												<ListBox.Item
													key={category.id}
													id={category.id}
													textValue={category.name}
												>
													{category.name}
													<ListBox.ItemIndicator />
												</ListBox.Item>
											))}
										</ListBox>
									</Select.Popover>
								</Select>
								<TextField
									isDisabled={!isReviewEditable}
									value={reviewForm.reviewNote}
									onChange={(reviewNote) =>
										setReviewForm((form) => ({ ...form, reviewNote }))
									}
								>
									<Label>审核备注（可选）</Label>
									<TextArea rows={2} placeholder="收录说明或驳回原因" />
								</TextField>
								{reviewing?.status === "pending" && dirty && (
									<p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
										当前有未保存配置。请先点击页面顶部“保存”，再审核收录，避免覆盖配置。
									</p>
								)}
							</Modal.Body>
							<Modal.Footer>
								<Button
									variant="secondary"
									isDisabled={reviewPending}
									onPress={closeReview}
								>
									关闭
								</Button>
								{reviewing?.status === "pending" && (
									<>
										<Button
											variant="danger"
											isDisabled={reviewPending}
											onPress={() => void submitReview("reject")}
										>
											<BiX />
											驳回
										</Button>
										<Button
											isPending={reviewPending}
											isDisabled={
												reviewPending || dirty || categoryOptions.length === 0
											}
											onPress={() => void submitReview("approve")}
										>
											<BiCheck />
											审核并收录
										</Button>
									</>
								)}
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
		</div>
	);
}
