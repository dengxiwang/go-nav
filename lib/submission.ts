import type { SubmissionConfig, SubmissionInput } from "@/types";

export const DEFAULT_SUBMISSION_CONFIG: Required<SubmissionConfig> = {
	enabled: false,
	showFloatingButton: true,
	showSidebarButton: true,
	staticEmail: "",
};

export const SUBMISSION_FIELD_LIMITS = {
	title: 80,
	url: 500,
	icon: 500,
	description: 500,
	submitterName: 80,
	contact: 120,
	note: 500,
} as const;

export function resolveSubmissionConfig(
	config: SubmissionConfig | undefined,
): Required<SubmissionConfig> {
	return { ...DEFAULT_SUBMISSION_CONFIG, ...(config ?? {}) };
}

export function normalizeSubmissionUrl(raw: string): string {
	const value = raw.trim();
	if (!value) throw new Error("请填写网站地址");
	const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
	let parsed: URL;
	try {
		parsed = new URL(candidate);
	} catch {
		throw new Error("网站地址格式不正确");
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error("网站地址仅支持 http 或 https");
	}
	if (!parsed.hostname) throw new Error("网站地址缺少有效域名");
	parsed.hash = "";
	return parsed.toString();
}

function cleanOptional(value: string | undefined, maxLength: number): string {
	return (value ?? "").trim().slice(0, maxLength);
}

/**
 * 前后端共用的投稿数据归一化；长度在服务端还会再次严格校验。
 */
export function normalizeSubmissionInput(input: SubmissionInput): SubmissionInput {
	return {
		title: input.title.trim().slice(0, SUBMISSION_FIELD_LIMITS.title),
		url: normalizeSubmissionUrl(input.url),
		icon: cleanOptional(input.icon, SUBMISSION_FIELD_LIMITS.icon),
		description: cleanOptional(
			input.description,
			SUBMISSION_FIELD_LIMITS.description,
		),
		submitterName: cleanOptional(
			input.submitterName,
			SUBMISSION_FIELD_LIMITS.submitterName,
		),
		contact: cleanOptional(input.contact, SUBMISSION_FIELD_LIMITS.contact),
		note: cleanOptional(input.note, SUBMISSION_FIELD_LIMITS.note),
		company: input.company ?? "",
	};
}
