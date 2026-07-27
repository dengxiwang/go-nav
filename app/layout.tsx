import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getNav } from "@/lib/config";
import { ThemeProvider } from "@/components/theme-provider";
import { AppToastProvider } from "@/components/app-toast-provider";

const isHtmlDeployment =
	(process.env.BUILD_MODE || "server").toLowerCase() === "html";

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
};

export function generateMetadata(): Metadata {
	if (isHtmlDeployment) {
		return {
			title: "Go Nav",
			description: "Go Nav HTML runtime configuration",
		};
	}

	const nav = getNav();
	const other: Metadata["other"] = {};
	if (nav.copyright) {
		other.copyright = nav.copyright;
	}

	return {
		title: nav.title,
		description: nav.description,
		keywords: nav.keywords,
		authors: nav.author ? [{ name: nav.author }] : undefined,
		icons: nav.favicon ? { icon: nav.favicon } : undefined,
		robots:
			nav.accessProtection?.enabled === true
				? { index: false, follow: false }
				: undefined,
		other: Object.keys(other).length > 0 ? other : undefined,
	};
}

/**
 * 生成阻塞式主题初始化脚本，在页面渲染前同步执行，避免闪白
 */
function getThemeScript(mode: string) {
	// 此脚本会被注入到 <head> 中同步执行
	return `(function(){
  var m="${mode}";
  var d=document.documentElement;
  function apply(dark){
    if(dark){d.classList.add("dark");d.style.colorScheme="dark"}
    else{d.classList.remove("dark");d.style.colorScheme="light"}
  }
  if(m==="dark"){apply(true)}
  else if(m==="light"){apply(false)}
  else{apply(window.matchMedia("(prefers-color-scheme:dark)").matches)}
})()`;
}

function getScrollRestorationScript() {
	return `(function(){
  try{
    if("scrollRestoration" in window.history){
      window.history.scrollRestoration="manual";
    }
  }catch(_e){}
})()`;
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const themeMode = isHtmlDeployment
		? "system"
		: (getNav().themeMode ?? "light");
	return (
		<html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
			<head>
				<script
					dangerouslySetInnerHTML={{ __html: getScrollRestorationScript() }}
				/>
				<script
					dangerouslySetInnerHTML={{ __html: getThemeScript(themeMode) }}
				/>
			</head>
			<body className="min-h-full flex flex-col">
				<ThemeProvider mode={themeMode}>
					{children}
					<AppToastProvider />
				</ThemeProvider>
			</body>
		</html>
	);
}
