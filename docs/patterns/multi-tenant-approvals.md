---
title: "多租户审批（Multi-tenant approvals）"
description: "为 authored tools、OpenAPI operations 和 MCP tools 异步解析租户策略。"
---

# 多租户审批（Multi-tenant approvals）

eve 的 `approval` 字段是一个异步策略 hook。它接收活跃 session、限定工具名、工具输入和之前已审批的工具。这足以让你的应用询问：这个租户应该允许、拒绝还是要求人工确认为某个 authored 或 connection 工具。

当你自己的 API key、JWT 或应用 session 建立租户，并且 connection 凭证从你的凭证存储中选择（而不是 OAuth）时，与 [多租户出站认证（multi-tenant outbound auth）](./multi-tenant-auth) 一起使用。

模式有两块：

1. 一个 adapter 把 eve 的审批上下文翻译成应用策略请求；
2. tools、OpenAPI connections 和 MCP connections 复用那个 adapter。

租户策略存储仍然属于你。它可以是 PostgreSQL 里的几列、一个策略服务、一个授权引擎，或 durable KV store 里的配置。

## 把租户策略适配到 eve approval

当前调用者和发起调用者都在 session 上可用。这个示例在咨询策略之前要求它们属于同一个租户：

```ts title="agent/lib/tenant-approval.ts"
import type { ApprovalContext, ApprovalStatus } from "eve/tools";
import { approvalPolicies } from "./approval-policies";

type Surface = "connection" | "tool";

function tenantIdOf(auth: ApprovalContext["session"]["auth"]["current"]): string | null {
  const tenantId = auth?.attributes.tenantId;
  return typeof tenantId === "string" ? tenantId : null;
}

export async function decideTenantApproval(
  surface: Surface,
  ctx: ApprovalContext,
): Promise<ApprovalStatus> {
  const current = ctx.session.auth.current;
  const tenantId = tenantIdOf(current);
  const initiatorTenantId = tenantIdOf(ctx.session.auth.initiator);
  if (current?.principalType !== "user" || !tenantId || tenantId !== initiatorTenantId) {
    return { type: "denied", reason: "The session is not pinned to one tenant user." };
  }
  const input = ctx.toolInput as Record<string, unknown> | undefined;
  if (typeof input?.tenantId === "string" && input.tenantId !== tenantId) {
    return { type: "denied", reason: "Tool input cannot select another tenant." };
  }
  const policy = await approvalPolicies.decide({
    tenantId,
    userId: current.principalId,
    resource: `${surface}:${ctx.toolName}`,
    input,
  });
  switch (policy.decision) {
    case "allow":
      return { type: "approved", reason: policy.reason };
    case "require-approval":
      return "user-approval";
    case "deny":
      return { type: "denied", reason: policy.reason };
  }
}
```

对 authored tools，`ctx.toolName` 是路径派生的名字，如 `transfer_funds`。对 connection tools，它是限定的，如 `billing__updateSubscription` 或 `support__add_internal_note`。你的策略服务可以匹配精确名字、connection 级模式、角色、金额、环境，或任何其他租户拥有的规则。

回调刻意不把 `approvedTools` 当作 session 级授权。每次调用都被求值。如果你的策略支持 approve-once 行为，在把 session 租户钉住之后显式咨询 `ctx.approvedTools`。

## 应用到 authored tool

Approval 在 `execute` 之前运行。执行器仍然必须再次派生并强制租户，因为 approval 是门禁，不是授权：

```ts title="agent/tools/transfer_funds.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";
import { transferFunds } from "../../lib/payments";
import { decideTenantApproval } from "../lib/tenant-approval";

export default defineTool({
  description: "Transfer funds from the current tenant's account.",
  inputSchema: z.object({
    destinationAccountId: z.string().min(1),
    amount: z.number().positive(),
    currency: z.string().length(3),
  }),
  approval: (ctx) => decideTenantApproval("tool", ctx),
  async execute(input, ctx) {
    const tenantId = ctx.session.auth.current?.attributes.tenantId;
    if (typeof tenantId !== "string") {
      throw new Error("An authenticated tenant is required.");
    }
    return await transferFunds({
      ...input,
      tenantId,
      idempotencyKey: `${ctx.session.id}:${ctx.session.turn.id}`,
    });
  },
});
```

对副作用使用应用幂等键。人工审批和重放安全解决的是不同的问题。

## 应用到 OpenAPI connection

同一个回调门禁每个生成的操作。限定的操作名让租户策略区分读和写：

```ts title="agent/connections/billing.ts"
import { defineOpenAPIConnection } from "eve/connections";
import { decideTenantApproval } from "../lib/tenant-approval";

export default defineOpenAPIConnection({
  spec: "https://billing.example.com/openapi.json",
  description: "Billing operations for the authenticated tenant.",
  operations: { allow: ["listInvoices", "updateSubscription"] },
  headers: async (ctx) => {
    const tenantId = ctx.session.auth.current?.attributes.tenantId;
    if (typeof tenantId !== "string") throw new Error("Tenant is required.");
    return {
      "X-Service-Token": process.env.BILLING_SERVICE_TOKEN!,
      "X-Tenant-Id": tenantId,
    };
  },
  approval: (ctx) => decideTenantApproval("connection", ctx),
});
```

Allow-list 限制模型可以发现什么。Approval 独立决定一个被发现的操作是否可以运行。

## 应用到 MCP connection

```ts title="agent/connections/support.ts"
import { defineMcpClientConnection } from "eve/connections";
import { decideTenantApproval } from "../lib/tenant-approval";

export default defineMcpClientConnection({
  url: "https://support.example.com/mcp",
  description: "Support tickets for the authenticated tenant.",
  tools: { allow: ["search_tickets", "add_internal_note"] },
  headers: async (ctx) => {
    const tenantId = ctx.session.auth.current?.attributes.tenantId;
    if (typeof tenantId !== "string") throw new Error("Tenant is required.");
    return {
      "X-Service-Token": process.env.SUPPORT_SERVICE_TOKEN!,
      "X-Tenant-Id": tenantId,
    };
  },
  approval: (ctx) => decideTenantApproval("connection", ctx),
});
```

策略接收 `connection:support__search_tickets` 或 `connection:support__add_internal_note` 作为它的 resource。

## 提供策略 adapter

eve 代码只需要这个接口：

```ts title="agent/lib/approval-policies.ts"
export interface ApprovalPolicyRequest {
  tenantId: string;
  userId: string;
  resource: string;
  input?: Record<string, unknown>;
}

export interface ApprovalPolicyDecision {
  decision: "allow" | "deny" | "require-approval";
  reason?: string;
}

export interface ApprovalPolicyProvider {
  decide(request: ApprovalPolicyRequest): Promise<ApprovalPolicyDecision>;
}

export { approvalPolicies } from "../../lib/approval-policies";
```

你的 provider 决定策略模型。常见实现会检查活跃租户成员身份、在 connection 级回退之前找到精确 resource 规则、求值角色和输入阈值，并默认拒绝。把这些选择留在应用代码里，而不是把数据库设计编码进 Agent。

策略查找失败应该抛出或拒绝，绝不静默允许。在带副作用的执行器内部重新检查授权，因为成员身份或策略在 run parked 期间可能变化。

## 保护审批响应

一次审批会 durable 地暂停 session，之后的请求恢复它。你的 HTTP 边界必须确保调用者不能继续或流式监听另一个租户拥有的 session。在应用中持久化 session 所有权，并在代理之前检查它：

- `POST /eve/v1/session/:sessionId`，包括 `inputResponses`；
- `GET /eve/v1/session/:sessionId/stream`。

内置审批确认有 session 访问权的人批准了调用。它不是证明由不同人或角色批准的四眼工作流。要满足那个需求，创建应用拥有的审批请求、通过渠道通知符合资格的审批人，并让策略只在那个请求记录了授权决定后返回 allow。

完整的 eve 集成是一个被 tools 和两种 connection 协议复用的异步 adapter。租户的规则存储和治理模型仍然是应用关注点。
