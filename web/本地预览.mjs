#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const host = "127.0.0.1";
const preferredPort = normalizePort(process.env.PORT) ?? 4173;
const root = path.resolve(process.argv[2] || process.cwd());
const shouldOpenBrowser = !process.argv.includes("--no-open");

if (!fs.existsSync(path.join(root, "index.html"))) {
	console.error(`本地预览目录无效，未找到：${path.join(root, "index.html")}`);
	process.exit(1);
}

const server = http.createServer(async (request, response) => {
	if (request.method !== "GET" && request.method !== "HEAD") {
		response.writeHead(405, { Allow: "GET, HEAD" });
		response.end("Method Not Allowed");
		return;
	}

	try {
		const requestUrl = new URL(request.url || "/", `http://${host}`);
		const pathname = decodeURIComponent(requestUrl.pathname);
		const resolved = resolveRequestFile(pathname);

		if (!resolved) {
			sendFallback(response, request.method);
			return;
		}

		sendFile(response, request.method, resolved);
	} catch {
		response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
		response.end("Bad Request");
	}
});

server.on("error", (error) => {
	if (error.code === "EADDRINUSE" && server.portAttempt !== 0) {
		console.warn(`端口 ${preferredPort} 已被占用，正在改用可用端口…`);
		server.portAttempt = 0;
		server.listen(0, host);
		return;
	}

	console.error("本地预览启动失败：", error.message);
	process.exitCode = 1;
});

server.on("listening", () => {
	const address = server.address();
	if (!address || typeof address === "string") return;

	const url = `http://${host}:${address.port}/`;
	console.log("");
	console.log(`Go Nav 本地预览已启动：${url}`);
	console.log("关闭此窗口或按 Control+C 即可停止。");
	console.log("");

	if (shouldOpenBrowser) openBrowser(url);
});

server.portAttempt = preferredPort;
server.listen(preferredPort, host);

function resolveRequestFile(pathname) {
	const relativePath = pathname.replace(/^\/+/, "");
	const candidate = path.resolve(root, relativePath);
	if (!isInsideRoot(candidate)) return null;

	const directFile = resolveExistingFile(candidate);
	if (directFile) return directFile;

	if (pathname.startsWith("/site/")) {
		const sitePlaceholder = path.join(
			root,
			"site",
			"__placeholder__",
			"index.html",
		);
		if (fs.existsSync(sitePlaceholder)) return sitePlaceholder;
	}

	return null;
}

function resolveExistingFile(candidate) {
	if (!fs.existsSync(candidate)) return null;

	const stat = fs.statSync(candidate);
	if (stat.isFile()) return candidate;
	if (!stat.isDirectory()) return null;

	const indexFile = path.join(candidate, "index.html");
	return fs.existsSync(indexFile) ? indexFile : null;
}

function isInsideRoot(candidate) {
	return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function sendFallback(response, method) {
	const fallback = path.join(root, "404.html");
	if (fs.existsSync(fallback)) {
		sendFile(response, method, fallback, 404);
		return;
	}

	response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
	response.end(method === "HEAD" ? undefined : "Not Found");
}

function sendFile(response, method, file, status = 200) {
	const extension = path.extname(file).toLowerCase();
	const headers = {
		"Content-Type": contentType(extension),
		"Cache-Control":
			extension === ".json" || extension === ".html"
				? "no-cache, no-store, must-revalidate"
				: "public, max-age=3600",
	};
	const stat = fs.statSync(file);
	headers["Content-Length"] = String(stat.size);
	response.writeHead(status, headers);

	if (method === "HEAD") {
		response.end();
		return;
	}

	fs.createReadStream(file).pipe(response);
}

function contentType(extension) {
	const types = {
		".avif": "image/avif",
		".css": "text/css; charset=utf-8",
		".gif": "image/gif",
		".html": "text/html; charset=utf-8",
		".ico": "image/x-icon",
		".jpeg": "image/jpeg",
		".jpg": "image/jpeg",
		".js": "text/javascript; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".mjs": "text/javascript; charset=utf-8",
		".png": "image/png",
		".svg": "image/svg+xml",
		".txt": "text/plain; charset=utf-8",
		".webp": "image/webp",
		".woff": "font/woff",
		".woff2": "font/woff2",
	};
	return types[extension] || "application/octet-stream";
}

function normalizePort(value) {
	if (!value) return null;
	const port = Number(value);
	return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

function openBrowser(url) {
	let command;
	let args;

	if (process.platform === "darwin") {
		command = "open";
		args = [url];
	} else if (process.platform === "win32") {
		command = "cmd";
		args = ["/c", "start", "", url];
	} else {
		command = "xdg-open";
		args = [url];
	}

	const child = spawn(command, args, {
		detached: true,
		stdio: "ignore",
	});
	child.on("error", () => {
		console.warn(`浏览器未能自动打开，请手动访问：${url}`);
	});
	child.unref();
}
