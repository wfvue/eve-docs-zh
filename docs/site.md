---
title: "本站点说明"
description: "说明本站的 Next.js + Fumadocs 工程结构、本地预览和 GitHub Pages 部署方式。"
---

# 本站点说明

本项目现在采用更接近 Vercel Eve 官方文档工程的路线：

```txt
docs/       中文文档内容源
apps/docs/  Next.js + Fumadocs 文档站应用
```

`docs/` 只负责存放 Markdown / MDX 内容；真正的前端运行环境在 `apps/docs`。

## 本地预览

推荐使用 pnpm：

```bash
pnpm install
pnpm dev
```

根目录脚本会转发到 `apps/docs`：

```bash
pnpm --filter eve-docs dev
```

开发服务器使用 Next.js Turbopack，并在启动前运行 `fumadocs-mdx` 生成内容索引。

## 构建

```bash
pnpm build
```

等价于：

```bash
pnpm --filter eve-docs build
```

GitHub Pages 构建时会把站点静态导出到：

```txt
apps/docs/out
```

## GitHub Pages

仓库包含 GitHub Actions workflow：

```txt
.github/workflows/deploy-pages.yml
```

当 `main` 分支有 push 时，会自动安装依赖、构建 Next.js 文档站，并上传 `apps/docs/out` 到 GitHub Pages。

如果第一次使用 GitHub Pages，需要在 GitHub 仓库设置里确认：

```txt
Settings → Pages → Build and deployment → Source: GitHub Actions
```

启用后，项目站点地址通常是：

```txt
https://wfvue.github.io/eve-docs-zh/
```

## 和官方 Eve 文档工程的关系

官方 Eve 仓库也是把文档内容和文档站应用拆开的：

```txt
vercel/eve/docs       文档内容源
vercel/eve/apps/docs  Next.js + Fumadocs 文档站
```

本项目采用同一类工程路线，但使用公开的 `fumadocs-core`、`fumadocs-mdx`、`fumadocs-ui` 组合实现中文文档站。
