---
title: "定时任务（Schedules）"
description: "让 Agent 按 cron 节奏运行：一次性 prompt 或把工作交给渠道的 handler。"
---

# 定时任务（Schedules）

Schedule 让 Agent 按自己的时钟启动，而不是等待入站消息。用于日报、数据同步、清理扫描、心跳，或任何应该按节奏触发的事情。每个 schedule 是 `agent/schedules/` 下的单个文件，携带一个 cron 表达式。Schedule 只属于根 Agent，所以声明的子智能体不能有 `schedules/` 目录。

名字来自 `schedules/` 下的路径（`agent/schedules/billing/sweep.ts` → `"billing/sweep"`），嵌套目录没问题。

## `defineSchedule`

每个 schedule 都提供 `cron`，以及 `markdown` 或 `run` 之一：

```ts
interface ScheduleDefinition {
  cron: string;
  markdown?: string; // fire-and-forget prompt (task mode)
  run?: (args: ScheduleHandlerArgs) => Promise<void> | void; // handler
}

interface ScheduleHandlerArgs {
  to: ScheduleToFn; // select a channel target, then send
  waitUntil: (task: Promise<unknown>) => void; // keep the cron task alive past return
  appAuth: SessionAuthContext; // pre-built app principal
}
```

`defineSchedule` 是类型层面的透传。强制 one-of 规则的是编译器。

`cron` 是标准 5 字段字符串（`minute hour day-of-month month day-of-week`），粒度为分钟。在 Vercel 上，每个 schedule 变成一个 Vercel Cron Job，Vercel 按 UTC 求值表达式，所以 `"0 9 * * 1-5"` 在工作日 09:00 UTC 触发。`eve dev` 永远不会按 cron 节奏触发 schedule。用 `eve start` 服务的构建产物会运行生产定时任务。要在开发中触发一个，请用下面的 dispatch 路由。

## Markdown 形式（fire-and-forget）

这是最小 schedule。eve 在 prompt 上运行 Agent 并丢弃输出，但 Agent 仍可以调用工具、写入后端和沿途记录日志。我们称之为 task mode。Task-mode session 要么跑完要么失败，不能 park 去等人或 OAuth 登录。

```ts title="agent/schedules/heartbeat.ts"
import { defineSchedule } from "eve/schedules";

export default defineSchedule({
  cron: "*/5 * * * *",
  markdown: "Pull open Linear issues and POST a summary to the metrics endpoint.",
});
```

你可以把同样的东西写成纯 `.md` 文件：它的 frontmatter 只接受 `cron`，body 就是 prompt。

```md title="agent/schedules/cleanup.md"
---
cron: "0 0 * * 0"
---
Sweep stale workflow state.
```

## Handler 形式（`run`）

当 schedule 需要投递到渠道、按条件分支或在触发时计算参数时，使用 handler。Handler 完全掌控。它自己没有渠道，所以用 `to(...)` 选择渠道目标，并通过返回的 handle 发送。

```ts title="agent/schedules/critical-alerts.ts"
import { defineSchedule } from "eve/schedules";
import slack from "../channels/slack";

export default defineSchedule({
  cron: "* * * * *",
  async run({ to, waitUntil, appAuth }) {
    waitUntil(
      to(slack, { channelId: "C0123ABC" }).send(
        "Check for new critical alerts. Report only when there are any.",
        { auth: appAuth },
      ),
    );
  },
});
```

Agent 不必每次运行都投递消息。当 prompt 让投递变成条件性的（如上面的告警检查），eve 会告诉 Agent 如何在不向渠道发送任何内容的情况下成功完成。频繁轮询的 schedule 不需要单独的 filter 或 delivery 设置。

- `to(channel, target).send(message, { auth })`：在另一个渠道上启动 session。它与路由 handler 的 `ctx.to(...)` handle 契约相同。
- `waitUntil(promise)`：延长 cron task 的生命周期，让 parked session 和任何进行中的 fetch 在任务结束前 settle。把 `send` 调用包在它里面。
- `appAuth`：app principal（`{ authenticator: "app", principalId: "eve:app", principalType: "runtime" }`）。对 Agent 代表自己执行的工作，把它作为 `to(...).send(..., { auth: appAuth })` 传入。

`auth` 选项决定 session 以哪个 principal 运行。Handler 也可以在定时工作需要该用户的 grants 时传入 user principal；这次 dispatch 创建的 session 仍会保留 schedule 来源（provenance）和条件投递行为。

Handler-form session 与任何其他 session 运行在同一个 durable runtime 引擎上，所以它可以 park（durable 挂起），例如当渠道交接在等待 Slack 回复时。只有 markdown task mode 被禁止等待。

## 迭代时触发 schedule

Dev server 挂载一个一次性 dispatch 路由，按名称带外精确触发一次 schedule。由于 `eve dev` 从不在 cron 节奏上运行 schedule，这就是你在不等待下一个生产 tick 的情况下触发它的方式。

```sh
curl -X POST http://localhost:2000/eve/v1/dev/schedules/heartbeat
# -> { "scheduleId": "heartbeat", "sessionIds": ["..."] }
```

`:scheduleId` 是路径派生的 schedule 名（`agent/schedules/heartbeat.ts` → `heartbeat`；嵌套名中的 `/` 要 URL 编码）。它运行生产 cron handler 使用的确切 dispatch 路径，并把启动的 session ids 作为 JSON 返回，因此你可以在 `GET /eve/v1/session/:sessionId/stream` 订阅每个 [stream](./concepts/sessions-runs-and-streaming)。未知 id 返回 `404` 和 `availableScheduleIds`，列出应用实际定义的 schedules。

该路由仅限 dev。生产构建从不挂载它，它也不需要 auth，因为 dev server 只在本机运行。

## 在 Vercel 上（On Vercel）

托管的 Vercel 构建把每个 `defineSchedule(...)` 变成 Vercel Cron Job，每个 `cron` 写成 `.vercel/output/config.json` 里的一条。当 [`withEve`](../guides/frontend/nextjs) 把 Agent 嵌入 Next.js 部署时也是如此：Vercel 会把每个生成的 eve service 的 schedules 汇编进项目 Build Output config，同时保留已有项目 cron 条目。命名 Agent 自动使用它们的公开 `/eve/agents/<name>` 路由前缀。

在本地运行 `vercel build` 时，使用 Vercel CLI 56.4.0 或更高版本，让生成的 service cron 条目包含在项目输出中。

Vercel 按 UTC 求值 cron 表达式。在 **Settings → Cron Jobs** 下确认发现情况，在 **Observability → Cron Jobs** 下查看执行历史。每次运行的日志落在 **Observability → Logs** 下。

## 自托管主机（Self-deployed hosts）

生产构建把 schedules 注册为 Nitro scheduled tasks。在 Vercel 上，Nitro 的 Vercel preset 会把这些任务注册接到 Vercel Cron。Vercel 之外，标准的 `eve build && eve start` 路径服务 Nitro 的 Node 输出并启动 Nitro 的 schedule runner，所以只要该进程在运行，任务就会按 cron 节奏触发。

坑在自定义托管。如果你把生成的输出适配到只服务 HTTP、不启动 Nitro scheduled task runner 的进程管理器、容器平台或 Nitro preset，schedule 定义仍然能编译，但不会自动触发。这种情况下，通过 `eve start` 运行 eve，使用支持 Nitro scheduled tasks 的 host，或通过已认证路由、渠道交接或应用专属 job runner 从你自己的调度器触发同样的工作。上面的 dev dispatch 路由只服务于 `eve dev`；生产构建不会挂载它。

## 接下来读什么（What to read next）

- [Channels](./channels/overview)：把 schedule 输出投递给用户。
- [Sessions, runs & streaming](./concepts/sessions-runs-and-streaming)：检查一次 schedule run。
- [动态调度（Dynamic scheduling）](./patterns/dynamic-scheduling)：在一个 dispatcher schedule 后面，在你自己的存储中管理 schedule 行。
