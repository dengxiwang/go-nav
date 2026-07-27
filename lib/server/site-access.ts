import crypto from "node:crypto";
import type { NavConfig, SiteAccessProtectionConfig } from "@/types";

const PASSWORD_HASH_PREFIX = "pbkdf2-sha256";
const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_MIN_LENGTH = 4;
const PASSWORD_MAX_LENGTH = 128;

export class SiteAccessConfigError extends Error {}

export function hashSiteAccessPassword(password: string): string {
	const salt = crypto.randomBytes(16);
	const digest = crypto.pbkdf2Sync(
		password,
		salt,
		PASSWORD_ITERATIONS,
		PASSWORD_KEY_LENGTH,
		"sha256",
	);
	return [
		PASSWORD_HASH_PREFIX,
		PASSWORD_ITERATIONS,
		salt.toString("base64url"),
		digest.toString("base64url"),
	].join("$");
}

export function verifySiteAccessPassword(
	password: string,
	passwordHash: string,
): boolean {
	const [prefix, iterationsRaw, saltRaw, digestRaw] = passwordHash.split("$");
	const iterations = Number(iterationsRaw);
	if (
		prefix !== PASSWORD_HASH_PREFIX ||
		!Number.isSafeInteger(iterations) ||
		iterations !== PASSWORD_ITERATIONS ||
		!saltRaw ||
		!digestRaw
	) {
		return false;
	}

	try {
		const salt = Buffer.from(saltRaw, "base64url");
		const expected = Buffer.from(digestRaw, "base64url");
		if (salt.length !== 16 || expected.length !== PASSWORD_KEY_LENGTH) {
			return false;
		}
		const actual = crypto.pbkdf2Sync(
			password,
			salt,
			iterations,
			expected.length,
			"sha256",
		);
		return crypto.timingSafeEqual(actual, expected);
	} catch {
		return false;
	}
}

/**
 * 合并后台提交的访问配置，并确保明文密码和 UI 状态不会写入 nav 文件。
 */
export function prepareNavForWrite(
	incoming: NavConfig,
	current: NavConfig,
): NavConfig {
	const submitted = incoming.accessProtection;
	const existing = current.accessProtection;

	if (!submitted) {
		if (!existing) return incoming;
		return {
			...incoming,
			accessProtection: persistedAccessConfig(existing),
		};
	}

	const newPassword = submitted.newPassword ?? "";
	const confirmPassword = submitted.confirmPassword ?? "";
	let passwordHash = existing?.passwordHash;

	if (submitted.passwordHash) {
		if (!isSupportedPasswordHash(submitted.passwordHash)) {
			throw new SiteAccessConfigError("导入的访问密码哈希格式不受支持");
		}
		passwordHash = submitted.passwordHash;
	}

	if (newPassword || confirmPassword) {
		if (newPassword !== confirmPassword) {
			throw new SiteAccessConfigError("两次输入的访问密码不一致");
		}
		if (
			newPassword.length < PASSWORD_MIN_LENGTH ||
			newPassword.length > PASSWORD_MAX_LENGTH
		) {
			throw new SiteAccessConfigError(
				`访问密码长度需为 ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} 个字符`,
			);
		}
		passwordHash = hashSiteAccessPassword(newPassword);
	}

	if (submitted.enabled === true && !passwordHash) {
		throw new SiteAccessConfigError("开启访问保护前，请先设置访问密码");
	}

	return {
		...incoming,
		accessProtection: {
			enabled: submitted.enabled === true,
			...(passwordHash ? { passwordHash } : {}),
		},
	};
}

function persistedAccessConfig(
	config: SiteAccessProtectionConfig,
): SiteAccessProtectionConfig {
	return {
		enabled: config.enabled === true,
		...(config.passwordHash ? { passwordHash: config.passwordHash } : {}),
	};
}

function isSupportedPasswordHash(value: string): boolean {
	const [prefix, iterationsRaw, saltRaw, digestRaw] = value.split("$");
	const iterations = Number(iterationsRaw);
	if (
		prefix !== PASSWORD_HASH_PREFIX ||
		!Number.isSafeInteger(iterations) ||
		iterations !== PASSWORD_ITERATIONS ||
		!saltRaw ||
		!digestRaw
	) {
		return false;
	}
	try {
		return (
			Buffer.from(saltRaw, "base64url").length === 16 &&
			Buffer.from(digestRaw, "base64url").length === PASSWORD_KEY_LENGTH
		);
	} catch {
		return false;
	}
}
