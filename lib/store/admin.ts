/**
 * 后台管理 Jotai 原子定义。
 *
 * 设计要点：
 * - websiteDataAtom / navAtom 为根原子，Provider 层用 useHydrateAtoms 注入 SSR 数据。
 * - dirtyAtom 使用显式 dirty flag，避免每次编辑都 JSON.stringify 全量配置。
 * - 按字段 + 数组项索引拆分，避免一次 setNav 引发全部编辑器重渲染。
 */
import { atom } from "jotai";
import { atomFamily } from "jotai-family";
import {
	downloadConfigZip,
	isHtmlDeployment,
} from "@/lib/client/html-admin";
import type {
    AdConfig,
    NavCategory,
    NavConfig,
    PluginConfig,
    SearchEngine,
    WebsiteData,
} from "@/types";

/** 占位初始值，Provider 内 useHydrateAtoms 会立即覆盖 */
const EMPTY_WEBSITE: WebsiteData = { categories: [] };
const EMPTY_NAV: NavConfig = {
	title: "",
	name: "",
	description: "",
	keywords: [],
	logo: "",
	favicon: "",
	author: "",
	copyright: "",
	icp: "",
	beian: "",
	qrCode: "",
	qrCodeText: "",
	footerLinks: [],
	search: {
		defaultEngine: "",
		enableLocalSearch: false,
		placeholder: "",
		engines: [],
	},
	ads: [],
	imageUpload: {
		compress: false,
		convertToWebp: false,
	},
};

// ─── 根原子 ──────────────────────────────────────────────────────────────

/**
 * 内部 base 原子——仅供 hydrate 层写入初始值，不对外语义暴露。
 * 编辑器统一通过 navAtom / websiteDataAtom 写入（会自动触发 dirty）。
 */
export const _navBaseAtom = atom<NavConfig>(EMPTY_NAV);
export const _websiteDataBaseAtom = atom<WebsiteData>(EMPTY_WEBSITE);
export const _savedNavAtom = atom<NavConfig>(EMPTY_NAV);
export const _savedWebsiteDataAtom = atom<WebsiteData>(EMPTY_WEBSITE);

export const savingAtom = atom(false);
export const configRevisionAtom = atom<string>("");
const dirtyFlagAtom = atom(false);

export const dirtyAtom = atom(
	(get) => get(dirtyFlagAtom),
	(get, set, dirty: boolean) => {
		if (dirty) {
			set(dirtyFlagAtom, true);
			return;
		}
		set(_savedNavAtom, get(_navBaseAtom));
		set(_savedWebsiteDataAtom, get(_websiteDataBaseAtom));
		set(dirtyFlagAtom, false);
	},
);

/**
 * 对外暴露的 websiteData / nav 可写派生原子。
 * 任何写入（包括编辑器直接 setValue）都会更新当前数据；dirty 由快照对比自动计算。
 */
export const websiteDataAtom = atom(
	(get) => get(_websiteDataBaseAtom),
	(get, set, next: WebsiteData) => {
		if (get(_websiteDataBaseAtom) === next) return;
		set(_websiteDataBaseAtom, next);
		set(dirtyAtom, true);
	},
);
export const navAtom = atom(
	(get) => get(_navBaseAtom),
	(get, set, next: NavConfig) => {
		if (get(_navBaseAtom) === next) return;
		set(_navBaseAtom, next);
		set(dirtyAtom, true);
	},
);

// ─── Nav 字段级读写原子（按 key 缓存） ─────────────────────────────────────

// 按字段 focus 的 atom 缓存：类型在 navFieldAtom 处收窄，缓存层本身保持宽松。
const navFieldCache = new Map<keyof NavConfig, unknown>();

/**
 * 按字段 focus 的读写原子，同一个 key 复用同一个 atom 实例。
 * 写入时更新 navAtom 并设置 dirty。
 */
export function navFieldAtom<K extends keyof NavConfig>(key: K) {
	const cached = navFieldCache.get(key) as
		| ReturnType<typeof makeNavFieldAtom<K>>
		| undefined;
	if (cached) return cached;
	const a = makeNavFieldAtom(key);
	navFieldCache.set(key, a);
	return a;
}

function makeNavFieldAtom<K extends keyof NavConfig>(key: K) {
	return atom(
		(get) => get(navAtom)[key],
		(get, set, value: NavConfig[K]) => {
			const current = get(navAtom);
			if (current[key] === value) return;
			set(navAtom, { ...current, [key]: value });
			set(dirtyAtom, true);
		},
	);
}

// ─── WebsiteData: categories ─────────────────────────────────────────────

export const categoriesAtom = atom(
	(get) => get(websiteDataAtom).categories,
	(get, set, next: NavCategory[]) => {
		const current = get(websiteDataAtom);
		if (current.categories === next) return;
		set(websiteDataAtom, { ...current, categories: next });
		set(dirtyAtom, true);
	},
);

// ─── Nav: ads 数组 + 单项 ─────────────────────────────────────────────────

export const adsAtom = atom(
	(get) => get(navAtom).ads,
	(get, set, next: AdConfig[]) => {
		const current = get(navAtom);
		if (current.ads === next) return;
		set(navAtom, { ...current, ads: next });
		set(dirtyAtom, true);
	},
);

/**
 * 单个广告的读写原子，按 id 复用。
 * 读取时根据当前 ads 数组查找，返回 undefined 时 UI 应当自动卸载对应 Row。
 * 写入时以 patch 形式合并，避免 Row 内手动展开整对象。
 */
export const adAtomFamily = atomFamily((id: string) =>
	atom(
		(get) => get(adsAtom).find((a) => a.id === id),
		(get, set, patch: Partial<AdConfig>) => {
			const list = get(adsAtom);
			const idx = list.findIndex((a) => a.id === id);
			if (idx < 0) return;
			const copy = list.slice();
			copy[idx] = { ...copy[idx], ...patch };
			set(adsAtom, copy);
		},
	),
);

// ─── Nav: search 对象 + 引擎数组 + 单项 ───────────────────────────────────

export const searchAtom = atom(
	(get) => get(navAtom).search,
	(get, set, patch: Partial<NavConfig["search"]>) => {
		const current = get(navAtom);
		set(navAtom, { ...current, search: { ...current.search, ...patch } });
		set(dirtyAtom, true);
	},
);

export const enginesAtom = atom(
	(get) => get(navAtom).search.engines,
	(get, set, next: SearchEngine[]) => {
		const current = get(navAtom);
		if (current.search.engines === next) return;
		set(navAtom, {
			...current,
			search: { ...current.search, engines: next },
		});
		set(dirtyAtom, true);
	},
);

export const engineAtomFamily = atomFamily((id: string) =>
	atom(
		(get) => get(enginesAtom).find((e) => e.id === id),
		(get, set, patch: Partial<SearchEngine>) => {
			const list = get(enginesAtom);
			const idx = list.findIndex((e) => e.id === id);
			if (idx < 0) return;
			const copy = list.slice();
			copy[idx] = { ...copy[idx], ...patch };
			set(enginesAtom, copy);
		},
	),
);

// ─── Nav: plugins 数组 + 单项 ────────────────────────────

/** 插件列表 atom（读写），写入时自动标记 dirty */
export const pluginsAtom = atom(
	(get) => get(navAtom).plugins ?? [],
	(get, set, next: PluginConfig[]) => {
		const current = get(navAtom);
		if (current.plugins === next) return;
		set(navAtom, { ...current, plugins: next });
		set(dirtyAtom, true);
	},
);

/**
 * 单个插件的读写原子，按 id 复用。
 * 写入时以 patch 形式合并，避免 Row 内手动展开整对象。
 */
export const pluginAtomFamily = atomFamily((id: string) =>
	atom(
		(get) => get(pluginsAtom).find((p) => p.id === id),
		(get, set, patch: Partial<PluginConfig>) => {
			const list = get(pluginsAtom);
			const idx = list.findIndex((p) => p.id === id);
			if (idx < 0) return;
			const copy = list.slice();
			copy[idx] = { ...copy[idx], ...patch };
			set(pluginsAtom, copy);
		},
	),
);

// ─── 保存动作（write-only） ───────────────────────────────────────────────

export const saveAtom = atom(null, async (get, set) => {
	if (get(savingAtom)) return { ok: false as const, error: "" };
	set(savingAtom, true);
	try {
		if (isHtmlDeployment) {
			downloadConfigZip(get(navAtom), get(websiteDataAtom));
			set(dirtyAtom, false);
			return { ok: true as const, exported: true as const };
		}

		const body = JSON.stringify({
			websiteData: get(websiteDataAtom),
			nav: get(navAtom),
			revision: get(configRevisionAtom),
		});
		const res = await fetch("/api/config/", {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				...(get(configRevisionAtom)
					? { "If-Match": `"${get(configRevisionAtom)}"` }
					: {}),
			},
			body,
		});
		if (!res.ok) {
			const d = (await res.json().catch(() => ({}))) as { error?: string };
			return {
				ok: false as const,
				error: d.error || `保存失败 (${res.status})`,
			};
		}
		const d = (await res.json().catch(() => ({}))) as {
			revision?: string;
			accessProtection?: NavConfig["accessProtection"];
		};
		if (d.revision) set(configRevisionAtom, d.revision);
		if (d.accessProtection) {
			set(_navBaseAtom, {
				...get(_navBaseAtom),
				accessProtection: d.accessProtection,
			});
		}
		set(dirtyAtom, false);
		return { ok: true as const, exported: false as const };
	} catch (e) {
		return { ok: false as const, error: (e as Error).message };
	} finally {
		set(savingAtom, false);
	}
});

// ─── 导入数据动作（write-only），供 BackupEditor 使用 ─────────────────────

export const applyImportAtom = atom(
	null,
	(_get, set, payload: { websiteData?: WebsiteData; nav?: NavConfig }) => {
		if (payload.websiteData) set(websiteDataAtom, payload.websiteData);
		if (payload.nav) set(navAtom, payload.nav);
		if (payload.websiteData || payload.nav) set(dirtyAtom, true);
	},
);

export const syncDataWithoutDirtyAtom = atom(
	null,
	(
		_get,
		set,
		payload: {
			websiteData?: WebsiteData;
			nav?: NavConfig;
			revision?: string;
		},
	) => {
		if (payload.websiteData) {
			set(_websiteDataBaseAtom, payload.websiteData);
			set(_savedWebsiteDataAtom, payload.websiteData);
		}
		if (payload.nav) {
			set(_navBaseAtom, payload.nav);
			set(_savedNavAtom, payload.nav);
		}
		if (payload.revision) set(configRevisionAtom, payload.revision);
	},
);
