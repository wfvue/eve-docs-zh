---
title: "多租户出站认证（Multi-tenant outbound auth）"
description: "在 authored tools、OpenAPI connections 和 MCP connections 中，从活跃 turn 上下文选择租户 scope 的凭证。"
---

# 多租户出站认证（Multi-tenant outbound auth）

eve 把已校验的入站身份带进每个 turn。Authored tools 和 connections 可以用那个上下文为当前租户选择出站凭证：

- 工具执行器直接接收 `ctx`；
- OpenAPI 和 MCP 的 `auth` 可以是 `ctx` 的异步函数；
- connection headers 可以是异步 map 或异步单值。

整个模式就是这样。你的应用仍然拥有租户成员身份和凭证存储；eve 确保模型永远不需要看到或选择这些凭证。

## 建立租户 scope

配置路由 auth，让被接受的 principal 包含一个字符串 `tenantId` attribute。然后把运行时检查集中起来：

```ts title="agent/lib/tenant.ts"
import type { SessionContext } from "eve/context";

export function requireTenantCaller(ctx: SessionContext): {
  tenantId: string;
  userId: string;
} {
  const caller = ctx.session.auth.current;
  const tenantId = caller?.attributes.tenantId;
  if (caller?.principalType !== "user" || typeof tenantId !== "string") {
    throw new Error("An authenticated tenant user is required.");
  }
  return { tenantId, userId: caller.principalId };
}
```

租户来自已校验的路由 auth，绝不来自 prompt、工具参数或远程 API 响应。自定义 session 和 OIDC 示例见 [鉴权与路由保护（Auth & route protection）](../guides/auth-and-route-protection)。

## 用自己的 API key 或 JWT 认证

对有很多客户组织的生产应用，入站凭证往往是你自己的 API key、session cookie 或 JWT。在 eve 启动 run 之前用那个凭证认证调用者，然后把租户盖到 session 上：

```ts title="agent/channels/eve.ts"
import { eveChannel } from "eve/channels/eve";
import { localDev, type AuthFn } from "eve/channels/auth";
import { verifyAgentCaller } from "../../lib/app-auth";

function tenantAppAuth(): AuthFn<Request> {
  return async (request) => {
    const caller = await verifyAgentCaller(request);
    if (caller === null) return null;
    return {
      authenticator: "app",
      issuer: "https://app.example.com",
      principalId: caller.userId,
      principalType: "user",
      subject: caller.userId,
      attributes: {
        tenantId: caller.tenantId,
        roles: caller.roles,
      },
    };
  };
}

export default eveChannel({
  auth: [tenantAppAuth(), localDev()],
});
```

`verifyAgentCaller` 是应用代码。它可以校验 API key、验证 JWT 或读取应用 session，但它应该只在用户属于他们声称的租户之后返回。对同一个用户保持 `principalId` 稳定，当 id 可以来自多个身份系统时包含 `issuer`，并把 `tenantId` 等路由事实放进 `attributes`。

如果同一个用户可以在组织之间切换，在每次 session 创建或继续请求时认证选中的组织，并把那个选中的 `tenantId` 盖到当前 turn 上。

这不是 connection OAuth。用户已经向你的应用认证过；eve 用那个已校验 principal 选择正确的出站凭证。

## 构建租户 connection auth

对 Bearer tokens 或租户 scope 的 JWTs，写一个非交互 auth helper 并在 OpenAPI 和 MCP connections 之间复用。`principalType: "user"` 告诉 eve 要求路由 auth 里的已认证用户、按该用户键控 step 本地 token 缓存，并把投影的 principal 传进 `getToken`：

```ts title="agent/lib/tenant-connection-auth.ts"
import type { ConnectionPrincipal, NonInteractiveAuthorizationDefinition } from "eve/connections";
import { tenantCredentials, type TenantService } from "./tenant-credentials";

function requireTenantPrincipal(principal: ConnectionPrincipal): {
  tenantId: string;
  userId: string;
} {
  const tenantId = principal.type === "user" ? principal.attributes?.tenantId : undefined;
  if (principal.type !== "user" || typeof tenantId !== "string") {
    throw new Error("An authenticated tenant user is required.");
  }
  return { tenantId, userId: principal.id };
}

export function tenantBearerAuth(service: TenantService): NonInteractiveAuthorizationDefinition {
  return {
    principalType: "user",
    async getToken({ principal }) {
      const { tenantId, userId } = requireTenantPrincipal(principal);
      const credential = await tenantCredentials.getBearer(tenantId, service, { userId });
      return {
        token: credential.bearerToken,
        ...(credential.expiresAt ? { expiresAt: credential.expiresAt } : {}),
      };
    },
  };
}
```

模型从不提供 `tenantId`，也看不到返回的 token。如果远程服务使用多用户共享的租户级凭证，在你的 provider 中让凭证查找以 `tenantId` 键控；user-scoped connection auth 仍然有用，因为它拒绝未认证的 session，并让 eve 的 token 缓存不跨调用者身份。

## 认证一个 authored tool 调用

在 `execute` 内部派生租户、从应用 provider 抓取凭证并构造出站请求：

```ts title="agent/tools/list_invoices.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";
import { tenantCredentials } from "../lib/tenant-credentials";
import { requireTenantCaller } from "../lib/tenant";

export default defineTool({
  description: "List recent invoices from the current tenant's billing account.",
  inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(20) }),
  async execute({ limit }, ctx) {
    const { tenantId } = requireTenantCaller(ctx);
    const credential = await tenantCredentials.getBearer(tenantId, "billing");
    const response = await fetch(`https://billing.example.com/v1/invoices?limit=${limit}`, {
      headers: {
        authorization: `Bearer ${credential.bearerToken}`,
        "x-account-id": credential.externalTenantId,
      },
    });
    if (!response.ok) throw new Error(`Billing API returned ${response.status}.`);
    return await response.json();
  },
});
```

模型只控制 `limit`。即使 prompt 要求另一个租户，执行器也从 `ctx.session.auth.current` 选择凭证。

## 认证一个 OpenAPI connection

把可复用的 auth helper 挂到 connection 上。生成的操作工具在调用时接收 token，而不向模型暴露它：

```ts title="agent/connections/billing.ts"
import { defineOpenAPIConnection } from "eve/connections";
import { tenantCredentials } from "../lib/tenant-credentials";
import { tenantBearerAuth } from "../lib/tenant-connection-auth";
import { requireTenantCaller } from "../lib/tenant";

export default defineOpenAPIConnection({
  spec: "https://billing.example.com/openapi.json",
  description: "Invoices and subscriptions for the current tenant.",
  operations: { allow: ["listInvoices", "getInvoice", "updateSubscription"] },
  auth: tenantBearerAuth("billing"),
  headers: async (ctx) => {
    const { tenantId } = requireTenantCaller(ctx);
    const credential = await tenantCredentials.getBearer(tenantId, "billing");
    return { "X-Account-Id": credential.externalTenantId };
  },
});
```

当 `auth` 存在时，不要从 `headers` 返回 `Authorization`。eve 从 `getToken` 构造那个头，并拒绝冲突的定义。

## 认证一个 MCP connection

MCP connections 接受同样的回调：

```ts title="agent/connections/support.ts"
import { defineMcpClientConnection } from "eve/connections";
import { tenantCredentials } from "../lib/tenant-credentials";
import { tenantBearerAuth } from "../lib/tenant-connection-auth";
import { requireTenantCaller } from "../lib/tenant";

export default defineMcpClientConnection({
  url: "https://support.example.com/mcp",
  description: "Support tickets and customers for the current tenant.",
  tools: { allow: ["search_tickets", "get_ticket", "add_internal_note"] },
  auth: tenantBearerAuth("support"),
  headers: {
    "X-Workspace-Id": async (ctx) => {
      const { tenantId } = requireTenantCaller(ctx);
      const credential = await tenantCredentials.getBearer(tenantId, "support");
      return credential.externalTenantId;
    },
  },
});
```

## 认证一个仅 API key 的 connection

如果远程服务器不接受 Bearer auth，省略 `auth`，改从 `headers` 返回租户 API key：

```ts title="agent/connections/support.ts"
import { defineMcpClientConnection } from "eve/connections";
import { tenantCredentials } from "../lib/tenant-credentials";
import { requireTenantCaller } from "../lib/tenant";

export default defineMcpClientConnection({
  url: "https://support.example.com/mcp",
  description: "Support tickets and customers for the current tenant.",
  tools: { allow: ["search_tickets", "get_ticket", "add_internal_note"] },
  headers: async (ctx) => {
    const { tenantId, userId } = requireTenantCaller(ctx);
    const credential = await tenantCredentials.getApiKey(tenantId, "support", { userId });
    return {
      "X-Api-Key": credential.apiKey,
      "X-Workspace-Id": credential.externalTenantId,
    };
  },
});
```

对 OpenAPI connections 使用同样的形状。在 `headers` 中解析的 API keys 只在出站请求上发送；它们不是模型输入或工具结果。

## 提供凭证 provider

eve 面向的文件只需要这个应用契约：

```ts title="agent/lib/tenant-credentials.ts"
export type TenantService = "billing" | "support";

export interface TenantBearerCredential {
  bearerToken: string;
  externalTenantId: string;
  expiresAt?: number;
}

export interface TenantApiKeyCredential {
  apiKey: string;
  externalTenantId: string;
}

export interface TenantCredentialProvider {
  getBearer(
    tenantId: string,
    service: TenantService,
    options?: { userId?: string },
  ): Promise<TenantBearerCredential>;
  getApiKey(
    tenantId: string,
    service: TenantService,
    options?: { userId?: string },
  ): Promise<TenantApiKeyCredential>;
}

export { tenantCredentials } from "../../lib/tenant-credentials";
```

用你的应用已经信任的 secret 系统实现 provider：云 secret manager、加密数据库表、token broker，或你自己拥有的带外 OAuth 流程。eve 不规定这个选择。

Provider 必须对未知租户 fail closed、避免在日志或错误中返回 secrets，并在 `expiresAt` 之前轮换或刷新凭证。优先选择本身限制在一个远程租户的凭证；把 workspace headers 当作路由，而不是授权。

## 模型能看到什么、不能看到什么

1. 路由 auth 把已校验的租户盖到 session 上。
2. 工具代码读取 `ctx.session.auth.current`，connection auth 接收投影的 `principal`。
3. 应用 provider 解析对应的凭证。
4. eve 把结果 token 和 headers 直接发给远程服务。
5. 两者都不会成为模型消息或工具结果。

另外，对 session create、continue 和 stream 路由强制租户所有权。路由认证识别调用者，但你的应用拥有决定该调用者可以访问哪些 session ids 的 ACL。

不涉及框架原生的 tenant 对象。实现就是路由 auth、`ctx.session`、工具执行和异步 connection auth/header resolvers 的组合。
