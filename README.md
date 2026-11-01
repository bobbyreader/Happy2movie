# 🎬 Happy2movie

> 免费、纯净、无广告的多源聚合影视播放平台。基于公开高质量 MacCMS/VOD 源，支持全网秒级聚合搜索、全平台浏览器直连解码播放。

[![Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?logo=cloudflare&logoColor=white)](https://happy2movie.pages.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

---

## ✨ 核心特性

- ⚡ **多源并发聚合**：内置量子、魔都、新浪、极速、光速、虎牙、如意等高质量片源，并发探测并智能合并同名剧集。
- 🛡️ **Zero Bandwidth 免流直连**：浏览器（Artplayer + Hls.js）直接拉取源站 m3u8 切片进行硬解，服务端 0 带宽负担、无封号风险。
- 🚫 **彻底纯净无假源**：深度清洗采集接口，自动剔除所有 `/share/` 类假网页与广告跳转，100% 仅输出真实流媒体直链。
- ☁️ **Cloudflare Pages 全栈原生支持**：零配置适配 Edge Functions（V8 引擎零冷启动，每日 10 万次免费调用），支持一键绑定自定义域名。
- 🖥️ **本地极简开发**：原生 Node.js ESM 架构，零第三方 npm 生产依赖，开箱即用。
- 🕒 **观影历史与多线路切换**：本地 LocalStorage 自动记录播放历史、支持断点记忆与线路一键切换。

---

## 🚀 线上预览

- **生产域名**：[https://tv2.leobobby.dpdns.org](https://tv2.leobobby.dpdns.org)
- **边缘默认域**：[https://happy2movie.pages.dev](https://happy2movie.pages.dev)

---

## 🛠️ 项目架构

```text
Happy2movie/
├── functions/             # Cloudflare Pages Functions (Edge API)
│   └── api/
│       ├── search.js      # 全网多源并发聚合搜索接口
│       ├── recommend.js   # 首页热门推荐接口
│       └── sources.js     # 片源健康状态与元数据接口
├── public/                # 前端静态应用资产
│   ├── index.html         # 响应式暗黑风 UI
│   ├── style.css          # 现代化样式表
│   ├── app.js             # 播放器生命周期、切源与历史逻辑
│   ├── favicon.svg        # 矢量 LOGO
│   └── vendor/            # 本地打包的 Artplayer & Hls.js
├── src/                   # 核心聚合与数据清洗逻辑 (跨环境复用)
│   ├── aggregator.js      # 并发探测、排重、打分排序引擎
│   └── sources.js         # 片源配置清单
├── server.js              # 本地 Node.js 快速开发与流测试服务
├── wrangler.toml          # Cloudflare Pages 部署配置文件
└── package.json
```

---

## 💻 本地运行

### 前置要求
- Node.js 18.0 或更高版本

### 启动本地服务
```bash
# 克隆仓库
git clone https://github.com/bobbyreader/Happy2movie.git
cd Happy2movie

# 启动本地开发服务 (支持热重载)
npm run dev

# 访问本地地址
open http://localhost:3000
```

---

## ☁️ 部署到 Cloudflare Pages

本项目完全兼容 Cloudflare Pages Functions 架构：

### 命令行直接部署
```bash
# 登录 Cloudflare
npx wrangler login

# 部署构建目录至 Pages
npm run deploy
```

### Git 自动化持续集成
1. 在 Cloudflare 控制台新建 Pages 项目，关联本 GitHub 仓库。
2. 构建设置：
   - **Framework preset**: None
   - **Build command**: 留空
   - **Build output directory**: `public`
3. 之后推送到 `main` 分支即可实现自动触发部署。

---

## 📄 开源协议

本项目基于 [MIT](LICENSE) 协议开源。仅供流媒体技术与聚合架构学习研究使用，所有资源均索引自公开互联网，不存储任何版权影视文件。
