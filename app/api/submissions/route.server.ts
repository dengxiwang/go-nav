import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type {
	NavCategory,
	NavSite,
	SiteSubmission,
	SubmissionInput,
} from "@/types";
import { requireAdminAuth } from "@/lib/server/api-auth";
import { revalidateFrontendPaths } from "@/lib/server/revalidate-frontend";
import {
	createSubmission,
	readSubmissionData,
	sortSubmissions,
	withSubmissionMutationLock,
	writeSubmissionData,
} from "@/lib/server/submissions";
import {
	getConfigRevision,
	readNav,
	readWebsiteData,
	writeWebsiteData,
} from "@/lib/server/store";
import {
	normalizeSubmissionInput,
	normalizeSubmissionUrl,
	resolveSubmissionConfig,
	SUBMISSION_FIELD_LIMITS,
} from "@/lib/submission";

const MAX_BODY_SIZE = 32 * 1024;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const submissionRateLimits = new Map<
	string,
	{ count: number; resetAt: number }
>();

function json(
	body: unknown,
	init?: ResponseInit,
): NextResponse {
	const response = NextResponse.json(body, init);
	response.headers.set("Cache-Control", "no-store");
	return response;
}

async function readJsonBody(req: Request): Promise<unknown> {
	const contentLength = Number.parseInt(
		req.headers.get("content-length") ?? "",
		10,
	);
	if (Number.isFinite(contentLength) && contentLength > MAX_BODY_SIZE) {
		throw new Error("提交内容过大");
	}
	const text = await req.text();
	if (text.length > MAX_BODY_SIZE) throw new Error("提交内容过大");
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new Error("提交内容格式不正确");
	}
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: {};
}

function asString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function validateFieldLength(
	label: string,
	value: string,
	max: number,
): void {
	if (value.trim().length > max) {
		throw new Error(`${label}不能超过 ${max} 个字符`);
	}
}

function parseSubmissionInput(value: unknown): SubmissionInput {
	const body = asRecord(value);
	const raw: SubmissionInput = {
		title: asString(body.title),
		url: asString(body.url),
		icon: asString(body.icon),
		description: asString(body.description),
		submitterName: asString(body.submitterName),
		contact: asString(body.contact),
		note: asString(body.note),
		company: asString(body.company),
	};
	validateFieldLength("网站名称", raw.title, SUBMISSION_FIELD_LIMITS.title);
	validateFieldLength("网站地址", raw.url, SUBMISSION_FIELD_LIMITS.url);
	validateFieldLength("网站图标", raw.icon ?? "", SUBMISSION_FIELD_LIMITS.icon);
	validateFieldLength(
		"网站简介",
		raw.description ?? "",
		SUBMISSION_FIELD_LIMITS.description,
	);
	validateFieldLength(
		"投稿人",
		raw.submitterName ?? "",
		SUBMISSION_FIELD_LIMITS.submitterName,
	);
	validateFieldLength(
		"联系方式",
		raw.contact ?? "",
		SUBMISSION_FIELD_LIMITS.contact,
	);
	validateFieldLength("备注", raw.note ?? "", SUBMISSION_FIELD_LIMITS.note);
	const input = normalizeSubmissionInput(raw);
	if (!input.title) throw new Error("请填写网站名称");
	return input;
}

function getClientKey(req: Request): string {
	const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	return forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
}

function consumeRateLimit(key: string): boolean {
	const now = Date.now();
	const current = submissionRateLimits.get(key);
	if (!current || current.resetAt <= now) {
		submissionRateLimits.set(key, {
			count: 1,
			resetAt: now + RATE_LIMIT_WINDOW,
		});
		return true;
	}
	if (current.count >= RATE_LIMIT_MAX) return false;
	current.count += 1;
	return true;
}

function canonicalUrl(value: string): string {
	try {
		return normalizeSubmissionUrl(value).replace(/\/$/, "").toLowerCase();
	} catch {
		return value.trim().replace(/\/$/, "").toLowerCase();
	}
}

function hasPendingDuplicate(items: SiteSubmission[], url: string): boolean {
	const normalized = canonicalUrl(url);
	return items.some(
		(item) =>
			item.status === "pending" && canonicalUrl(item.url) === normalized,
	);
}

/** 前台动态投稿。静态构建中该 server 路由不会被导出。 */
export async function POST(req: Request) {
	try {
		const config = resolveSubmissionConfig(readNav().submission);
		if (!config.enabled) {
			return json({ error: "投稿收录暂未开放" }, { status: 403 });
		}
		const input = parseSubmissionInput(await readJsonBody(req));
		// 蜜罐字段命中时返回与正常提交一致的响应，但不写入审核队列。
		if (input.company?.trim()) return json({ ok: true }, { status: 201 });
		if (!consumeRateLimit(getClientKey(req))) {
			return json(
				{ error: "提交过于频繁，请稍后再试" },
				{ status: 429 },
			);
		}
		return await withSubmissionMutationLock(() => {
			const data = readSubmissionData();
			if (hasPendingDuplicate(data.submissions, input.url)) {
				return json(
					{ error: "该网址已经在待审核队列中，请勿重复提交" },
					{ status: 409 },
				);
			}
			const submission = createSubmission(input);
			writeSubmissionData({ submissions: [submission, ...data.submissions] });
			return json({ ok: true, id: submission.id }, { status: 201 });
		});
	} catch (error) {
		return json(
			{ error: (error as Error).message || "提交失败" },
			{ status: 400 },
		);
	}
}

/** 后台读取投稿审核队列。 */
export async function GET() {
	if (!(await requireAdminAuth())) {
		return json({ error: "未登录" }, { status: 401 });
	}
	return json({
		submissions: sortSubmissions(readSubmissionData().submissions),
	});
}

interface ReviewBody {
	id: string;
	action: "approve" | "reject";
	reviewNote: string;
	categoryId: string;
	site: Partial<NavSite>;
}

function parseReviewBody(value: unknown): ReviewBody {
	const body = asRecord(value);
	const action = asString(body.action);
	if (action !== "approve" && action !== "reject") {
		throw new Error("不支持的审核操作");
	}
	return {
		id: asString(body.id),
		action,
		reviewNote: asString(body.reviewNote).trim().slice(0, 500),
		categoryId: asString(body.categoryId),
		site: asRecord(body.site) as Partial<NavSite>,
	};
}

function findCategory(
	categories: NavCategory[],
	id: string,
): NavCategory | null {
	for (const category of categories) {
		if (category.id === id) return category;
		const child = findCategory(category.children ?? [], id);
		if (child) return child;
	}
	return null;
}

function addSiteToCategory(
	categories: NavCategory[],
	categoryId: string,
	site: NavSite,
): NavCategory[] {
	return categories.map((category) => {
		if (category.id === categoryId) {
			return { ...category, sites: [...(category.sites ?? []), site] };
		}
		if (!category.children?.length) return category;
		return {
			...category,
			children: addSiteToCategory(category.children, categoryId, site),
		};
	});
}

function allSites(categories: NavCategory[]): NavSite[] {
	const result: NavSite[] = [];
	for (const category of categories) {
		result.push(...(category.sites ?? []));
		result.push(...allSites(category.children ?? []));
	}
	return result;
}

function parseApprovedSite(
	input: Partial<NavSite>,
	fallback: SiteSubmission,
): NavSite {
	const title = asString(input.title || fallback.title).trim();
	if (!title) throw new Error("请填写网站名称");
	if (title.length > SUBMISSION_FIELD_LIMITS.title) {
		throw new Error(`网站名称不能超过 ${SUBMISSION_FIELD_LIMITS.title} 个字符`);
	}
	const description = asString(input.description ?? fallback.description)
		.trim()
		.slice(0, SUBMISSION_FIELD_LIMITS.description);
	const url = normalizeSubmissionUrl(asString(input.url || fallback.url));
	const tags = Array.isArray(input.tags)
		? input.tags
				.filter((tag): tag is string => typeof tag === "string")
				.map((tag) => tag.trim())
				.filter(Boolean)
				.slice(0, 20)
		: [];
	return {
		id: randomUUID(),
		title,
		description,
		url,
		icon:
			asString(input.icon ?? fallback.icon)
				.trim()
				.slice(0, SUBMISSION_FIELD_LIMITS.icon) || undefined,
		tags,
	};
}

/** 后台驳回或审核通过并写入指定分类。 */
export async function PATCH(req: Request) {
	if (!(await requireAdminAuth())) {
		return json({ error: "未登录" }, { status: 401 });
	}
	try {
		const body = parseReviewBody(await readJsonBody(req));
		return await withSubmissionMutationLock(() => {
			const data = readSubmissionData();
			const index = data.submissions.findIndex((item) => item.id === body.id);
			if (index < 0) return json({ error: "投稿记录不存在" }, { status: 404 });
			const current = data.submissions[index];
			if (current.status !== "pending") {
				return json({ error: "该投稿已经完成审核" }, { status: 409 });
			}
			const now = new Date().toISOString();

			if (body.action === "reject") {
				const next: SiteSubmission = {
					...current,
					status: "rejected",
					reviewNote: body.reviewNote,
					reviewedAt: now,
					updatedAt: now,
				};
				const submissions = data.submissions.slice();
				submissions[index] = next;
				writeSubmissionData({ submissions });
				return json({ ok: true, submissions: sortSubmissions(submissions) });
			}

			if (!body.categoryId) throw new Error("请选择收录分类");
			const websiteData = readWebsiteData();
			const category = findCategory(websiteData.categories, body.categoryId);
			if (!category) throw new Error("目标分类不存在，请刷新后重试");
			if (category.children?.length) throw new Error("请选择没有子分类的分类");
			const site = parseApprovedSite(body.site, current);
			if (
				allSites(websiteData.categories).some(
					(item) => canonicalUrl(item.url) === canonicalUrl(site.url),
				)
			) {
				return json({ error: "该网址已存在于网站列表中" }, { status: 409 });
			}

			const nextWebsiteData = {
				...websiteData,
				categories: addSiteToCategory(
					websiteData.categories,
					body.categoryId,
					site,
				),
			};
			writeWebsiteData(nextWebsiteData);
			const next: SiteSubmission = {
				...current,
				status: "approved",
				title: site.title,
				url: site.url,
				icon: site.icon,
				description: site.description,
				reviewNote: body.reviewNote,
				targetCategoryId: category.id,
				targetCategoryName: category.name,
				publishedSite: site,
				reviewedAt: now,
				updatedAt: now,
			};
			const submissions = data.submissions.slice();
			submissions[index] = next;
			writeSubmissionData({ submissions });
			revalidateFrontendPaths();
			return json({
				ok: true,
				submissions: sortSubmissions(submissions),
				websiteData: nextWebsiteData,
				revision: getConfigRevision(),
			});
		});
	} catch (error) {
		return json(
			{ error: (error as Error).message || "审核失败" },
			{ status: 400 },
		);
	}
}
