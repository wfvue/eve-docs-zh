---
title: "添加集成（Add Integrations）"
description: "从 eve 官方目录或第三方源发现并安装 extensions 和其它 integrations。"
---

# 添加集成（Add Integrations）

从 eve 官方目录、第三方源或 integration URL 安装 integrations。Integrations 使用 [shadcn registry format](https://ui.shadcn.com/docs/registry) 分发。

## 安装 integration

在 eve Agent 项目里运行 `eve add`。它会安装该 integration 的依赖，并把声明的文件写入项目。

```bash
eve add extension/agent-browser
eve add linear
eve add instrumentation/braintrust
eve add memory/file
```

找不到条目时，`eve add` 会搜索可用目录并打印相近匹配，而不会安装任何东西。

还不知道条目名时，直接运行 `eve add`。它的 help 会说明如何用 `eve registry search` 搜索 registry。

Extensions 可能在 `agent/extensions/` 下创建 mount。Connections 会把初始定义写到 `agent/connections/`，并在需要时安装 `@vercel/connect`。Instrumentation providers 会写 `agent/instrumentation.ts`；一个 Agent 只有一个 instrumentation 文件，多个 exporters 需要你自己在那里组合。运行 Agent 前，先配置生成文件和所需环境变量。

有些 integrations 打包了几个可独立安装的组件。例如 `eve add linear` 让你选择 Linear Channel、Linear MCP 或两者；默认两者都选。也可以用更具体的 `eve add channel/linear-agent` 和 `eve add connection/linear`。

当官方条目声明了交互式 setup flow 时，eve 会在安装后询问是否运行它们，并按声明顺序执行多个 flow。跳过或取消后，运行打印出来的 `eve add --skip-install` 可以稍后从开头重跑所选组件的 declared flows。

例如，`eve add memory/file` 可以通过同一 setup flow 开通所需存储。选择 **Install and set up** 后，eve 会创建或复用专用私有 Vercel Blob store，用 namespaced 凭据连接 production / preview / development，拉取环境，并可选择部署。审查与 setup 记录会展示项目、store、主 function region、环境和可能的 Blob 费用，再开始开通。

## 自动化 setup

脚本或 coding agent 无法回答终端提示时，使用 `eve add --non-interactive`。它打印 NDJSON events，并用退出码让你分支：

| 退出码 | 含义 |
| --- | --- |
| `0` | 安装和 setup 完成。 |
| `1` | 安装或 setup 失败。 |
| `2` | Setup 需要一个答案，或有未满足的前置条件。 |

退出码 `2` 时，读取最后一条 event 并运行它的 `next.command`。非密钥问题把占位符替换成你收集到的答案。**不要**把密钥放进 `--answer`；使用 integration 文档给出的环境变量或 secret store。加 `--yes` 接受推荐值；显式答案优先。

Setup 可能把 `eve link` 报成前置条件。先运行它，再重试 continuation。非交互的 `eve link` 和 `eve deploy` 见 [部署到 Vercel](./guides/deployment/vercel)。

## 查找 integration

浏览 [Integrations 目录](https://eve.dev/integrations) 查看 eve registry 中的官方 integrations。

列出每个官方 integration 和已配置的第三方源：

```bash
eve registry list
```

知道需要什么能力时搜索目录。默认最多返回 10 条；用 `--limit` 请求 1 到 100 条：

```bash
eve registry search browser --limit 5
```

安装前先查看：

```bash
eve registry view extension/agent-browser
```

`list` 包含官方 eve catalog 和项目里添加的每个源。`search` 还包含 [skills.sh](https://skills.sh)，以内置 `@skills` 源提供。

## 添加 skill

直接添加已知的 skills.sh 条目：

```bash
eve add @skills/vercel-labs/agent-skills/vercel-react-best-practices
```

skills.sh 上的 skills 是社区编写的项目文件。运行 Agent 前，请审查它们的源码和生成的 diff。

## 添加第三方源

使用 registry 发布者提供的 integration URL 模板，并给这个源一个 namespace：

```bash
eve registry add @acme=https://registry.acme.com/r/{name}.json
```

eve 把映射存在 `package.json#registries`。`{name}` 占位符会变成 integration 名，所以 `@acme/analytics` 解析为 `https://registry.acme.com/r/analytics.json`。

需要时把 list 或 search 限制到该 registry：

```bash
eve registry list --registry @acme
eve registry search analytics --registry @acme
```

从该源安装：

```bash
eve add @acme/analytics
```

不需要 namespace 时，也可以直接安装已知 integration URL：

```bash
eve add https://registry.acme.com/r/analytics.json
```

## 贡献官方 integration

欢迎向官方 registry 提交社区贡献。先开 issue 并获得 maintainer 同意，再按 [registry contribution guide](https://github.com/vercel/eve/blob/main/CONTRIBUTING.md#adding-an-integration-to-the-registry) 准备源文件、metadata、校验和 extension 要求。

## 托管自己的 registry

托管自己的 registry 是[第三方源工作流](#添加第三方源)的发布侧。部署后，其它 eve 项目可以给它一个 namespace 并拉取 integrations。

eve registry 是标准 [shadcn registry](https://ui.shadcn.com/docs/registry)，任何能通过 HTTP 提供 JSON 的服务都可以托管。它需要两类端点：

- 一份 catalog，例如 `https://registry.acme.com/r/registry.json`，供 `eve registry list` 和 `eve registry search` 使用
- 每个 integration 一份 JSON，例如 `https://registry.acme.com/r/analytics.json`，供 `eve registry view` 和 `eve add` 使用

从 integration 源文件和描述安装位置的 `registry.json` 开始。`files[].path` 相对 `registry.json`；`files[].target` 相对安装该条目的 eve 项目根。eve integrations 应使用 `registry:item` 和显式 `registry:file` targets，这样安装不依赖 UI 框架或 shadcn 项目别名。

校验源 registry，再构建静态 JSON：

```bash
pnpm dlx shadcn@latest registry validate
pnpm dlx shadcn@latest build
```

默认会把 catalog 写到 `public/r/registry.json`，每个条目写到 `public/r/<name>.json`。把 `public` 部署到静态主机，或用 shadcn registry APIs 从动态路由提供同样的 payload。

分享前，从某个 eve 项目测试已部署的 catalog 和条目端点：

```bash
eve registry list --registry https://registry.acme.com/r/registry.json
eve registry view https://registry.acme.com/r/analytics.json
```

把条目 URL 模板分享给消费者。另一个 eve 项目可以把它加成第三方源：

```bash
eve registry add @acme=https://registry.acme.com/r/{name}.json
eve add @acme/analytics
```

## 配置生成文件

Integrations 会添加项目文件。运行 Agent 前先读生成的 mount，再补上 extension 需要的配置。

对 extension 来说，这通常意味着设置环境变量并编辑 `agent/extensions/` 下的文件。mount 配置、命名空间和覆盖见 [扩展（Extensions）](./extensions)。

提供商特定 setup 在 [Integrations 目录](https://eve.dev/integrations)。凭据、审批策略和服务特定选项跟随那里的指引。

## 更新已安装的 integration

把生成文件当成项目代码。再次安装前，先提交或审查本地改动。

registry 发布者提供更新后的脚手架时，再跑同一条命令：

```bash
eve add extension/agent-browser
```

只有在你打算替换已有生成文件时才传 `--overwrite`。用包管理器更新已安装的包，并在改生成 mount 或包版本前看发布者的 release notes。

## 选择可信源

Integrations 可以添加依赖并写文件。只添加你信任的源，用 `eve registry view` 检查 integration，并在运行 Agent 前审查项目 diff。

## 接下来读什么

- [扩展（Extensions）](./extensions)：配置并覆盖已安装的 extension mounts
- [Integrations 目录](https://eve.dev/integrations)：提供商特定 setup 和安全指引
- [shadcn registry 文档](https://ui.shadcn.com/docs/registry)：发布兼容的第三方 registry

官方原文：[Add Integrations](https://eve.dev/docs/install-integrations)。
