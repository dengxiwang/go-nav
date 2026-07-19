import { pinyin } from "pinyin-pro";

export interface PinyinVariants {
	full: string;
	initials: string;
}

export interface PinyinSearchIndexEntry {
	title: string;
	titlePinyin: string;
	titleInitials: string;
	hay: string;
}

interface SearchableSite {
	title?: string;
	description?: string;
	url?: string;
	tags?: string[];
	categoryName?: string;
}

/**
 * pinyin-pro 体积较大，本模块只能通过动态 import 按需加载。
 * 一次转换同时产出全拼和首字母，避免对同一文本重复计算。
 */
export function createPinyinVariants(text: string): PinyinVariants {
	const syllables = pinyin(text, { toneType: "none", type: "array" });
	return {
		full: syllables.join("").toLowerCase(),
		initials: syllables.map((item) => item.charAt(0)).join("").toLowerCase(),
	};
}

export function buildPinyinSearchIndexEntry(
	site: SearchableSite,
): PinyinSearchIndexEntry {
	const title = (site.title ?? "").toLowerCase();
	const variants = createPinyinVariants(title);

	return {
		title,
		titlePinyin: variants.full,
		titleInitials: variants.initials,
		hay: (
			title +
			"\u0001" +
			variants.full +
			"\u0001" +
			variants.initials +
			"\u0001" +
			(site.description ?? "") +
			"\u0001" +
			(site.url ?? "") +
			"\u0001" +
			(site.tags ? site.tags.join(" ") : "") +
			"\u0001" +
			(site.categoryName ?? "")
		).toLowerCase(),
	};
}
