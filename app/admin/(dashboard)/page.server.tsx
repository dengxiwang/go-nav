import { redirect } from "next/navigation";

/**
 * 正常请求由 next.config.ts 在渲染前跳转；这里保留路由级兜底。
 */
export default function AdminIndexPage() {
	redirect("/admin/categories/");
}
