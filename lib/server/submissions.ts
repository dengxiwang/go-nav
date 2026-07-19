import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
	SiteSubmission,
	SubmissionData,
	SubmissionInput,
} from "@/types";
import { SUBMISSIONS_FILE } from "@/lib/server/paths";
import { readJsonOr, writeJsonAtomic } from "@/lib/server/store";

const EMPTY_SUBMISSIONS: SubmissionData = { submissions: [] };
const SUBMISSIONS_LOCK_FILE = `${SUBMISSIONS_FILE}.lock`;
const LOCK_TIMEOUT_MS = 5_000;
const STALE_LOCK_MS = 30_000;
const LOCK_RETRY_MS = 25;

let localMutationQueue: Promise<void> = Promise.resolve();

function hasErrorCode(error: unknown, code: string): boolean {
	return (error as NodeJS.ErrnoException)?.code === code;
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeStaleLock(): Promise<boolean> {
	try {
		const stat = await fs.stat(SUBMISSIONS_LOCK_FILE);
		if (Date.now() - stat.mtimeMs <= STALE_LOCK_MS) return false;
		await fs.unlink(SUBMISSIONS_LOCK_FILE);
		return true;
	} catch (error) {
		if (hasErrorCode(error, "ENOENT")) return true;
		throw error;
	}
}

async function acquireSubmissionFileLock(): Promise<() => Promise<void>> {
	await fs.mkdir(path.dirname(SUBMISSIONS_LOCK_FILE), { recursive: true });
	const deadline = Date.now() + LOCK_TIMEOUT_MS;

	while (Date.now() < deadline) {
		const token = randomUUID();
		let handle: Awaited<ReturnType<typeof fs.open>>;
		try {
			handle = await fs.open(SUBMISSIONS_LOCK_FILE, "wx", 0o600);
		} catch (error) {
			if (!hasErrorCode(error, "EEXIST")) throw error;
			if (await removeStaleLock()) continue;
			await wait(LOCK_RETRY_MS);
			continue;
		}

		try {
			await handle.writeFile(token, "utf-8");
		} catch (error) {
			await handle.close().catch(() => undefined);
			await fs.unlink(SUBMISSIONS_LOCK_FILE).catch(() => undefined);
			throw error;
		}

		return async () => {
			try {
				await handle.close();
			} finally {
				try {
					const owner = await fs.readFile(SUBMISSIONS_LOCK_FILE, "utf-8");
					if (owner === token) await fs.unlink(SUBMISSIONS_LOCK_FILE);
				} catch (error) {
					if (!hasErrorCode(error, "ENOENT")) throw error;
				}
			}
		};
	}

	throw new Error("投稿队列正在被其他操作占用，请稍后重试");
}

/**
 * 投稿的“读取 -> 判断 -> 写入”必须在同一把锁内完成。
 * Promise 队列保护当前 Node 进程，锁文件保护共享同一 DATA_DIR 的多个进程。
 */
export function withSubmissionMutationLock<T>(
	task: () => T | Promise<T>,
): Promise<T> {
	const operation = localMutationQueue.then(async () => {
		const release = await acquireSubmissionFileLock();
		try {
			return await task();
		} finally {
			await release();
		}
	});
	localMutationQueue = operation.then(
		() => undefined,
		() => undefined,
	);
	return operation;
}

export function readSubmissionData(): SubmissionData {
	const data = readJsonOr<SubmissionData>(SUBMISSIONS_FILE, EMPTY_SUBMISSIONS);
	return {
		submissions: Array.isArray(data.submissions) ? data.submissions : [],
	};
}

export function writeSubmissionData(data: SubmissionData): void {
	writeJsonAtomic(SUBMISSIONS_FILE, data);
}

export function createSubmission(input: SubmissionInput): SiteSubmission {
	const now = new Date().toISOString();
	return {
		id: randomUUID(),
		status: "pending",
		title: input.title,
		url: input.url,
		icon: input.icon,
		description: input.description,
		submitterName: input.submitterName,
		contact: input.contact,
		note: input.note,
		createdAt: now,
		updatedAt: now,
	};
}

export function sortSubmissions(items: SiteSubmission[]): SiteSubmission[] {
	return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
