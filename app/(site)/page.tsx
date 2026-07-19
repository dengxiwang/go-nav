/**
 * 首页内容由 (site)/layout 中的 SiteShell 输出。
 *
 * 保持静态渲染，后台保存配置后会通过 revalidatePath("/") 精确失效：
 * 这样既能及时更新数据，也避免每次访问都重复读文件和 SSR。
 */
export const dynamic = "force-static";

export default function HomePage() {
	return null;
}
