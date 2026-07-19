import type { NextConfig } from "next";

/**
 * 通过 BUILD_MODE 切换运行模式：
 *  - "static"（静态导出）：只保留前台页面，`.server.tsx` / `.server.ts` 文件被排除，
 *                          因此 /admin 后台与 /api 路由不会参与构建，执行 next build
 *                          会生成纯静态文件到 out/ 目录。
 *  - 其它（默认 "server"）：完整 Next.js 运行时，包含 /admin 后台管理与 API 路由。
 */
const BUILD_MODE = (process.env.BUILD_MODE || "server").toLowerCase();
const isStatic = BUILD_MODE === "static";
const isCloudflare = BUILD_MODE === "cloudflare" || process.env.STORAGE_DRIVER === "cloudflare";

// 仅在 server 模式下把 .server.tsx / .server.ts 纳入页面/路由扩展名集合
const pageExtensions = (isStatic || isCloudflare)
	? ["js", "jsx", "md", "mdx", "ts", "tsx"]
	: ["js", "jsx", "md", "mdx", "ts", "tsx", "server.ts", "server.tsx"];

const nextConfig: NextConfig = {
	// 静态模式开启 export，生成 out/；动态模式生成 standalone，便于 Docker 部署
	...(isStatic
		? { output: "export" as const }
		: isCloudflare
			? {} // cloudflare 模式下不设 output，由 @opennextjs/cloudflare 处理
			: { output: "standalone" as const }),
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
