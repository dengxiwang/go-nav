import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getNav } from "@/lib/config";
import { ThemeProvider } from "@/components/theme-provider";
import { AppToastProvider } from "@/components/app-toast-provider";

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
	const nav = await getNav();
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

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const nav = await getNav();
	const themeMode = nav.themeMode ?? "light";
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
