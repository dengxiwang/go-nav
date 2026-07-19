import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import { getConfigRevision, readNav, readWebsiteData } from "@/lib/server/store";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminStoreProvider } from "@/lib/store/hydrate";

/**
 * 后台 dashboard 路由组 layout：
 * - 校验登录态，未登录跳转 /admin/login
 * - 读取初始配置，用 AdminStoreProvider 水合到 Jotai 原子
 */
export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const store = await cookies();
	if (!verifySession(store.get(SESSION_COOKIE)?.value)) {
		redirect("/admin/login");
	}
	const websiteData = await readWebsiteData();
	const nav = await readNav();
	const revision = await getConfigRevision();
	return (
		<AdminStoreProvider initial={{ websiteData, nav, revision }}>
			<AdminShell>{children}</AdminShell>
		</AdminStoreProvider>
	);
}
