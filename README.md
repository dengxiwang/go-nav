# Go Nav

一个配置驱动的个人 / 团队导航站，基于 Next.js 16、React 19、HeroUI v3 和 Tailwind CSS v4 构建。

Go Nav 既可以作为带登录后台的 Node.js 应用运行，也可以打包成不依赖 Node.js 的静态网站。推荐使用新的 **HTML 运行时配置模式**：开发者只需构建一次，使用者下载 `web/` 后直接修改 `nav.json`、`website.json`，不必再次安装依赖或执行构建。

<div style="display: flex; width: fit-content; gap: 12px; flex-wrap: wrap;">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js">
  <img src="https://img.shields.io/badge/HeroUI-v3-purple" alt="HeroUI">
</div>

## 交流与支持

- QQ 群：727809499
- [加入 Go Nav QQ 交流群](https://qm.qq.com/cgi-bin/qm/qr?k=6N9Y0wlXF5txRjJcBqSYByj0fDsNwjIs&authKey=ziF+0yZBKLQB8GFFDJEHTXMaz35chgIPb88v98Vwdytvym5UlNMWOBOEwMAEHlMj&noverify=0)
- [🔥 雨云服务器，高性价比，简洁易用的面板，值得您的信赖](https://www.rainyun.com/gotab_)

## 在线体验

- 官网：[https://www.gotab.cn](https://www.gotab.cn)
- 项目预览：[https://nav.gotab.cn](https://nav.gotab.cn)
- GitHub：[https://github.com/dengxiwang/go-nav](https://github.com/dengxiwang/go-nav)

## 功能特性

- JSON / YAML 配置驱动，无需数据库
- 多级分类、网址管理、站内搜索和外部搜索引擎
- 响应式布局、明暗主题、最近访问和移动端导航
- 网站信息、页脚、布局、广告、搜索引擎和自定义插件配置
- Server 模式支持登录、图片上传、投稿审核、备份还原和远端同步
- HTML 模式内置免登录可视化编辑页，支持导入和导出配置 ZIP
- 支持 Node.js、Docker、纯静态托管等多种部署方式

## 三种部署模式

| 模式                 | 构建命令            | 产物                | 服务器需要 Node.js | 配置修改后需重新构建 | `/admin/`                             |
| -------------------- | ------------------- | ------------------- | ------------------ | -------------------- | ------------------------------------- |
| **HTML** | `pnpm build:html`   | `web/`              | 否                 | 否                   | 免登录配置编辑器，导出 ZIP 后手动覆盖 |
| **Server**           | `pnpm build:server` | `.next/standalone/` | 是                 | 否                   | 完整后台，可直接保存、上传和备份      |
| **Static**           | `pnpm build:static` | `out/`              | 否                 | 是                   | 不提供                                |

简单选择：

- 想要“构建一次，下载后只改 JSON”——使用 **HTML 模式**。
- 想要登录后台在线保存、上传图片和管理备份——使用 **Server / Docker 模式**。
- 只发布固定内容，配置变化时可以重新构建——使用 **Static 模式**。

> `build:html` 和 `build:static` 都会生成纯静态文件，但两者的数据加载方式不同：HTML 模式在浏览器运行时读取 JSON；Static 模式把数据固化在构建产物中。

## HTML 运行时配置模式（推荐）

HTML 模式是面向静态分发的新打包方式。构建者需要 Node.js 和 pnpm，但生成的 `web/` 不再依赖 Node.js；拿到成品的使用者只需要一个普通静态文件服务器。

### 1. 构建可分发成品

```bash
git clone https://github.com/dengxiwang/go-nav.git
cd go-nav
pnpm install
pnpm build:html
```

构建完成后会生成：

```text
web/
├── index.html
├── admin/
├── nav.json
├── website.json
├── uploads/
├── images/
├── _next/
├── _headers
├── .nojekyll
└── 部署说明.txt
```

其中：

- `nav.json`：站点信息、主题、布局、搜索、广告、页脚和插件等配置。
- `website.json`：分类、子分类和网址数据。
- `uploads/`：本地图片资源。
- `admin/`：纯浏览器端可视化配置编辑器。
- `_headers`：为 Cloudflare Pages、Netlify 等平台声明 JSON 不缓存。
- `.nojekyll`：避免 GitHub Pages 忽略下划线开头的静态资源目录。

需要发布下载包时，可以压缩整个目录：

```bash
cd web
zip -r ../go-nav-web.zip .
```

也可以直接把 `web/` 提交到 Git，供其他人下载或部署。

### 2. 上传到静态网站

将 **`web/` 目录里面的全部文件** 上传到网站运行根目录，确保 `index.html`、`nav.json` 和 `website.json` 位于同一级。

适用平台包括：

- Nginx、Caddy、Apache
- 1Panel、宝塔等面板的 HTML 网站
- GitHub Pages
- Cloudflare Pages、Netlify
- 对象存储静态网站、CDN、NAS 静态站点服务

HTML 模式目前按照网站根路径生成资源地址。例如：

```text
https://nav.example.com/
https://nav.example.com/nav.json
https://nav.example.com/website.json
https://nav.example.com/admin/
```

不建议直接部署到 `https://example.com/go-nav/` 这类子目录；如需子路径部署，需要在构建前额外配置 Next.js `basePath`。

### 3. 修改配置

发布后有两种修改方式。

#### 直接编辑 JSON

直接修改网站根目录的：

```text
nav.json
website.json
```

保存并刷新页面即可生效，不需要运行：

```text
pnpm install
pnpm build:html
pnpm build:static
```

如果需要使用本地图片，把文件放入 `uploads/`，配置中填写：

```text
/uploads/图片文件名.png
```

#### 使用可视化编辑器

访问：

```text
https://你的域名/admin/
```

HTML 模式的后台不需要登录，因为它没有服务端 API，也不能直接改写服务器文件。编辑流程如下：

1. 打开 `/admin/`，页面会读取当前的 `nav.json` 和 `website.json`。
2. 在可视化页面中修改站点、分类、网址、主题、布局等配置。
3. 没有产生修改时，“导出配置”按钮保持禁用。
4. 修改后点击“导出配置”，浏览器会下载一个 ZIP。
5. 解压 ZIP，将其中的 `nav.json` 和 `website.json` 覆盖到网站根目录。
6. 刷新前台页面检查结果。

编辑器也支持导入之前导出的配置 ZIP，继续编辑后再次导出。

### 4. HTML 模式的能力边界

HTML 模式完全运行在浏览器内，因此：

- 可以编辑配置、导入配置和导出配置 ZIP。
- 不能直接把修改写回远程服务器。
- 不提供账号登录，因为不存在需要保护的服务端写入接口。
- 不提供图片上传、远端同步、自动抓取、在线备份还原和投稿审核队列。
- 图片需要手动上传到 `uploads/`。
- 静态投稿会根据配置生成预填邮件，不会写入服务端审核队列。

如果需要这些服务端能力，请使用 Server 或 Docker 模式。

### 5. 静态服务器缓存

页面每次读取 JSON 时会附加缓存破坏参数，构建产物也包含 `_headers`。如果使用自己的 Nginx，仍建议显式禁止缓存两个配置文件：

```nginx
server {
    listen 80;
    server_name nav.example.com;

    root /var/www/go-nav;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /nav.json {
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    }

    location = /website.json {
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    }
}
```

修改 JSON 后如果仍看到旧内容，请依次检查浏览器缓存、CDN 缓存和服务器缓存规则。

### 6. 本地预览

构建完成后，macOS 可以双击 `web/本地预览.command`，Windows
可以双击 `web/本地预览.bat`，单个 `.mjs` 可以跨平台，但通常必须执行 `node 本地预览.mjs`，不能可靠双击。启动器会自动建立本地 HTTP 服务并打开浏览器。

也可以在项目目录中执行：

```bash
pnpm preview:html
```

默认访问地址：

```text
http://127.0.0.1:4173/
http://127.0.0.1:4173/admin/
```

浏览器安全策略不允许 `file://` 页面读取旁边的 JSON，因此仍不能直接双击
`index.html`；请双击随分发包生成的本地预览启动器。

### 7. 更新分发包

项目维护者修改 `data/nav.json`、`data/website.json` 或源码后，重新执行：

```bash
pnpm build:html
```

该命令会重新生成 `web/`，并把 `data/` 中的配置转换为 `web/nav.json` 和 `web/website.json`。因此：

- 项目开发者编辑 `data/*`。
- 静态成品使用者编辑 `web/*`。
- 重新构建会覆盖 `web/`，构建前请备份只存在于 `web/` 中的手工修改。

## Server 模式

Server 模式包含完整后台、API、登录、上传和备份功能。

### 本地开发

```bash
git clone https://github.com/dengxiwang/go-nav.git
cd go-nav
pnpm install
cp .env.example .env.local
pnpm dev
```

访问：

```text
前台：http://localhost:3000/
后台：http://localhost:3000/admin/
```

默认后台账号由环境变量提供：

```dotenv
ADMIN_USER=admin
ADMIN_PASS=admin123
```

生产环境务必修改密码。

### Node.js 生产部署

```bash
pnpm install
pnpm build:server
pnpm start
```

默认数据目录为项目根目录下的 `data/`。可以通过 `DATA_DIR` 使用外部持久化目录：

```bash
DATA_DIR=/var/lib/go-nav pnpm start
```

外部目录至少需要包含：

```text
/var/lib/go-nav/
├── nav.json
├── website.json
└── uploads/
```

## Docker 部署

Docker 使用 Server 模式，适合需要完整后台但不想手动维护 Node.js 环境的用户。

### Docker Compose

```bash
cp .env.example .env
```

至少修改：

```dotenv
ADMIN_USER=admin
ADMIN_PASS=change-this-password
PORT=3000
```

启动：

```bash
pnpm docker:up
```

常用命令：

```bash
pnpm docker:logs
pnpm docker:down
```

默认使用项目目录下的 `go-nav-data/` 持久化 `/app/data`。配置、上传文件和自动生成的登录密钥都保存在该目录中。

### 直接运行镜像

```bash
mkdir -p ./go-nav-data

docker run -d \
  --name go-nav \
  --restart unless-stopped \
  -p 3000:3000 \
  -e ADMIN_USER=admin \
  -e ADMIN_PASS=change-this-password \
  -v "$(pwd)/go-nav-data:/app/data" \
  doxwant/go-nav:latest
```

容器内的数据目录固定为 `/app/data`。挂载目录为空时，镜像会初始化默认配置和素材；已有文件不会被覆盖。

需要固定登录密钥时，可以额外设置：

```text
SESSION_SECRET=change-this-to-a-long-random-string
```

## Static 模式

Static 模式只导出前台页面：

```bash
pnpm build:static
```

产物位于 `out/`，可以部署到任意静态托管平台。该模式没有 `/admin/`、登录、API 和上传功能，`data/` 中的数据会在构建时固化到页面中。

修改 `data/nav.json` 或 `data/website.json` 后必须再次执行 `pnpm build:static`。如果你的目标是部署后直接修改 JSON，请改用 `pnpm build:html`。

## 配置文件

默认数据目录：

```text
data/
├── nav.json
├── website.json
├── submissions.json
└── uploads/
```

### `nav.json`

主要配置项：

| 字段                                       | 说明                        |
| ------------------------------------------ | --------------------------- |
| `title`、`name`、`description`、`keywords` | 站点名称和 SEO 信息         |
| `logo`、`favicon`                          | Logo 和浏览器图标           |
| `author`、`copyright`                      | 作者和版权信息              |
| `icp`、`beian`                             | 备案信息                    |
| `footerLinks`                              | 页脚链接                    |
| `themeMode`                                | `light`、`dark` 或 `system` |
| `search`                                   | 站内搜索和搜索引擎配置      |
| `ads`                                      | 首页和侧边栏广告配置        |
| `submission`                               | 投稿入口和静态投稿邮箱      |
| `layout`                                   | 页面布局和显示开关          |
| `plugins`                                  | 自定义 CSS / JavaScript     |

### `website.json`

```json
{
	"categories": [
		{
			"id": "tools",
			"name": "效率工具",
			"icon": "⚙️",
			"description": "常用工具集合",
			"sites": [
				{
					"title": "Go Nav",
					"description": "导航站项目",
					"url": "https://github.com/dengxiwang/go-nav",
					"icon": "/images/logo.svg",
					"tags": ["nav", "nextjs"]
				}
			],
			"children": []
		}
	]
}
```

分类支持多级嵌套。网站图标可以使用 emoji、本地路径或远程 URL。

项目也支持 `nav.yaml` 和 `website.yaml`。设置 `DATA_FILE_FORMAT=yaml` 时优先使用 YAML；HTML 构建最终仍会输出浏览器使用的 `nav.json` 和 `website.json`。

## 环境变量

| 变量                   | 默认值               | 说明                                   |
| ---------------------- | -------------------- | -------------------------------------- |
| `BUILD_MODE`           | `server`             | `server`、`static` 或 `html`           |
| `ADMIN_USER`           | `admin`              | Server 模式后台用户名                  |
| `ADMIN_PASS`           | `admin123`           | Server 模式后台密码                    |
| `SESSION_SECRET`       | 自动生成或运行时生成 | 登录 Session 密钥                      |
| `DATA_DIR`             | `./data`             | Server 模式和构建时的数据目录          |
| `DATA_FILE_FORMAT`     | `json`               | 配置文件优先格式，可选 `json` / `yaml` |
| `NEXT_PUBLIC_SITE_URL` | -                    | 用于生成 sitemap 的网站地址            |
| `PORT`                 | `3000`               | Docker Compose 宿主机映射端口          |

HTML 和 Static 模式没有服务端登录功能，因此 `ADMIN_USER`、`ADMIN_PASS` 和 `SESSION_SECRET` 对它们无效。

## 常用命令

| 命令                | 说明                                 |
| ------------------- | ------------------------------------ |
| `pnpm dev`          | 启动 Server 模式开发环境             |
| `pnpm dev:static`   | 启动不包含后台和 API 的静态开发环境  |
| `pnpm build`        | 等同于 `pnpm build:server`           |
| `pnpm build:server` | 构建 Node.js standalone 版本         |
| `pnpm build:static` | 构建到 `out/`，配置变化后需重建      |
| `pnpm build:html`   | 构建到 `web/`，部署后可直接修改 JSON |
| `pnpm start`        | 启动 Server 模式生产服务             |
| `pnpm lint`         | 运行 ESLint                          |
| `pnpm docker:build` | 构建本地 Docker 镜像                 |
| `pnpm docker:up`    | 构建并启动 Docker Compose            |
| `pnpm docker:logs`  | 查看 Docker Compose 日志             |
| `pnpm docker:down`  | 停止 Docker Compose                  |
| `pnpm docker:push`  | 构建多架构镜像并推送到 Docker Hub    |

## 项目结构

```text
go-nav/
├── app/                 # Next.js 页面和路由
├── components/          # 前台与后台组件
├── data/                # 源配置和上传数据
├── hooks/               # 自定义 Hooks
├── lib/                 # 配置读取、状态和服务端工具
├── public/              # 公共静态资源
├── scripts/             # 构建和 Docker 脚本
├── out/                 # Static 模式产物
├── web/                 # HTML 运行时配置版产物
├── Dockerfile
└── docker-compose.yml
```

## 常见问题

### 修改 `web/nav.json` 后为什么没有生效？

确认访问的是 HTTP / HTTPS 地址，并清理浏览器或 CDN 缓存。服务器应对 `nav.json` 和 `website.json` 设置 `Cache-Control: no-cache`。

### 为什么 HTML 后台点击导出后没有直接保存到服务器？

HTML 模式是纯静态网站，浏览器没有服务器文件系统写入权限。导出 ZIP 后，需要手动覆盖网站根目录中的两个 JSON 文件。

### 为什么 HTML 后台不需要登录？

它只是本地配置编辑器，没有服务端写入、上传或管理接口。任何人在浏览器里做的修改都不会自动影响线上文件，只有拥有服务器上传权限的人才能真正发布配置。

### 可以直接打开 `web/index.html` 吗？

浏览器会限制 `file://` 页面读取 JSON，因此不能直接双击 `index.html`。HTML
分发包已附带本地预览启动器：macOS 双击 `本地预览.command`，Windows 双击
`本地预览.bat`，即可自动打开网站。

### HTML 模式可以部署到子目录吗？

默认不支持。当前资源和配置请求以网站根路径为准；部署到子目录前需要配置 `basePath` 并重新构建。

### `web/` 是否可以直接提交到 Git？

可以。也可以只在 Release 中发布 `go-nav-web.zip`。需要注意 `.nojekyll` 是隐藏文件，打包和上传时不要遗漏。

## 技术栈

- [Next.js 16](https://nextjs.org/)
- [React 19](https://react.dev/)
- [HeroUI v3](https://heroui.com/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Jotai](https://jotai.org/)
- [TypeScript](https://www.typescriptlang.org/)

## 开源协议

本项目基于 [MIT License](./LICENSE) 开源。你可以自由使用、修改和商用，但请保留原始项目署名信息。

## 捐赠支持

如果这个项目帮到了你，欢迎扫码支持。

<div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; width: fit-content; gap: 16px;">
  <img src="https://www.gotab.cn/images/wxpay.JPG" alt="微信捐赠二维码" width="180">
  <img src="https://www.gotab.cn/images/alipay.JPG" alt="支付宝捐赠二维码" width="180">
</div>
