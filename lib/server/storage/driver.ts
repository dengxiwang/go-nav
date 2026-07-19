import type { ConfigStore, FileStore } from "./types";

export type StorageDriverName = "fs" | "cloudflare";

let _configStore: ConfigStore | null = null;
let _fileStore: FileStore | null = null;
let _driverName: StorageDriverName | null = null;

export function getStorageDriverName(): StorageDriverName {
	const raw = (process.env.STORAGE_DRIVER || "fs").toLowerCase();
	return raw === "cloudflare" ? "cloudflare" : "fs";
}

export function getConfigStore(): ConfigStore {
	if (!_configStore || _driverName !== getStorageDriverName()) {
		_driverName = getStorageDriverName();
		_configStore = createConfigStore(_driverName);
	}
	return _configStore;
}

export function getFileStore(): FileStore {
	if (!_fileStore || _driverName !== getStorageDriverName()) {
		_driverName = getStorageDriverName();
		_fileStore = createFileStore(_driverName);
	}
	return _fileStore;
}

function createConfigStore(driver: StorageDriverName): ConfigStore {
	if (driver === "cloudflare") {
		// 延迟导入，避免在非 Cloudflare 环境下加载 CF 相关代码
		const { createCfConfigStore } = require("./cf-driver") as typeof import("./cf-driver");
		return createCfConfigStore();
	}
	const { createFsConfigStore } = require("./fs-driver") as typeof import("./fs-driver");
	return createFsConfigStore();
}

function createFileStore(driver: StorageDriverName): FileStore {
	if (driver === "cloudflare") {
		const { createCfFileStore } = require("./cf-driver") as typeof import("./cf-driver");
		return createCfFileStore();
	}
	const { createFsFileStore } = require("./fs-driver") as typeof import("./fs-driver");
	return createFsFileStore();
}

/** 重置缓存的 driver 实例（测试用） */
export function resetStorageDrivers() {
	_configStore = null;
	_fileStore = null;
	_driverName = null;
}
