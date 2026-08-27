---
title: "MCP Channel"
description: "把 eve Agent 发布为带鉴权支持的 MCP server。"
---

# MCP Channel

MCP channel 让 Claude Code 这类客户端通过四个工具把 durable 工作委派给 eve Agent：`agent_start`、`agent_get`、`agent_update` 和 `agent_cancel`。

当你的 eve Agent 需要调用别人的 MCP server 时，改用 [MCP 连接（MCP Connections）](../connections/mcp)。

官方原文：[MCP Channel](https://eve.dev/docs/channels/mcp)。

## 配置渠道

创建 `agent/channels/mcp.ts`。即使在开发期也必须显式配置认证。

```ts title="agent/channels/mcp.ts"
import { localDev } from "eve/channels/auth";
import { mcpChannel } from "eve/channels/mcp";

export default mcpChannel({
  auth: localDev(),
});
```

这会在 `eve dev` 或 `vercel dev` 下接受一个合成的本地 principal，并在生产拒绝所有请求。部署前换成下面的生产认证模式之一。`localDev()` 检查的是运行环境，不是请求 hostname：通过 localhost 访问 `eve start` 的生产进程不会激活它。

### 路由

默认 Streamable HTTP 端点是 `/eve/v1/mcp`。应用需要发布到别处时设置 `route`：

```ts title="agent/channels/mcp.ts"
import { localDev } from "eve/channels/auth";
import { mcpChannel } from "eve/channels/mcp";

export default mcpChannel({
  auth: localDev(),
  route: "/mcp",
});
```

渠道在所选路由注册 `GET`、`POST` 和 `DELETE`。

## Interactive OAuth

对应该打开登录流的 MCP 客户端，把 eve 配成 OAuth protected resource。用 `oauthResource()` 包装 access-token verifier：

```ts title="agent/channels/mcp.ts"
import { oauthResource, oidc } from "eve/channels/auth";
import { mcpChannel } from "eve/channels/mcp";

const issuer = "https://auth.example.com";
const resource = "https://agent.example.com/eve/v1/mcp";

const authenticateRequest = oidc({
  issuer,
  audiences: [resource],
});

export default mcpChannel({
  auth: oauthResource(authenticateRequest, {
    issuer,
    resource,
    scopes: ["agent:invoke"],
  }),
});
```

`issuer` 标识的 authorization server 必须签发被包装 verifier 接受的 tokens。`scopes` 广告客户端应该请求什么；verifier 仍负责签名、过期、audience/resource 和 scope 强制。

`oauthResource()` 不签发 tokens，也不运行 authorization server。它给普通入站 `AuthFn` 装饰 OAuth protected-resource metadata，让 `mcpChannel()` 可以发布 discovery，并在 Bearer challenges 上加上 `resource_metadata`。Client registration、consent、token issuance 和 authorization-server metadata 仍是 identity provider 的责任。

### 自己校验 bearer token

token 校验需要应用特定逻辑时，使用自定义 `AuthFn`：

```ts title="agent/channels/mcp.ts"
import { extractBearerToken, oauthResource, verifyOidc } from "eve/channels/auth";
import { mcpChannel } from "eve/channels/mcp";

const issuer = "https://auth.example.com";
const resource = "https://agent.example.com/eve/v1/mcp";

async function verifyToken(request: Request) {
  const token = extractBearerToken(request.headers.get("authorization"));
  const result = await verifyOidc(token, {
    audiences: [resource],
    issuer,
  });

  return result.ok ? result.sessionAuth : null;
}

export default mcpChannel({
  auth: oauthResource(verifyToken, {
    issuer,
    resource,
    scopes: ["agent:invoke"],
  }),
});
```

`verifyOidc()` 使用 issuer 的 discovery document 校验 token 签名和 claims。返回 `sessionAuth` 接受请求并把 invocation ownership 绑到该已验证 principal。返回 `null` 让 auth walk 继续；没有任何 strategy 接受时 eve 返回 `401`。

你可以包装任何 strategy，包括 `vercelOidc()`，但广告的 authorization server 必须签发该 strategy 接受的 tokens。单独的 `vercelOidc()` 是预配置的 Vercel workload identity，不会广告交互式登录。

### Protected-resource metadata

默认情况下，eve 按 RFC 9728 从完整 MCP resource identifier 派生 metadata 路径：

| MCP resource | Protected-resource metadata |
| --- | --- |
| `https://agent.example.com/eve/v1/mcp` | `https://agent.example.com/.well-known/oauth-protected-resource/eve/v1/mcp` |
| `https://agent.example.com/mcp` | `https://agent.example.com/.well-known/oauth-protected-resource/mcp` |

公开 resource identifier 无法从入站请求派生时设置 `resource`。只有 discovery 必须放在非派生位置时才设置 `metadataPath`。

Metadata 端点对跨源 `GET`、`HEAD` 和 `OPTIONS` 开放，方便浏览器托管的客户端发现 authorization server。MCP 协议请求仍保持 same-origin。

## 其它认证模式

`mcpChannel()` 接受与其它 eve channels 相同的入站 auth strategies：Basic auth、HMAC 或 ECDSA JWTs、generic OIDC、Vercel OIDC、自定义 `AuthFn` 策略，或它们的有序数组。这些模式除非包在 `oauthResource()` 里，否则不会自动产生交互式登录；在 MCP 客户端里带外配置凭据。

受保护请求没有任何被接受的凭据时，eve 返回 Bearer challenge。每个 strategy 都拒绝的 Bearer token 会得到 `error="invalid_token"`。已验证调用者缺少必要 scopes 时，抛出带 `error="insufficient_scope"` Bearer challenge 的 `ForbiddenError`。MCP channel 会保留该 challenge 并加上 protected-resource metadata URL。

完整 strategy 和 auth-walk 模型见 [鉴权与路由保护](../guides/auth-and-route-protection)。

### 公开访问

有意不认证就暴露 MCP 端点时，使用 `none()`：

```ts title="agent/channels/mcp.ts"
import { none } from "eve/channels/auth";
import { mcpChannel } from "eve/channels/mcp";

export default mcpChannel({
  auth: none(),
});
```

这允许任何人调用 Agent。每个调用者共享匿名 principal，所以 invocation IDs 在 workflow retention 过期前都是 bearer capabilities。只在匿名调用是有意设计时才使用公开访问。

## HTTP 安全

MCP transport 在认证前校验请求：

- 远程端点要求 HTTPS；HTTP 只在 loopback 上接受。
- `Host` 必须匹配请求 URL。
- 浏览器协议请求必须有精确 same-origin 的 `Origin`。

网关或反向代理改变了公开 origin 或 path 时，显式设置 `resource`，让 metadata 和认证 challenges 广告客户端面对的 MCP resource。

Protected-resource metadata 端点有意 CORS-readable。MCP transport 本身不启用跨源浏览器访问；浏览器应用需要连接时，在前面放 same-origin backend 或已认证的服务端 proxy。

端点直接服务 MCP `2026-07-28`，并保留无状态 `2025-11-25` Streamable HTTP 兼容。两种模式 eve 都不保持 MCP transport session。

## 调用 Agent

MCP 客户端收到四个工具：

| 工具 | 输入 | 用途 |
| --- | --- | --- |
| `agent_start` | `{ message, outputSchema? }` | 启动 durable 工作并立即返回 invocation ID。 |
| `agent_get` | `{ invocationId }` | 读取 invocation 的完整当前状态。 |
| `agent_update` | `{ invocationId, responses }` | 回答完整的 pending human-input batch。 |
| `agent_cancel` | `{ invocationId }` | 请求协作式取消非终态工作。 |

`agent_start` 创建一个 task-mode eve session，并在 durable 接受后返回。保留它的 `invocationId`，然后调用 `agent_get` 直到 invocation 到达终态。状态为 `working` 时，至少等待 `pollAfterMs` 再轮询。

Invocation 响应用 `status` 区分：

- `working`：工作进行中；按 `pollAfterMs` 继续轮询。
- `input_required`：展示 `inputRequests`，再通过 `agent_update` 发送完整答案 batch。成功的 update 返回新的 `working` 状态。
- `authorization_required`：展示返回的登录 URL、user code 或说明。Connection callback 会自动恢复 invocation；继续轮询。
- `completed`：消费可选的 `result`。
- `failed`：检查结构化 `error`。
- `cancelled`：取消到达终态。

取消是协作式的，所以 `agent_cancel` 之后继续调用 `agent_get` 直到状态变成终态。

可选 output schemas 限制为 64 KiB、32 层和 2,048 个节点。外部 `$ref` 会被拒绝。

## Invocation ownership

每次 MCP 操作都会重跑配置的 auth 策略。使用已认证策略时，invocation 属于启动它的 principal；知道它的 ID 不够。Bearer tokens 不会和 invocation 一起存储，也不会转发给 Agent 的 tools。

使用 `none()` 时，每个调用者共享匿名 principal，所以随机 invocation ID 变成 bearer capability。不要把它放进日志和 URLs，并把它当作在 workflow retention 过期前都可用。当 workflow backend 报告保留截止时间时，响应会包含 `expiresAt`。

## 接下来读什么

- [鉴权与路由保护](../guides/auth-and-route-protection)
- [MCP 连接](../connections/mcp)：让 eve Agent 调用另一个 MCP server
- [Sessions、Runs 与 Streaming](../concepts/sessions-runs-and-streaming)
