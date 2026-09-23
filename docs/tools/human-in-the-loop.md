---
title: "Human-in-the-loop（人在环中）"
description: "让运行过程暂停等待人工参与：审批工具调用，或让 Agent 中途提问，并在回答后持久恢复。"
---

# Human-in-the-loop：人在环中

Human-in-the-loop，简称 HITL，指 Agent 在运行中持久暂停并等待人的输入。两类触发共用同一套 pause-and-resume 协议：

- **Approvals**：工具策略可以自动允许、拒绝，或暂停等人审。Agent 决定调用工具；**策略**决定是否自动跑还是需要人拍板。
- **Questions**：Agent 自己在 turn 中途提出澄清问题或选择题，并 park 直到回答。

无论哪一种，run 都会进入 `session.waiting`，可以等待几秒，也可以等待几天。回答到达后，eve 从暂停点继续。Channels 会替你渲染请求。

官方原文：[Human-in-the-Loop](https://eve.dev/docs/human-in-the-loop)。官方 URL 是 `/docs/human-in-the-loop`；中文站按现有 tools 目录放在本页。

## Approvals

审批是 [tool](./overview) 的一个属性：在执行前做门禁。策略可以自动决定，也可以暂停等人。用 `approval` 和 `eve/tools/approval` 的 helpers：

```ts title="agent/tools/refund_charge.ts"
import { defineTool } from "eve/tools";
import { auto } from "eve/tools/approval";
import { z } from "zod";

export default defineTool({
  description: "Refund a charge.",
  inputSchema: z.object({ tenantId: z.string(), chargeId: z.string(), amount: z.number() }),
  approval: auto(), // or always() / once() / never() / a policy
  async execute(input) {
    return refund(input);
  },
});
```

| Helper | 行为 |
| --- | --- |
| `never()` | 不要求审批（省略时的默认）。 |
| `once()` | 每个 session 第一次运行该工具时审批，之后自动允许。 |
| `always()` | 每次调用前都审批。 |
| `auto()` | 让评估模型判断：这次调用能否自动跑，还是必须等人审批。 |

默认省略 `approval` 的行为和 `never()` 一样，所以 tool calls 可能不经人工审批就执行。对敏感、不可逆、受监管、金融、医疗、雇佣、住房、法律、安全相关、影响用户或会产生外部副作用的动作，要求人工审批或其他防护。见 [负责任使用](../responsible-use)。

`auto()` 用 [AI SDK evaluation model](../guides/evaluate) 把每次调用分成 `clear` 或 `caution`，默认 `typesafe-ai/jev`（TypeSafe AI 的 [Jev evaluation model](https://vercel.com/i/what-is-jev)）。和 `evaluate` 一样，模型字符串走 Vercel AI Gateway（除非应用配置了全局 AI SDK 默认 provider）：

```ts
approval: auto({ model: "typesafe-ai/jev" });
```

评估模型会看工具名和输入是否有危险效果。caution、评审失败或输入不完整时，需要用户审批。**工具输入会发给评估模型的 provider**——勿把秘密塞进会被评审的字段。

可按应用策略覆盖分类文案：

```ts
approval: auto({
  model: "typesafe-ai/jev",
  instructions: "Review whether this refund needs finance approval.",
  criteria: {
    clear: "The refund can proceed automatically.",
    caution: "A person must review the refund.",
  },
});
```

决策取决于输入时，传入自己的 policy 而不是 helper。它收到与 tool execution 相同的 session context，外加 `{ toolName, toolInput, approvedTools, callId, abortSignal }`，同步或作为 promise 返回 AI SDK 7 approval status。异步 policy 请传 `abortSignal`，以便 turn 取消时一并停下。用 `ctx.session.auth.current` 按当前 turn 的调用者守卫，用 `ctx.session.auth.initiator` 按创建 session 的调用者守卫。返回 `"user-approval"` 暂停等人，返回 `"not-applicable"` 继续且不提示。`toolInput` 可能是 undefined，访问前要守卫。下面这个 policy 拒绝跨租户调用，只在金额超过阈值时要求审批：

```ts
approval: ({ session, toolInput }) => {
  const callerTenant = session.auth.current?.attributes.tenantId;
  if (callerTenant === undefined || callerTenant !== toolInput?.tenantId) {
    return { type: "denied", reason: "Caller cannot access this tenant." };
  }
  return (toolInput?.amount ?? 0) > 1000 ? "user-approval" : "not-applicable";
},
```

为兼容之前的 predicate 形状，policies 也可以返回布尔值：`true` 当作 `"user-approval"`，`false` 当作 `"not-applicable"`。布尔 promises 也支持。

Policies 还可以返回 `"approved"` 或 `"denied"` 来自动决定。需要模型收到原因时用 `{ type: "approved" | "denied", reason }`。`Approval`、`ApprovalContext` 和 `ApprovalStatus` 从 `eve/tools/approval` 导出。

把副作用门在审批后面，也是让非幂等工在 replay 时安全的方法：坐在 `always()` 后面的扣款或邮件，不会因为 step 重跑而在没有新的人工决定时开火。

### 授权审批响应

你还可以定义 approval response policy，决定点 **Approve** 的已认证人是否可以批准这一次具体调用：

```ts title="agent/tools/refund_charge.ts"
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

export default defineTool({
  description: "Refund a charge.",
  inputSchema: z.object({ chargeId: z.string() }),
  approval: {
    request: always(),
    response: ({ responder, request, response, session, auth }) => {
      const approvers = ["slack:T012AB3CD:U045EF6GH", "slack:T012AB3CD:U078JK9LM"];
      const canApprove = approvers.includes(responder.principalId);

      return canApprove
        ? { status: "allowed" }
        : { status: "rejected", reason: "This user cannot approve refunds." };
    },
  },
  async execute(input) {
    return refund(input);
  },
});
```

`response` policy 收到：

- `responder`：提交响应的已认证 principal，包括 `principalId`、`principalType`、`authenticator` 和 `attributes`。身份由你的路由或 channel 提供。
- `request`：这次被批准调用的稳定 `requestId`、`callId`、`toolName` 和 typed `toolInput`。
- `response`：提交的决定。Response policies 为审批运行，所以当前值是 `{ decision: "approve" }`。
- `session`：只读 session 身份和 lineage：`id`、`initiator`、`parent` 和 `turn`。
- `auth`：绑到 responder 的窄 `getToken(provider, options?)` 和 `requireAuth(provider, options?)`。授权依赖提供商身份或权限时用这些；交互式提供商流会 durable park，然后重试 policy。

返回 `{ status: "allowed" }` 接受审批。返回 `{ status: "rejected", reason }` 让共享请求保持 pending，这样另一个合格 responder 还可以批准。

### 跳过 schedule 分发 turn 的审批

`session.auth.current` 标识这一 turn 的调用者。Markdown schedules 自动使用 app principal（`authenticator: "app"`、`principalId: "eve:app"`、`principalType: "runtime"`）。`run` schedule 必须把它的 `appAuth` 传给 `send(...)`，子 session 才会用该 principal。匹配全部三个字段，才能在自动化 turns 跳过审批，同时在人调用同一工具时仍然提示：

```ts title="agent/tools/refund_charge.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Refund a charge.",
  inputSchema: z.object({ chargeId: z.string(), amount: z.number() }),
  approval: ({ session }) => {
    const auth = session.auth.current;
    return auth?.authenticator === "app" &&
      auth.principalId === "eve:app" &&
      auth.principalType === "runtime"
      ? "not-applicable"
      : "user-approval";
  },
  async execute(input) {
    return refund(input);
  },
});
```

`approval` 里的 `session` 形状与 `execute` 里的 `ctx.session` 相同：`id`、`auth`、`turn` 和可选的 `parent`。如果人后来恢复了一个由 schedule 启动的 session，`session.auth.current` 变成那个人，而 `session.auth.initiator` 仍是 app principal。只在 policy 应作用于整个 session 时才检查 `initiator`。在 scheduled turns 上跳过审批，意味着 step replay 时任何非幂等副作用都会再开火，所以把这个模式和幂等键或 `once()` 配在一起。

## Questions

`ask_question` 工具让模型暂停并向用户提**一个**问题，而不是猜测。模型用 `{ question, options? }` 调用它：

- `question`：向用户提出的问题，并带上回答所需上下文。
- `options`：两到三个互斥选项，各有 `label` 与一句 `description`。Channels 渲染成按钮或 select menu。省略 `options` 即为开放式提问。

用户始终可以自己打字而不选选项，因此模型不需要单独的「其它」选项。工具返回 `{ status: "answered", answer }`（所选 label 或用户原文）、用户未答就离开时的 `{ status: "dismissed" }`，或 session 无法请求输入时的 `{ status: "unavailable" }`。

`ask_question` 是 [opt-in 框架工具](../concepts/built-in-tools#ask_question)。用 `eve add tool/ask_question` 添加，会生成：

```ts title="agent/tools/ask_question.ts"
import { askQuestion } from "eve/tools/ask_question";

export default askQuestion();
```

它是基于 `ctx.ask()` 的普通 [workflow 工具](./workflows)。需要不同 schema、或要在同一次调用里处理答案时，可自己写 workflow 工具调用 `ctx.ask()`。没有任何提问工具时，模型在回复文本里提问，用户下一条消息携带答案。

## 暂停和恢复如何工作

审批和提问共用一套协议：

1. 工具调用需要审批，或像 `ask_question` 这样的 workflow 工具调用了 `ctx.ask()`。
2. eve 发出携带 pending requests 的 `input.requested` stream event。
3. turn 持久停在 `session.waiting`，要等多久都可以。
4. 客户端用 `inputResponses`（结构化，按 `requestId` 键控）或普通 follow-up `message` 回答。follow-up 文本匹配 option ID、option label 或数字 option index 时会自动解析，包括 `approve` 和 `cancel` 这类审批选项。

对阻塞工具里的 `ctx.ask()` 提问：仅当**恰好一个**提问挂起时，follow-up 消息才能作答；消息须匹配选项，或该提问允许自由文本。否则消息作为普通 turn 到达模型，且每个 `dismissible: true` 的挂起提问解析为 `dismissed`。后台工具与子智能体的提问需要结构化响应。

每个请求包含 `kind` 判别器：`tool-approval`、`question` 或 `session-limit`。客户端应该用 `kind` 选择行为和呈现；`toolName` 和 `requestId` 标识动作和请求，但不编码语义。

run 从 parked 的地方继续。因为暂停是 durable 的，等待时没有任何东西停在内存里——进程可以重启，parked turn 仍然存活。

后台子智能体请求输入时，eve 在它的 parent session 上发出同样的 `input.requested`。通过该 parent session 回答会把响应直接路由到被阻塞的 child，而不会调用 parent 模型。

对审批请求，不相关的 follow-up 文本不会拒绝 tool call。eve 保持审批 pending，并把 pending 状态记入模型可见的 session 历史。Follow-up turns 正常运行，审批未解决时仍可调用其它工具。一旦被回答，eve 恰好一次 settle 原来的 tool call。

完整事件和恢复契约见 [Sessions、Runs 与 Streaming](../concepts/sessions-runs-and-streaming)。

## 从客户端或渠道回答

Channels 把请求变成原生 UI：Slack adapter 把审批渲染成按钮、把问题渲染成 select menus，并把用户选择写回为答案。每个 [渠道](../channels/overview) 都免费获得这套行为。

从自己的前端扫描所有消息里的 pending requests，并通过同一 session 回答——客户端 reducer 和 `inputResponses` 形状见 [构建前端](../guides/frontend/overview)。

## 接下来读什么

- [工具（Tools）](./overview)
- [内置工具](../concepts/built-in-tools)
- [Sessions、Runs 与 Streaming](../concepts/sessions-runs-and-streaming)
- [构建前端](../guides/frontend/overview)
- [多租户审批](../patterns/multi-tenant-approvals)
