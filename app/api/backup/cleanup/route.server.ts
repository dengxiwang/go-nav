import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import { readNav, readWebsiteData } from "@/lib/server/store";
import { getFileStore } from "@/lib/server/storage/driver";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	return !!await verifySession(store.get(SESSION_COOKIE)?.value);
}

/**
 * 从两个配置文件里扫出所有被引用的 /uploads/xxx 文件名。
 * 通过整体 JSON.stringify + 正则扫描，可以覆盖任意嵌套字段，
 * 包括插件 code 中的字符串引用，避免误删。
 */
async function collectUsedFiles(): Promise<Set<string>> {
	const nav = await readNav();
	const website = await readWebsiteData();
	const haystack = JSON.stringify(nav) + "\n" + JSON.stringify(website);
	// 仅匹配合法文件名字符（字母/数字/点/下划线/短横），避免把查询串、转义字符吃进去
	const re = /\/uploads\/([A-Za-z0-9._-]+)/g;
	const used = new Set<string>();
	let m: RegExpExecArray | null;
	while ((m = re.exec(haystack)) !== null) {
		used.add(m[1]);
	}
	return used;
}

async function listExistingFiles(): Promise<string[]> {
	const fileStore = getFileStore();
	const allFiles = await fileStore.list();
	return allFiles.filter((name: string) => !name.startsWith("."));
}

async function computeOrphans() {
	const used = await collectUsedFiles();
	const existing = await listExistingFiles();
	const orphans = existing.filter((name) => !used.has(name));
	return {
		orphans,
		usedCount: existing.length - orphans.length,
		totalCount: existing.length,
	};
}

/**
 * GET：预览清理结果，不做任何删除。
 * 返回孤立文件列表与统计信息，供前端确认后再决定是否执行。
 */
export async function GET() {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}
	try {
		const { orphans, usedCount, totalCount } = await computeOrphans();
		return NextResponse.json({
			orphans,
			used: usedCount,
			total: totalCount,
			orphanCount: orphans.length,
		});
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}

/**
 * POST：执行清理，删除所有未被配置引用的 uploads 文件。
 */
export async function POST() {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}
	try {
		const { orphans, totalCount } = await computeOrphans();
		const deleted: string[] = [];
		const failed: { name: string; error: string }[] = [];
		const fileStore = getFileStore();
		for (const name of orphans) {
			try {
				await fileStore.delete(name);
				deleted.push(name);
			} catch (e) {
				failed.push({ name, error: (e as Error).message });
			}
		}
		return NextResponse.json({
			ok: true,
			deleted,
			failed,
			deletedCount: deleted.length,
			totalBefore: totalCount,
		});
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
