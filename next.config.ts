import type { NextConfig } from "next";

/**
 * 通过 BUILD_MODE 切换运行模式：
 *  - "static"（静态导出）：只保留前台页面，`.server.tsx` / `.server.ts` 文件被排除，
 *                          因此 /admin 后台与 /api 路由不会参与构建，执行 next build
 *                          会生成纯静态文件到 out/ 目录。
 *  - "html"（运行时 JSON）：同样只保留前台并静态导出，但浏览器运行时读取
 *                           web/nav.json 与 web/website.json，修改配置无需重新构建。
 *  - 其它（默认 "server"）：完整 Next.js 运行时，包含 /admin 后台管理与 API 路由。
 */
const BUILD_MODE = (process.env.BUILD_MODE || "server").toLowerCase();
const isStatic = BUILD_MODE === "static";
const isHtml = BUILD_MODE === "html";
const isExport = isStatic || isHtml;

const basePageExtensions = ["js", "jsx", "md", "mdx", "ts", "tsx"];
// server 专用页面只在动态模式纳入；html 专用配置后台只进入可分发版本。
const pageExtensions = isHtml
	? [...basePageExtensions, "html.tsx"]
	: isStatic
		? basePageExtensions
		: [...basePageExtensions, "server.ts", "server.tsx"];

const nextConfig: NextConfig = {
	// export 模式生成纯静态文件；html 模式直接输出到可分发的 web/。
	...(isExport
		? {
				output: "export" as const,
				...(isHtml ? { distDir: "web" } : {}),
			}
		: { output: "standalone" as const }),
	env: {
		NEXT_PUBLIC_DEPLOYMENT_MODE: isHtml
			? "html"
			: isStatic
				? "static"
				: "server",
	},
	trailingSlash: true,
	reactCompiler: true,
	productionBrowserSourceMaps: false,
	outputFileTracingExcludes: {
		"/*": [".next/server/app/**/route_client-reference-manifest.js"],
	},
	reactStrictMode: false,
	compiler: {
		removeConsole: {
			exclude: ["error", "warn"],
		},
	},
	experimental: {
		optimizePackageImports: ["@heroui/react"],
	},
	// 允许在开发模式下通过局域网 IP 访问（Server Action 跨域限制）
	allowedDevOrigins: ["192.168.*.*"],
	pageExtensions,
	images: {
		// 纯静态服务器没有 /_next/image 运行时接口，导出模式直接使用原图地址。
		unoptimized: isExport,
		remotePatterns: [
			{
				protocol: "https",
				hostname: "www.gotab.cn",
			},
		],
	},
	turbopack: {
		rules: {
			"*.svg": {
				loaders: ["@svgr/webpack"],
				as: "*.js",
			},
		},
	},
	webpack: (config) => {
		if (!config.resolve.alias) config.resolve.alias = {};
		return config;
	},
};

export default nextConfig;
