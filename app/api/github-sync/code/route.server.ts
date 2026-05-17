import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE,import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";

async function requireAuth(): Promiseimport fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSIONimport fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!verifySessionimport fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!verifySession(token);
}

const ROOT_DIR = process.cwd();

/** GitHub 配置import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!verifySession(token);
}

const ROOT_DIR = process.cwd();

/** GitHub 配置（从环境变量读取） */
type SyncConfig = {
	repoUrl: string;
	token: string;
	branchimport fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!verifySession(token);
}

const ROOT_DIR = process.cwd();

/** GitHub 配置（从环境变量读取） */
type SyncConfig = {
	repoUrl: string;
	token: string;
	branch: string;
};

/** 从环境变量读取 GitHub 配置 */
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!verifySession(token);
}

const ROOT_DIR = process.cwd();

/** GitHub 配置（从环境变量读取） */
type SyncConfig = {
	repoUrl: string;
	token: string;
	branch: string;
};

/** 从环境变量读取 GitHub 配置 */
function getSyncConfigFromEnv(): SyncConfig | null {
	const repoUrl = process.envimport fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!verifySession(token);
}

const ROOT_DIR = process.cwd();

/** GitHub 配置（从环境变量读取） */
type SyncConfig = {
	repoUrl: string;
	token: string;
	branch: string;
};

/** 从环境变量读取 GitHub 配置 */
function getSyncConfigFromEnv(): SyncConfig | null {
	const repoUrl = process.env.GITHUB_REPO_URL;
	const token = process.env.GITHUB_TOKEN;
	const branch = process.env.GITHUB_BRANCH || "main"import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!verifySession(token);
}

const ROOT_DIR = process.cwd();

/** GitHub 配置（从环境变量读取） */
type SyncConfig = {
	repoUrl: string;
	token: string;
	branch: string;
};

/** 从环境变量读取 GitHub 配置 */
function getSyncConfigFromEnv(): SyncConfig | null {
	const repoUrl = process.env.GITHUB_REPO_URL;
	const token = process.env.GITHUB_TOKEN;
	const branch = process.env.GITHUB_BRANCH || "main";

	if (!repoUrl || !token) {
		return null;
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!verifySession(token);
}

const ROOT_DIR = process.cwd();

/** GitHub 配置（从环境变量读取） */
type SyncConfig = {
	repoUrl: string;
	token: string;
	branch: string;
};

/** 从环境变量读取 GitHub 配置 */
function getSyncConfigFromEnv(): SyncConfig | null {
	const repoUrl = process.env.GITHUB_REPO_URL;
	const token = process.env.GITHUB_TOKEN;
	const branch = process.env.GITHUB_BRANCH || "main";

	if (!repoUrl || !token) {
		return null;
	}

	return { repoUrl,