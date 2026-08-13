---
title: "GitHub"
description: "通过 GitHub App webhooks 触达 Agent：评论调用、PR diff 上下文、sandbox checkout 与 Vercel Connect 凭证。"
---

# GitHub

GitHub channel 让 Agent 直接在仓库上工作。把它的调用 token（比如 `@my-agent`）加进新的 issue、PR 或 review comment，Agent 就在那个线程里回答，PR diff 已经在上下文里，仓库也 checkout 到了 sandbox。这个 token 是 eve 约定：GitHub 可能不会自动补全它，也不会把它渲染成链接的提及。Channel 在 `/eve/v1/github` 接收 GitHub App webhooks，校验签名，从触发事件的任何人派生 auth，并在原生表面上回复。凭证可以走 [Vercel Connect](../guides/auth-and-route-protection)，由它管理 GitHub App、installation token 和入站 webhook 校验，所以你不需要持有 app private key 或 webhook secret。构建于其上的契约见 [Channels](./overview)。

## 引导式 Connect 设置（Guided Connect setup）

从 Agent 目录运行 registry 设置：

```sh
eve add channel/github
```

流程会在需要时登录 Vercel、创建或关联 Vercel 项目、配置 app-scoped GitHub Connect client，并把 `/eve/v1/github` 注册为 trigger destination。然后安装 `@vercel/connect` 并写入带 connector UID 的 `agent/channels/github.ts`。

Vercel Connect 创建 GitHub App、接收并校验它的 webhooks，并把它们转发给已部署的 Agent。部署后，在 Connect dashboard 打开 GitHub App，并在你想使用它的组织或账户中安装。把生成的调用 token（例如 `@my-agent`）加进新的 issue、pull request 或 review comment 来开始对话。GitHub 可能不会自动补全这个 token，也不会把它渲染成链接的提及。

生成的 channel 使用 Connect 托管的凭证：

```ts title="agent/channels/github.ts"
import { connectGitHubCredentials } from "@vercel/connect/eve";
import { githubChannel } from "eve/channels/github";

export default githubChannel({
  botName: "my-agent",
  credentials: connectGitHubCredentials("github/my-agent"),
});
```

`connectGitHubCredentials` 返回 `{ installationToken, webhookVerifier }`：eve 直接使用 Connect 托管的 installation token 做 GitHub API 调用，跳过它自己的原生 App JWT 交换，并按 Vercel OIDC 签名而不是 GitHub webhook secret 校验 Connect 转发的 webhooks。Token 轮换、刷新和多安装租户留在 Connect 内部，所以没有 `GITHUB_APP_ID`、`GITHUB_APP_PRIVATE_KEY` 或 `GITHUB_WEBHOOK_SECRET` 要管理。

### 自带 GitHub App

要运行你自己管理的 GitHub App，直接传它的凭证：

```ts title="agent/channels/github.ts"
import { githubChannel } from "eve/channels/github";

export default githubChannel({
  botName: "my-agent",
  credentials: {
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  },
});
```

每个字段都回退到环境变量，所以一旦设置这些变量就可以完全去掉 `credentials` block：

```sh
GITHUB_APP_ID=... # GitHub App id
GITHUB_APP_PRIVATE_KEY=... # GitHub App private key (PEM)
GITHUB_WEBHOOK_SECRET=... # verifies the webhook signature
GITHUB_APP_SLUG=... # supplies botName when it is not set in config
```

`appId`/`privateKey`/`webhookSecret` 也接受惰性 resolver 函数，如果你更愿意按需获取。

把 GitHub App 的 webhook URL 指向 `https://<deployment>/eve/v1/github`。对评论调用的 turn，订阅 `issue_comment` 和 `pull_request_review_comment`；如果你接入了它们的 opt-in hooks，再加 `issues`、`pull_request`、`check_suite`、`check_run` 或 `workflow_run`。为仓库安装 App 后，包含 `@botName` 的新评论会启动一个 turn。这是文本调用 token，不是 GitHub 原生的提及：GitHub 可能把 App 显示为 `botName[bot]`，但可能不会自动补全或链接 `@botName`。

## 渠道如何处理消息

### Dispatch

入站 hooks 返回 `{ auth }` 以 dispatch，或返回 `null` 忽略。用 `defaultGitHubAuth(ctx)` 从 actor 派生 auth。

```ts
import { defaultGitHubAuth, githubChannel } from "eve/channels/github";

export default githubChannel({
  botName: "my-agent",
  // Replaces the default invocation-token gate. ctx.conversation.kind is "issue", "pull_request", or "review_thread".
  onComment: (ctx, comment) => ({ auth: defaultGitHubAuth(ctx) }),
  // Opt in; no default dispatch on these events.
  onIssue: (ctx, issue) => (issue.action === "opened" ? { auth: defaultGitHubAuth(ctx) } : null),
  onPullRequest: (ctx, pr) => (pr.action === "opened" ? { auth: defaultGitHubAuth(ctx) } : null),
  onCheckSuite: (ctx, suite) =>
    suite.action === "completed" &&
    suite.conclusion === "failure" &&
    suite.app.slug === "github-actions" &&
    suite.pullRequests.length > 0
      ? {
          auth: defaultGitHubAuth(ctx),
          context: [`Triage failed check suite ${suite.checkSuiteId} at ${suite.headSha}.`],
        }
      : null,
});
```

CI hooks 暴露规范化的 `action`、`status`、`conclusion`、`app.slug`、`headSha` 和 `pullRequests` 字段，以及 `checkSuiteId`、`checkRunId` 或 `workflowRunId`。`workflow_run` 是 GitHub Actions 专属事件，所以它规范化的 `app.slug` 是 `"github-actions"`。被 dispatch 的 CI turn 锚定到 `pullRequests` 里的第一个数字；数组为空时 hook 仍会运行，但它必须返回 `null`，因为 session 没有 issue 或 PR 线程可锚定。

### 投递（Delivery）

Turn 启动时，channel 会给触发评论加一个 `eyes` 反应（用 `progress: { reactions: false }` 关掉）。回复以评论形式返回，在 timeline 或 review thread 里，过长时拆分成多条评论。如果 turn 失败，你会收到一条带错误 id 的简短错误评论。

### Human-in-the-loop（HITL）

GitHub 评论没有交互式按钮或卡片能力。HITL 的 `input.requested` 事件会以评论提示的形式发布，用户的回复评论映射回挂起的输入请求。声明 `events["input.requested"]` handler 来定制提示。

### 主动 session（Proactive sessions）

通过 schedule `run` handler 里的 `to(github, target).send(message, { auth })`，或另一渠道的 `ctx.to(github, target).send(message, { auth })`，无需入站评论调用即可启动 session。Target 需要 `owner`、`repo`，以及 `issueNumber` 或 `pullRequestNumber` 中的一个。

### 附件（Attachments）

该渠道目前不支持入站文件附件。仓库内容通过下面的 sandbox checkout 触达 Agent，而不是作为消息附件。

### PR 上下文（PR context）

在 PR 上召唤 Agent，它总是能看到 diff。PR 元数据和变更文件的 patch 落在 `context` 里。大的生成文件仍出现在列表中，但它们的 patch body 会被丢弃；用 `pullRequestContext.excludedFiles` 往跳过列表里加更多路径。

### Sandbox checkout

在第一次模型调用之前，每个被触发的 turn 都会把相关 ref checkout 到 sandbox，所以 `read_file`/`glob`/`grep`/`bash` 都对着真实代码树运行。Installation token 永远不会进入 sandbox。`git` 抓取无 token 的 URL，平台在 egress 防火墙注入 auth。这需要支持防火墙的后端（Vercel）；本地后端跳过 checkout。在 session 内，checkout 跨 turn 增量进行。

### 任意 API 调用

对 channel 没有包装的任何东西，调用 `ctx.github.request({ method, path, body })`。它携带 installation-token auth。

## 接下来读什么（What to read next）

- [Channels overview](./overview)：channel 契约和所有内置渠道
- [鉴权与路由保护（Auth & route protection）](../guides/auth-and-route-protection)：入站流量认证
