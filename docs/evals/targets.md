---
title: "目标（Targets）"
description: "让同一组 eval 文件指向本地 dev server 或部署环境。"
---

# 目标（Targets）

Eval target 始终是一个 HTTP URL。`eve eval` 会启动本地 dev server，而 `eve eval --url <url>` 会指向一个已有 server 或部署环境。同一组 eval 文件可以同时用于本地和远程目标，这也是 evals 可以作为 CI 端到端测试使用的原因。

Runner 会轮询 `/eve/v1/health`，验证 `/eve/v1/info`，并在 `test` 函数内把当前 live target 暴露为 `t.target`。

## Target helpers

```ts title="evals/heartbeat.eval.ts"
import { defineEval } from "eve/evals";

export default defineEval({
  async test(t) {
    const { sessionIds } = await t.target.dispatchSchedule("heartbeat");
    await t.target.attachSession(sessionIds[0]!);
    t.succeeded();
    t.calledTool("send_report");
  },
});
```

- `t.target.fetch(path, init)`：对 target 发起带鉴权的 fetch，适合测试 channel 和 webhook ingress。Runner 如何鉴权见 [Authentication](#authentication)。
- `t.target.dispatchSchedule(id)`：通过 dev-only schedule route 触发一个 [schedule](../../schedules)，并返回它创建的 session ids。它只适用于开启了 dev routes 的目标，例如本地 `eve eval` dev server，或以 development mode 运行的部署；其它情况下会抛错。
- `t.target.attachSession(sessionId, { startIndex? })`：消费一个在 eval 外部创建的 session 的 turn，例如由 channel 或 schedule 创建的 session，让它的 events 进入 run-level assertions。`startIndex` 会跳过该位置之前的 events，因此已经执行到一半的 session 可以从你离开的地方继续，而不是从头 replay。

通过这种方式 attach 的 sessions 都是完整的 `EveEvalSession`：你可以继续驱动它们，并直接在该 session 上断言，例如 `session.succeeded()`、`session.calledTool(...)`。`t` 上的聚合断言仍然会读取整个 run，包括所有 attach 进来的 session。

## Authentication

本地 target 不发送 auth：`eve eval` 自己拥有它启动的 dev server。对于远程 `--url`，当 `VERCEL_ORG_ID` 和 `VERCEL_PROJECT_ID` 都存在时，Eve 会从环境变量读取预期的 Vercel owner 和 project；否则会读取 `.vercel/project.json`。随后，Eve 会请求 Vercel 解析精确的 HTTPS origin，并且只有当 project IDs 匹配时才发送 ambient credentials。任意 URL 仍然保持匿名。

验证之后，Eve 会发送可用的 Vercel credentials：

- 解析出来的 OIDC token，同时作为 bearer 和 Vercel trusted-IDP header。
- 如果设置了 `VERCEL_AUTOMATION_BYPASS_SECRET`，也会作为 Protection Bypass for Automation header 发送。

`EVE_EVAL_AUTH_TOKEN` 是一个显式 bearer override，适合 target 的 auth 不是 Vercel OIDC 的情况。携带 credentials 的 clients 不会跟随 redirects，因此这些 headers 不会被转发到另一个 origin。

`t.target.fetch(path, init)` 会携带同一套 credentials，所以你通过它测试的 channel 和 webhook ingress，会以和 session protocol 相同的方式鉴权。

## 接下来读什么

- [Running evals](../running)：实际使用 `--url` 和其它 CLI 参数
- [Schedules](../../schedules)：`dispatchSchedule` 驱动的 surface
- [Channels](../../channels/overview)：可以通过 `target.fetch` 测试的 ingress
