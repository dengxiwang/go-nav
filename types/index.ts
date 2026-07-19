/**
 * 主题模式
 * - "light": 始终亮色
 * - "dark": 始终暗色
 * - "system": 跟随系统
 */
export type ThemeMode = "light" | "dark" | "system";

/**
 * 网站卡片展示样式
 * - "compact": 当前常规紧凑样式
 * - "preview": 带预览图的大卡片样式
 */
export type CardStyle = "compact" | "preview";

/**
 * 上传图片处理策略
 */
export interface ImageUploadConfig {
	/**
	 * 是否压缩可安全重编码的图片
	 * - 默认关闭：保留上传文件的原始内容
	 * - 开启后：图标、预览图与远程抓取图片会按场景缩放并优化体积
	 */
	compress?: boolean;
	/**
	 * 是否尽量统一转换成 WebP
	 * - 开启后：手动上传、远程抓取 favicon 等场景会优先转为 webp
	 * - 适用于 png / jpg / webp / svg
	 */
	convertToWebp?: boolean;
}

/**
 * 布局与显示配置
 */
export interface LayoutConfig {
	/** 内容区最大宽度，如 "1200px"、"1400px"、"100%"（不限制） */
	maxWidth?: string;
	/** 内容区右侧内边距，如 "16px"、"24px" */
	contentPaddingRight?: string;
	/** 内容区左侧内边距（有侧边栏时通常比右侧小），如 "8px"、"16px" */
	contentPaddingLeft?: string;
	/** 分类之间的间距，如 "16px"、"24px" */
	sectionGap?: string;
	/** 是否显示左侧侧边栏（桌面端） */
	showSidebar?: boolean;
	/** 侧边栏宽度，如 "224px"、"200px" */
	sidebarWidth?: string;
	/** 是否显示浮动操作按钮（回到顶部等） */
	showFloatingActions?: boolean;
	/** 是否在浮动按钮显示二维码入口 */
	showFloatingQrCode?: boolean;
	/** 是否在页脚显示二维码 */
	showFooterQrCode?: boolean;
	/** 是否显示页脚 */
	showFooter?: boolean;
	/** 是否显示搜索栏 */
	showSearch?: boolean;
	/** 是否显示分类标题（分类名称） */
	showCategoryTitle?: boolean;
	/** 是否显示分类描述（分类名称下方的描述文字） */
	showCategoryDescription?: boolean;
	/** 网站卡片最小宽度，如 "160px"、"200px" */
	cardMinWidth?: string;
	/** 网站卡片高度，如 "64px"、"72px" */
	cardHeight?: string;
	/** 网站卡片展示样式："compact" 常规样式，"preview" 预览图样式 */
	cardStyle?: CardStyle;
	/** 卡片网格左右内边距，如 "8px"、"12px" */
	cardGridPadding?: string;
	/** 网站卡片图标圆角，如 "full"、"12px"、"8px" */
	iconBorderRadius?: string;
	/** 网站图标默认内边距，如 "8px"、"6px" */
	defaultIconPadding?: string;
	/** 链接打开方式："current" 当前页打开，"new" 新标签页打开 */
	linkTarget?: "current" | "new";
	/** 是否自动优先访问内网地址（可达时优先） */
	autoUseIntranet?: boolean;
	/** 点击网站卡片时是否先进入"网址详情页" */
	enableSiteDetailPage?: boolean;
	/** 是否在右侧使用 Tabs 展示二级分类（开启时：左侧仅展示父级分类，右侧用 Tabs 切换二级分类；关闭时：左侧树形展示父子分类，右侧平铺所有分类卡片） */
	showSubcategoryTabs?: boolean;
	/** 是否显示分类导航栏搜索框（开启后在左侧导航顶部显示搜索框，输入后过滤分类） */
	showCategorySearch?: boolean;
}

/**
 * 网站数据 - website.json 的类型定义
 * 只包含分类和网址数据
 */
export interface WebsiteData {
	/** 所有分类 (支持多级嵌套) */
	categories: NavCategory[];
}

/**
 * 广告配置
 */
export interface AdConfig {
	/** 广告唯一 ID */
	id: string;
	/** 广告标题 */
	title: string;
	/** 广告描述 */
	description?: string;
	/** 广告图片 URL */
	image?: string;
	/** 跳转链接 */
	url: string;
	/** 是否启用 */
	enabled: boolean;
	/** 广告所属位置；旧数据未配置时按旧版全局位置兼容，最终回退到侧边栏 */
	placement?: AdDisplayPosition;
	/** 排序权重（数字越小越靠前） */
	sort?: number;
}

/** 广告区域展示位置 */
export type AdDisplayPosition = "sidebar" | "home-top";

/**
 * 投稿收录配置。
 *
 * 部署模式不写入配置：server 构建自动使用本地审核流，static 构建自动使用邮件流。
 */
export interface SubmissionConfig {
	/** 是否启用投稿收录功能 */
	enabled?: boolean;
	/** 是否在右下角展示独立悬浮入口 */
	showFloatingButton?: boolean;
	/** 是否在左侧分类列表底部展示入口 */
	showSidebarButton?: boolean;
	/** 静态部署接收投稿邮件的邮箱 */
	staticEmail?: string;
}

/** 投稿审核状态 */
export type SubmissionStatus = "pending" | "approved" | "rejected";

/** 前台投稿表单数据 */
export interface SubmissionInput {
	title: string;
	url: string;
	/** 网站图标 URL、站内上传路径或 emoji */
	icon?: string;
	description?: string;
	submitterName?: string;
	contact?: string;
	note?: string;
	/** 机器人诱捕字段，正常用户应始终留空 */
	company?: string;
}

/** 动态部署中保存到本地、供后台审核的投稿记录 */
export interface SiteSubmission extends Omit<SubmissionInput, "company"> {
	id: string;
	status: SubmissionStatus;
	createdAt: string;
	updatedAt: string;
	reviewedAt?: string;
	reviewNote?: string;
	targetCategoryId?: string;
	targetCategoryName?: string;
	publishedSite?: NavSite;
}

/** data/submissions.json 的数据结构 */
export interface SubmissionData {
	submissions: SiteSubmission[];
}

/**
 * 单个网站条目
 */
export interface NavSite {
	/** 唯一 ID (可选)，如不提供将以 title+url 生成 */
	id?: string;
	/** 网站名称 */
	title: string;
	/** 网站简介，用于卡片描述与本地搜索 */
	description: string;
	/** 网站跳转 URL */
	url: string;
	/** 网站内网地址（可选） */
	intranetUrl?: string;
	/** 网站图标 URL (可为本地/远程，支持 emoji 开头) */
	icon?: string;
	/** 网站预览图 URL（用于预览图卡片样式） */
	previewImage?: string;
	/** 图标背景颜色 (hex 格式，如 #FF5733) */
	bgColor?: string;
	/** 图标区域内边距，如 "2px"、"4px" */
	iconPadding?: string;
	/** 搜索标签，辅助本地搜索命中 */
	tags?: string[];
}

/**
 * 分类节点，可递归嵌套实现多级分类
 */
export interface NavCategory {
	/** 分类唯一 ID，用于锚点与菜单 key */
	id: string;
	/** 分类名称 */
	name: string;
	/** 分类图标 (可为 emoji 或 URL) */
	icon?: string;
	/** 分类描述 (可选，展示在分类标题下方) */
	description?: string;
	/** 该分类下的网站列表 */
	sites?: NavSite[];
	/** 子分类 (支持无限级嵌套) */
	children?: NavCategory[];
}

/**
 * 自定义插件（用于注入样式 / 脚本 / 资源提示）
 * - type="css"           : code 以 <style> 注入 <head>
 * - type="js"            : code 以内联 <script> 注入 <body> 末尾
 * - type="resource-hint" : 生成 <link rel="preconnect|dns-prefetch" href="...">
 * - type="external-script": 生成底部外链 <script src="...">，可附带初始化 code
 */
export interface PluginConfig {
	/** 插件唯一 ID */
	id: string;
	/** 插件显示名称 */
	name: string;
	/** 插件类型 */
	type: "css" | "js" | "resource-hint" | "external-script";
	/** 代码内容（CSS / JS / 外链脚本附带的初始化代码） */
	code: string;
	/** 是否启用（仅启用的插件才会注入到前台页面） */
	enabled: boolean;
	/** 备注说明（可选，方便后台识别） */
	description?: string;
	/** 排序权重（数字越小越靠前） */
	sort?: number;
	/** 头部资源提示 rel（仅 type="resource-hint" 有意义） */
	resourceHintRel?: "preconnect" | "dns-prefetch";
	/** 资源提示地址（仅 type="resource-hint" 有意义） */
	href?: string;
	/** 外链脚本地址（仅 type="external-script" 有意义） */
	src?: string;
	/** 跨域属性（resource hint / external script 可选） */
	crossOrigin?: "" | "anonymous" | "use-credentials";
	/**
	 * 脚本加载模式（仅 type="js" / type="external-script" 有意义）
	 * - "sync"（默认）：同步执行，位于 body 末尾
	 * - "defer"：使用 defer 属性，DOM 解析完成后执行
	 * - "async"：异步执行（可能在解析过程中执行）
	 */
	loading?: "sync" | "defer" | "async";
}

/**
 * 搜索引擎配置
 */
export interface SearchEngine {
	/** 唯一 ID (用于切换) */
	id: string;
	/** 显示名称 */
	name: string;
	/** 搜索 URL，使用 {query} 占位符，程序会替换为搜索词 */
	url: string;
	/** 可选图标 URL / emoji */
	icon?: string;
}

/**
 * 导航数据配置 - nav.json 的类型定义
 * 包含：网站基础信息、搜索、广告、最近访问、布局、主题、页脚等所有后台配置
 */
export interface NavConfig {
	/** 网站标题 (显示于浏览器标签与 SEO title) */
	title: string;
	/** 网站名称 (用于页面左上角品牌展示) */
	name: string;
	/** 简短描述 (SEO description & 页面副标题) */
	description: string;
	/** 关键词列表 (SEO keywords) */
	keywords: string[];
	/** Logo 图片 URL（放在 public/ 下或远程图片均可） */
	logo: string;
	/** favicon 路径（相对于 public/） */
	favicon: string;
	/** 作者 / 所属机构 */
	author: string;
	/** 版权信息 (例如 © 2026 xxx) */
	copyright: string;
	/** 工信部 ICP 备案号（如：京ICP备xxxxxxxx号-1），留空则不显示 */
	icp: string;
	/** 公安网备案号，留空则不显示 */
	beian: string;
	/** 公众号二维码图片路径（放在 public/ 下） */
	qrCode: string;
	/** 二维码下方提示文字 */
	qrCodeText: string;
	/** 页脚友情链接 / 自定义链接 */
	footerLinks: Array<{
		/** 链接显示文案 */
		label: string;
		/** 链接跳转地址 */
		href: string;
	}>;
	/** 布局与显示控制 */
	layout?: LayoutConfig;
	/** 主题模式: "light" | "dark" | "system"（跟随系统），默认 "light" */
	themeMode?: ThemeMode;
	/** 搜索相关配置 */
	search: {
		/** 默认选中的搜索引擎 ID (`local` 表示本地搜索) */
		defaultEngine: string;
		/** 是否启用本地搜索（在网站列表中过滤） */
		enableLocalSearch: boolean;
		/** 搜索框占位文字 */
		placeholder: string;
		/** 外部搜索引擎列表（id 为 `local` 表示本地搜索保留项，通常不必添加） */
		engines: SearchEngine[];
		/** 是否显示搜索引擎切换器（设为 false 则只用默认引擎） */
		showEngineSelector?: boolean;
		/** 是否启用搜索联想词（非本地搜索时显示百度搜索联想词） */
		enableSuggestion?: boolean;
		/** 是否启用全局 Tab 键快捷聚焦到搜索框（默认 true）
		 *  开启后：页面任意位置（包括侧边栏/卡片等）按 Tab 都会跳入搜索框；
		 *  主要供键盘用户快速进入搜索。关闭后使用浏览器原生 Tab 顺序。 */
		enableTabFocus?: boolean;
	};
	/** 广告列表 */
	ads: AdConfig[];
	/** 投稿收录入口、静态邮件等配置 */
	submission?: SubmissionConfig;
	/** @deprecated 旧版全局广告宽高比，仅用于兼容已有配置 */
	adsAspectRatio?: string;
	/** @deprecated 旧版全局广告位置，仅用于迁移未标记 placement 的广告 */
	adsDisplayPosition?: AdDisplayPosition;
	/** @deprecated 旧版全局同时展示数量，仅用于兼容已有配置 */
	adsVisibleCount?: number;
	/** 主页顶部单张广告图片比例，默认 16/9 */
	homeAdsAspectRatio?: string;
	/** 侧边栏单张广告图片比例，默认 4/3 */
	sidebarAdsAspectRatio?: string;
	/** 是否开启主页顶部广告，默认 true */
	homeAdsEnabled?: boolean;
	/** 是否开启侧边栏广告，默认 true */
	sidebarAdsEnabled?: boolean;
	/** @deprecated 旧版全局广告切换间隔，仅用于兼容已有配置 */
	adsAutoplayInterval?: number;
	/** 主页顶部广告自动切换间隔（毫秒），默认 5000 */
	homeAdsAutoplayInterval?: number;
	/** 侧边栏广告自动切换间隔（毫秒），默认 5000 */
	sidebarAdsAutoplayInterval?: number;
	/** 主页顶部 Swiper 同时展示的最大数量，正整数，默认 3 */
	homeAdsVisibleCount?: number;
	/** 主页顶部广告卡片间距（px），范围 0-48，默认 6 */
	homeAdsGap?: number;
	/** @deprecated 侧边栏固定单卡展示，仅保留旧配置兼容 */
	sidebarAdsVisibleCount?: number;
	/** @deprecated 旧版全局广告开关，仅用于兼容已有配置 */
	showAds?: boolean;
	/** 是否显示最近访问 */
	showRecentVisits?: boolean;
	/** 最近访问最大显示条数 */
	recentVisitsMax?: number;
	/** 图片上传处理策略 */
	imageUpload?: ImageUploadConfig;
	/** 自定义代码插件列表（自定义 CSS / JS 注入） */
	plugins?: PluginConfig[];
}
