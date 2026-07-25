#!/usr/bin/env node

/**
 * 完成 html 模式的可分发目录：
 * - 把 data/nav.* 与 data/website.* 统一转换为 web/*.json
 * - 写入常见静态托管平台可识别的缓存规则
 * - 清理构建时临时生成的 public/uploads
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "web");
const dataDir = process.env.DATA_DIR
	? path.resolve(process.env.DATA_DIR)
	: path.join(root, "data");
const publicUploadsDir = path.join(root, "public", "uploads");

if (!fs.existsSync(path.join(outputDir, "index.html"))) {
	throw new Error(`html 构建目录无效，未找到：${path.join(outputDir, "index.html")}`);
}

for (const baseName of ["nav", "website"]) {
	const source = resolveStructuredFile(baseName);
	const data = parseStructuredFile(source);
	const destination = path.join(outputDir, `${baseName}.json`);
	fs.writeFileSync(destination, `${JSON.stringify(data, null, 2)}\n`, "utf8");
	console.log(`[build:html] ✔ 已生成 ${destination}`);
}

fs.writeFileSync(path.join(outputDir, ".nojekyll"), "", "utf8");
fs.writeFileSync(
	path.join(outputDir, "_headers"),
	[
		"/nav.json",
		"  Cache-Control: no-cache, no-store, must-revalidate",
		"/website.json",
		"  Cache-Control: no-cache, no-store, must-revalidate",
		"",
	].join("\n"),
	"utf8",
);
fs.writeFileSync(
	path.join(outputDir, "部署说明.txt"),
	[
		"Go Nav HTML 运行时配置版",
		"",
		"1. 请把本目录中的全部文件上传到网站根目录。",
		"2. 后续直接修改 nav.json 或 website.json，刷新网页即可生效。",
		"3. 访问 /admin/ 使用原版可视化后台，编辑后点击“导出配置”。",
		"4. 下载 nav.json 与 website.json 后，覆盖网站根目录同名文件。",
		"5. 图片请放入 uploads/，并在 JSON 中使用 /uploads/文件名。",
		"6. 必须通过 HTTP/HTTPS 访问，不能直接双击 index.html。",
		"7. 如果平台会缓存 JSON，请为 nav.json 和 website.json 设置 no-cache。",
		"",
	].join("\n"),
	"utf8",
);

if (fs.existsSync(publicUploadsDir)) {
	fs.rmSync(publicUploadsDir, { recursive: true, force: true });
	console.log(`[build:html] 已清理 ${publicUploadsDir}`);
}

console.log(`[build:html] ✔ 可分发静态文件已生成：${outputDir}`);

function resolveStructuredFile(baseName) {
	const preferYaml = (process.env.DATA_FILE_FORMAT || "").toLowerCase() === "yaml";
	const extensions = preferYaml
		? [".yaml", ".yml", ".json"]
		: [".json", ".yaml", ".yml"];

	for (const extension of extensions) {
		const candidate = path.join(dataDir, `${baseName}${extension}`);
		if (fs.existsSync(candidate)) return candidate;
	}

	throw new Error(`缺少配置文件：${path.join(dataDir, `${baseName}.json`)}`);
}

function parseStructuredFile(file) {
	const source = fs.readFileSync(file, "utf8");
	try {
		return file.toLowerCase().endsWith(".json")
			? JSON.parse(source)
			: parseYaml(source);
	} catch (error) {
		throw new Error(`配置文件解析失败：${file}\n${error.message}`);
	}
}
