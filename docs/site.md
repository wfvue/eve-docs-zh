# 本站点说明

本项目使用 VitePress 构建静态文档站，并通过 GitHub Pages 发布。

## 本地预览

```bash
npm install
npm run dev
```

默认会启动 VitePress 开发服务器。

## 构建

```bash
npm run build
```

构建产物位于：

```txt
docs/.vitepress/dist
```

## GitHub Pages

仓库已经包含 GitHub Actions workflow：

```txt
.github/workflows/deploy-pages.yml
```

当 `main` 分支有 push 时，会自动构建 VitePress 并部署到 GitHub Pages。

如果第一次使用 GitHub Pages，需要在 GitHub 仓库设置里确认：

```txt
Settings → Pages → Build and deployment → Source: GitHub Actions
```

启用后，项目站点地址通常是：

```txt
https://wfvue.github.io/eve-docs-zh/
```

## 注意

如果页面出现 404，请检查：

1. GitHub Pages 是否选择了 GitHub Actions；
2. Actions 是否执行成功；
3. VitePress `base` 是否是 `/eve-docs-zh/`；
4. 浏览器访问地址是否带仓库名路径。
