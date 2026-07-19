# Go Nav

一个简洁高效的个人/团队导航站，基于 Next.js 16、React 19、HeroUI v3 和 Tailwind CSS v4 构建。项目使用 JSON 配置驱动内容和布局，支持前台导航、后台管理、图片上传、备份还原和 Docker 部署。

Go Nav 同时支持两种部署形态：

- **Server 模式**：保留 `/admin` 后台、API、上传和备份能力，适合自用或团队维护，推荐使用 Docker 部署。
- **Static 模式**：导出纯静态前台页面，适合 GitHub Pages、对象存储、CDN 等无需后台的场景。

<div style="display: flex; width: fit-content; gap: 12px; flex-wrap: wrap;">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" class="medium-zoom-image">
  <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js" class="medium-zoom-image">
  <img src="https://img.shields.io/badge/HeroUI-v3-purple" alt="HeroUI" class="medium-zoom-image">
</div>

## 在线体验

- 官网：[https://www.gotab.cn](https://www.gotab.cn)
- 项目预览：[https://nav.gotab.cn](https://nav.gotab.cn)

## 推广信息

没有云服务器，或者正准备购买云服务器的朋友，可以看下我的推广：

- [🔥 雨云服务器，高性价比，简洁易用的面板，值得您的信赖](https://www.rainyun.com/gotab_)

## 交流群

欢迎加入 QQ 交流群一起反馈问题、交流部署和分享使用经验。

- QQ 群：727809499
- 加群链接：[点击加入 Go Nav QQ 交流群](https://qm.qq.com/cgi-bin/qm/qr?k=6N9Y0wlXF5txRjJcBqSYByj0fDsNwjIs&authKey=ziF+0yZBKLQB8GFFDJEHTXMaz35chgIPb88v98Vwdytvym5UlNMWOBOEwMAEHlMj&noverify=0)

## 功能特性

- **配置驱动**：通过 `data/nav.json` 和 `data/website.json` 管理站点信息、布局、搜索、广告、插件和分类数据。
- **多级导航**：分类支持递归嵌套，二级分类自动以标签页展示。
- **站内搜索**：前端本地搜索支持标题、描述、标签和分类名命中。
- **外部搜索引擎**：可配置百度、Bing、Google 等搜索 URL，使用 `{query}` 作为搜索词占位符。
- **后台管理**：server 模式下提供 `/admin`，可管理网站信息、分类、站点、广告、搜索引擎、插件、备份和上传素材。
- **投稿收录**：支持侧栏与独立悬浮入口；动态部署写入本地审核队列，静态部署生成预填投稿邮件。
- **双构建模式**：`server` 模式保留后台和 API；`static` 模式导出纯静态页面，适合 GitHub Pages、对象存储、CDN。
- **Docker 友好**：内置 Dockerfile、Compose 配置和发布脚本，镜像自带默认数据，挂载数据目录时优先使用用户数据。
- **上传与备份**：支持图片上传、完整 ZIP 备份、备份还原和无用素材清理。
- **响应式体验**：桌面侧边栏、移动端抽屉导航、最近访问、回到顶部和二维码入口。

## 环境要求

- Node.js 20+ 推荐，最低请使用当前 Next.js 16 支持的 Node 版本
- pnpm：建议使用 Corepack 读取项目 `packageManager` 指定版本；升级项目 pnpm 时更新该字段即可
- Docker / Docker Compose：仅 Docker 部署需要

## 快速开始

```bash
git clone https://github.com/dengxiwang/go-nav.git
cd go-nav
pnpm install
pnpm dev
```

开发服务默认运行在 `http://localhost:3000`。server 模式下后台入口为 `http://localhost:3000/admin`。

后台默认账号来自环境变量。开发时可以复制示例文件：

```bash
cp .env.example .env.local
```

生产环境务必修改 `ADMIN_PASS`。登录密钥 `SESSION_SECRET` 可以自己配置；Docker 不配置时会自动生成并持久化。

## 常用命令

| 命令                | 说明                                                |
| ------------------- | --------------------------------------------------- |
| `pnpm dev`          | 以 server 模式启动开发环境，包含前台、后台和 API    |
| `pnpm dev:static`   | 以 static 模式启动开发环境，排除 `/admin` 与 `/api` |
| `pnpm build`        | 默认 server 模式构建                                |
| `pnpm build:server` | 明确以 server 模式构建                              |
| `pnpm build:static` | 同步 uploads 后导出静态站点到 `out/`                |
| `pnpm start`        | 启动 server 模式 standalone 生产服务                |
| `pnpm lint`         | 运行 ESLint                                         |
| `pnpm docker:build` | 构建本地 Docker 镜像                                |
| `pnpm docker:up`    | 构建并启动本地 Docker Compose 测试环境              |
| `pnpm docker:push`  | 构建多架构镜像并推送到 Docker Hub                   |

## 运行模式

### Server 模式

server 模式是默认模式，适合需要后台管理、登录、上传、备份和 API 的部署。构建产物使用 Next.js standalone 输出，可直接用 Node.js 运行，也可以打包进 Docker 镜像。

```bash
pnpm build:server
pnpm start
```

后台登录账号来自环境变量：

```bash
ADMIN_USER=admin
ADMIN_PASS=admin123
```

生产环境务必修改 `ADMIN_PASS`。`SESSION_SECRET` 可选配置；Docker 不配置时会自动生成并保存在数据目录里。

### Docker 部署

Docker 部署使用 server 模式，镜像基于 Next.js standalone 输出，只包含生产运行所需文件。Dockerfile 不固定 pnpm 版本，构建时会通过 Corepack 跟随项目 `packageManager`。镜像内会包含构建时的默认 `data/nav.json`、`data/website.json` 和 `data/uploads/`：

- 容器首次启动时，如果 `/app/data/nav.json` 或 `/app/data/website.json` 不存在，会从镜像内的默认数据初始化。
- 容器首次启动时，如果 `/app/data/uploads/` 不存在或为空，会从镜像内的默认 `uploads/` 初始化。
- 如果用户挂载了自己的目录，并且里面已有 `nav.json` / `website.json` / 上传文件，启动脚本不会覆盖用户数据。
- 登录密钥 `SESSION_SECRET` 可以手动配置；不配置时 Docker 镜像会自动生成并保存到 `/app/data/.session-secret`。
- 常用部署只需要关心本地目录挂载、端口、用户名和密码；需要固定登录密钥时再加 `SESSION_SECRET`。
- 推荐把宿主机本地目录挂载到 `/app/data`，目录需要可读写；镜像启动时会自动修正常见的目录所有权问题。

#### 本地构建测试

1. 准备 `.env`：

```bash
cp .env.example .env
```

编辑 `.env`，至少修改：

```bash
ADMIN_USER=admin
ADMIN_PASS=change-this-password
PORT=3000
# 可选：SESSION_SECRET=change-this-to-a-long-random-string
```

2. 构建并启动：

```bash
pnpm docker:up
```

访问 `http://localhost:3000`，后台入口为 `http://localhost:3000/admin`。

3. 查看状态和日志：

```bash
docker compose ps
pnpm docker:logs
```

4. 停止服务：

```bash
pnpm docker:down
```

默认使用项目目录下的 `go-nav-data/` 持久化 `/app/data`，其中包含 JSON 配置、`uploads/` 上传素材和自动生成的 `.session-secret`。需要迁移或备份时，可以通过后台备份功能导出，或直接备份该目录。

如果要用本地目录测试用户自定义数据：

```bash
mkdir -p go-nav-data
cp data/nav.json go-nav-data/nav.json
cp data/website.json go-nav-data/website.json
pnpm docker:up
```

如果需要重置本地测试数据：

```bash
pnpm docker:down
rm -rf go-nav-data
```

#### 构建本地镜像

```bash
pnpm docker:build
```

默认构建 `go-nav:latest`。也可以指定镜像名和标签：

```bash
IMAGE_NAME=doxwant/go-nav IMAGE_TAG=1.0.0 pnpm docker:build
```

#### 推送 Docker Hub

先登录 Docker Hub：

```bash
docker login
```

默认会推送到 `doxwant/go-nav`。如果要推送到自己的镜像仓库，可以临时覆盖：

```bash
IMAGE_NAME=your-name/go-nav pnpm docker:push
```

推送只需要一个命令：

```bash
pnpm docker:push
```

默认会推送：

- `doxwant/go-nav:<package.json version>`
- `doxwant/go-nav:latest`

`IMAGE_TAG` 默认读取 `package.json` 的 `version`，也可以在环境变量里临时覆盖。默认平台是 `linux/amd64,linux/arm64`；如需调整可以设置 `PLATFORMS`，或用 `PUSH_LATEST=false` 跳过 `latest` 标签。

#### 用户拉取运行

使用镜像内置默认数据：

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

把左侧端口改掉即可换访问端口，例如 `-p 8080:3000`。如果需要固定登录密钥，在命令里额外加 `-e SESSION_SECRET=change-this-to-a-long-random-string`。数据目录为空时会初始化默认 JSON 和 `uploads/`；目录内已有 `nav.json` / `website.json` / 上传文件时会直接使用用户数据。

NAS / 面板部署时常用配置只有这几项：容器端口 `3000` 映射到宿主机端口、本地目录挂载到 `/app/data`、环境变量 `ADMIN_USER` 和 `ADMIN_PASS`。如果希望多容器迁移后登录态不失效，可以额外配置 `SESSION_SECRET`。不要把挂载目录设为只读。

如果用户想用 Docker Compose 部署远端镜像，可以创建自己的 `docker-compose.yml`：

```yaml
services:
  go-nav:
    image: doxwant/go-nav:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      ADMIN_USER: admin
      ADMIN_PASS: change-this-password
      # 可选，不填则自动生成并保存到 ./go-nav-data/.session-secret
      # SESSION_SECRET: change-this-to-a-long-random-string
    volumes:
      - ./go-nav-data:/app/data
```

然后启动：

```bash
docker compose up -d
```

### Static 模式

static 模式会排除所有 `.server.ts` / `.server.tsx` 页面和路由，仅生成前台静态页面：

```bash
pnpm build:static
```

生成结果位于 `out/`，可以部署到任意静态托管服务。静态模式没有后台、登录、API 和运行时上传能力；已有的 `data/uploads/` 会在构建前同步到 `public/uploads/`。

## 数据目录

默认数据目录是项目根目录下的 `data/`：

```text
data/
├── nav.json       # 站点设置、搜索、广告、布局、插件等
├── website.json   # 分类和网址数据
├── submissions.json # 动态部署收到的投稿审核队列（自动生成，不提交到 Git）
└── uploads/       # 后台上传的图片素材，默认不提交到 Git
```

非 Docker server 模式可以通过 `DATA_DIR` 指定外部数据目录，便于持久化：

```bash
DATA_DIR=/app/data pnpm start
```

Docker 中固定使用 `/app/data` 作为容器内数据目录。推荐把宿主机本地目录挂载到这里保存这些文件：

```text
/app/data/nav.json
/app/data/website.json
/app/data/submissions.json
/app/data/uploads/
```

## 配置说明

### `data/nav.json`

| 字段                                          | 说明                        |
| --------------------------------------------- | --------------------------- |
| `title` / `name` / `description` / `keywords` | SEO 与品牌展示信息          |
| `logo` / `favicon`                            | Logo 和浏览器图标路径       |
| `author` / `copyright`                        | 作者与版权信息              |
| `icp` / `beian`                               | 备案信息，留空则不显示      |
| `qrCode` / `qrCodeText`                       | 二维码图片与提示文案        |
| `footerLinks`                                 | 页脚链接数组                |
| `themeMode`                                   | `light`、`dark` 或 `system` |
| `search`                                      | 搜索配置                    |
| `ads` / `homeAdsEnabled` / `sidebarAdsEnabled` / `homeAdsAutoplayInterval` / `sidebarAdsAutoplayInterval` / `homeAdsAspectRatio` / `sidebarAdsAspectRatio` / `homeAdsVisibleCount` / `homeAdsGap` | 主页与侧边广告的独立开关、切换速度、比例，以及主页展示数量和卡片间距配置 |
| `submission`                                  | 投稿入口与静态投稿邮箱配置  |
| `showRecentVisits` / `recentVisitsMax`        | 最近访问配置                |
| `layout`                                      | 布局与显示开关              |
| `plugins`                                     | 自定义 CSS / JS 片段        |

### `data/website.json`

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

分类可以无限嵌套。网站图标支持 emoji、本地路径、远程 URL；后台上传素材会返回 `/uploads/xxx` 路径。

## 后台管理

server 模式访问 `/admin` 登录后台。后台可编辑：

- 网站基础信息、主题、页脚、布局
- 分类与网站条目，网址标签支持英文逗号 `,` 或中文逗号 `，` 分隔
- 投稿入口配置、动态投稿审核、编辑后收录到指定分类
- 搜索引擎与搜索行为
- 广告位、捐赠/二维码、插件
- 图片上传、备份导出、备份还原、无用素材清理

投稿功能根据构建模式自动切换：server 模式把投稿保存到 `data/submissions.json` 并在“内容管理 → 投稿收录”中审核；static 模式不会调用 API，而是使用后台配置的邮箱生成预填邮件。右下角投稿按钮拥有独立显示优先级，不受布局配置中的“悬浮操作按钮”总开关影响。

上传接口仅接受 `png`、`jpg`、`gif`、`webp`、`ico` 图片，单文件最大 2MB。备份还原最大 20MB。

## 部署建议

- **需要后台管理**：使用 server 模式部署，并持久化数据目录；推荐 Docker。
- **只需要公开导航页**：使用 static 模式构建，把 `out/` 上传到静态托管/CDN。
- **发布镜像**：镜像可以内置默认 `nav.json` / `website.json` / `uploads/`；用户挂载自己的数据目录后会优先使用挂载数据。
- **生产安全**：修改默认管理员密码；需要固定登录密钥时设置 `SESSION_SECRET`，不要提交 `.env.local`、`.env` 和 `data/uploads/`。
- **配置更新**：server 模式下后台保存会触发首页重新验证；static 模式下修改 JSON 后需要重新构建。

## 项目结构

```text
go-nav/
├── app/                    # Next.js App Router 页面和路由
│   ├── admin/              # 后台页面，仅 server 模式
│   ├── api/                # API 路由，仅 server 模式
│   └── uploads/            # 上传文件代理，仅 server 模式
├── components/             # 前台与后台 React 组件
├── data/                   # JSON 配置和上传数据
├── Dockerfile              # server 模式生产镜像
├── docker-compose.yml      # 本地测试和部署示例
├── hooks/                  # 自定义 Hooks
├── lib/                    # 配置读取、状态、服务端工具
├── public/                 # 静态资源
├── scripts/                # 构建、Docker 发布和数据同步脚本
└── types/                  # TypeScript 类型定义
```

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

如果这个项目帮到了你，欢迎扫码支持。你的鼓励会让这个小项目继续往前走。

<div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; width: fit-content; gap: 16px;">
  <img src="https://www.gotab.cn/images/wxpay.JPG" alt="微信捐赠二维码" width="180" />
  <img src="https://www.gotab.cn/images/alipay.JPG" alt="支付宝捐赠二维码" width="180" />
</div>
