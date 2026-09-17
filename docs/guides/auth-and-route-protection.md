---
title: "鉴权与路由保护（Auth & Route Protection）"
description: "用有序 auth walk、验证 helper 和连接鉴权保护 Eve Agent 的 HTTP routes。"
---

# 鉴权与路由保护（Auth & Route Protection）

Eve 有两套独立的鉴权系统：

- **Route auth（inbound）**：决定谁可以访问 Agent 的 HTTP routes。它在 channel layer 运行，会在任何模型工作开始前拦截请求。
- **Tool and connection auth（outbound）**：决定 Agent 调用外部服务时如何登录，例如 OAuth MCP server。它在工具或连接真正访问外部服务时发生。

通常先配置 route auth，再处理 tool 和 connection auth。

## Route auth（Route auth）

Route-auth policy 通常写在 HTTP channel factory：`agent/channels/eve.ts`。它保护这些 session routes：

- `POST /eve/v1/session`
- `POST /eve/v1/session/:sessionId`
- `GET /eve/v1/session/:sessionId/stream`

Eve 默认 fail closed。生产环境浏览器请求会被拒绝，除非你配置了能接受它的 authenticator。匿名访问必须显式使用 `none()`。`GET /eve/v1/health` 始终公开，方便负载均衡器和监控探测。

```ts title="agent/channels/eve.ts"
import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  auth: [vercelOidc(), localDev()],
});
```

`vercelOidc()` 是 Vercel 托管 Agent 和 Vercel-to-Vercel 调用的便利方式，不是强制要求。如果你的应用已经有用户 session、API key 或 identity provider，可以把自己的 authenticator 放进 `auth` walk。

## 有序 auth walk（The ordered auth walk）

`auth` 可以是单个 `AuthFn`，也可以是数组。Eve 会按顺序执行。每个 entry 有三种结果：

- 返回 `SessionAuthContext`：接受请求，并停止 walk。
- 返回 `null` / `undefined`：跳过当前 entry，继续下一个。
- 抛出鉴权错误：按指定状态拒绝请求。

如果全部 entry 都跳过，请求得到 `401`。空数组 `auth: []` 表示拒绝所有请求。

```ts
import { type AuthFn, localDev, vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";
import { getSession } from "@/lib/auth";

function appSession(): AuthFn<Request> {
  return async (request) => {
    const session = await getSession(request);
    if (!session) return null;
    return {
      authenticator: "app",
      principalId: session.userId,
      principalType: "user",
      attributes: { providerId: session.providerId },
    };
  };
}

export default eveChannel({
  auth: [appSession(), vercelOidc(), localDev()],
});
```

把你自己的 provider 放在兜底 helper 前面。`localDev()` 通常放在最后。非 Vercel host 上，除非你明确要接受 Vercel-issued tokens，否则可以省略 `vercelOidc()`。

## 验证 helpers（Verifier helpers）

`eve/channels/auth` 提供这些 channel-auth helpers：

| Helper | 适用场景 |
| --- | --- |
| `localDev()` | 本地开发。只接受发往 loopback hostname 的请求。 |
| `vercelOidc()` | 常见 Vercel 部署路径。验证 Vercel OIDC bearer JWT。 |
| `none()` | 显式接受匿名访问，通常作为最后 entry。 |
| `httpBasic(...)` | Operator 或 service 使用共享用户名和口令访问。 |
| `jwtHmac(...)` | 验证 shared-secret JWT signer。 |
| `jwtEcdsa(...)` | 验证外部系统签发的 asymmetric JWT。 |
| `oidc(...)` | 验证任意 issuer 签发的 OIDC token。 |

### `localDev()`

`localDev()` 会鉴权为 synthetic `local-dev` principal，但只在请求发往 loopback hostname 时生效，例如 `localhost`、`*.localhost`、`127.0.0.0/8` 或 `::1`。它看 request URL 的 hostname，而不是只看运行环境变量。这是为了避免非 Vercel 公网部署误把所有流量当成本地流量。

### `vercelOidc()`

`vercelOidc()` 会验证 Vercel OIDC bearer JWT。为当前 `VERCEL_PROJECT_ID` 签发的 token 会被接受，所以内部 runtime caller 和 subagent caller 可以零配置工作。带 `external_sub` 的 token 会被识别为 user caller，但需要 project 和 environment 都匹配当前部署。

如果要允许其它 Vercel project 调用，可以传入 `subjects`。建议用 `vercelSubject(...)` 构造匹配规则，避免手写 subject string 时拼错或 wildcard 过宽。

```ts
import { vercelOidc, vercelSubject } from "eve/channels/auth";

vercelOidc({
  subjects: [
    vercelSubject({ teamSlug: "partner", projectName: "data" }),
    vercelSubject({ teamSlug: "acme", projectName: "agent", environment: "*" }),
  ],
});
```

## 网络策略（Network policy）

`eve/channels/auth` 导出 `createIpAllowList(...)` 和 `isIpAllowed(...)`。它们可以在模型工作开始前切断请求。未通过 network policy 的请求会在 auth 和 runtime execution 之前被丢弃。

## 生产前替换 placeholderAuth（Replace placeholderAuth before production）

`eve init` 会在 `agent/channels/eve.ts` 中生成 `placeholderAuth()` guardrail：

```ts
import { eveChannel } from "eve/channels/eve";
import { localDev, placeholderAuth, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  auth: [vercelOidc(), localDev(), placeholderAuth()],
});
```

生产环境中，`placeholderAuth()` 会返回结构化 `401`，让生成的 Web chat app 提示“auth 还没配置”，而不是抛内部错误。上线前必须把它替换成你的应用 `AuthFn` 或内置 helper。最终策略不一定要保留 `vercelOidc()`；自托管或非 Vercel 身份体系下，可以使用 Basic、JWT、OIDC helper，或自定义 `AuthFn`。

Route-auth 的敏感值应放在环境变量里，不会进入 compiled artifacts。Runtime 会在启动时从 authored channel definition 重新 materialize。

## 接受来自另一部署的转发身份（Accepting forwarded identity）

`defineRemoteAgent({ forwardPrincipal: true })` 的调用方（见[远程 Agent](./remote-agents#转发调用方身份)）会在 create / continuation 请求体里以 `forwardedPrincipal` 断言终端用户身份。默认一律 `403`——要接受别人「自称是谁」的说法，必须用 `eveChannel` 的 `trustedForwarders` **精确点名**信任哪些转发者：

```ts title="agent/channels/eve.ts"
import { eveChannel } from "eve/channels/eve";
import { vercelOidc, vercelSubject } from "eve/channels/auth";

export default eveChannel({
  auth: [vercelOidc()],
  // 只有 router 部署可以转发 eve 委派上下文
  trustedForwarders: (forwarder) =>
    forwarder.subject === vercelSubject({ teamSlug: "acme", projectName: "router" }),
});
```

`trustedForwarders` 授权已验证的转发者提供 eve 委派上下文：principal 身份、父 session lineage，以及（在转发 principal 时）trace 内容约束。务必精确匹配：`() => true` 会把该权限交给每个通过 route auth 的调用方，包括被 `vercelOidc()` 接受的 preview 部署。框架默认 channel **拒绝**转发的 principal，并忽略其它上下文。

谓词接受 create 请求时，`ctx.session.auth.current` 与 `.initiator` 会带上转发用户，效果如同用户直接调用本部署。continuation 时只替换 `auth.current`；`auth.initiator` 仍是 session 创建者。因此 user-scoped connections、本地子智能体以及后续 `forwardPrincipal` 跳转看到的是当前 turn 的调用方。

接受的上下文会把转发者记为 `eve:forwarded-by` 属性（接收方总是覆盖，转发者无法伪造）。转发身份拒绝是大声失败：没有配置 `trustedForwarders`、或谓词拒绝该转发者 → `403`；畸形 payload → `400`。只接受 principal 元数据——token 与凭据从不跨跳。

受信任的父 session lineage 会填充 `ctx.session.parent`，并在委派链上保留根 session。不受信任的 lineage 被忽略；接受 lineage **不会**取消正常的根 session token 上限。

对带 callback body、且有有效采样 `traceparent` 的远程委派请求，同一份已接受的 `trustedForwarders` 结果还可接纳来自一个 W3C Baggage 成员的 origin audience 与方向性内容上限。该断言**不是**授权许可：接收方的 trace policy 仍对照不可变的 origin audience 独立裁决，再与二者求交；后续每一跳只转发收窄后的结果。畸形、部分、未采样或混版本断言退化为仅元数据。callback 与 headers 由调用方提供；已验证的传输 principal 与 `trustedForwarders` 才是信任边界。见[保留 trace 内容](./remote-agents#preserving-trace-content)。

W3C `traceparent`、`tracestate` 与转发的 conversation ID 是关联元数据。它们**不**要求 `trustedForwarders`，也不建立 session lineage 或授予 session 访问权。

> ⚠️ 续跑持久远程 session 前，两端都必须支持 continuation forwarding。仅支持 create 的接收方会以 HTTP 400 拒绝转发的 continuation；发送方不会回退到 service 身份。升级行为见[转发调用方身份](./remote-agents#转发调用方身份)。

## `ctx.session.auth` 会拿到什么（What reaches `ctx.session.auth`）

Runtime code 中，`ctx.session.auth` 会把 channel route auth 的结果作为 caller snapshot 向后传递：

- `auth.current`：当前 active inbound turn 的 caller。
- `auth.initiator`：启动 durable session 的 caller。
- Follow-up message 会更新 `auth.current`，但不会改变 `auth.initiator`。
- 内部 runtime paths，例如 subagents，可能没有经过 authored route，此时二者可以是 `null`。HTTP traffic 要么得到 `SessionAuthContext`，要么返回 `401`。

可以用 `auth.current` 或 `auth.initiator` 上的 principal 限制 tools、按 principal 解析 [动态能力（Dynamic capabilities）](../dynamic-capabilities)，或强制 tenant boundaries。Route auth 不会自动实现 per-user、per-tenant 或 per-session ownership，你需要在应用层自己实现。

## Tool 和 connection 鉴权（Tool and connection auth）

Tool 和 connection auth 用于访问需要交互式登录的外部服务，例如 OAuth MCP server。Connections 在 connection definition 上声明 `auth`。Tools 可以在调用点用 `ctx.getToken(provider)` 解析 provider；当下游服务拒绝 token 时，再调用 `ctx.requireAuth(provider)` 重新授权。

User-scoped auth 的 principal 来自 route auth。`@vercel/connect/eve` 的 `connect("...")` 默认使用 `principalType: "user"`，因此 active session 需要有 `ctx.session.auth.current.principalType === "user"`。匿名、local-dev-only、runtime-scoped 或 service-scoped session 没有 end-user identity，无法绑定 user OAuth grant。

外部服务以 Agent 自身身份行动时，使用 app-scoped auth：

```ts
auth: connect({ connector: "linear/myagent", principalType: "app" });
```

外部服务以登录用户身份行动时，使用 user-scoped auth：

```ts
auth: connect("linear/myagent");
```

### 在 connection 上（On a connection）

```ts title="agent/connections/linear.ts"
import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";
import { once } from "eve/tools/approval";

export default defineMcpClientConnection({
  url: "https://mcp.linear.app/mcp",
  description: "Linear: project management, issue tracking, and team workflows.",
  auth: connect("linear/myagent"),
  approval: once(),
});
```

第一次需要 user-scoped connection 的调用会启动 OAuth sign-in，并给 caller 一个授权 URL。Vercel Connect 会代理流程并保存凭据。凭据按 workflow step 解析和缓存，不会写进历史，也不会展示给模型。非交互式 connections 可以使用 static token，或 `connect({ connector, principalType: "app" })`。更多形态见 [连接（Connections）](../../connections)。

### 在单个 tool 上（On a single tool）

当一个 tool 自己调用 OAuth 服务时，可以把 provider 放在调用点，而不单独定义 connection：

```ts title="agent/tools/list_okta_groups.ts"
import { defineTool } from "eve/tools";
import { connect } from "@vercel/connect/eve";
import { z } from "zod";

const oktaAuth = connect("okta/myagent");

export default defineTool({
  description: "List the caller's Okta groups.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const { token } = await ctx.getToken(oktaAuth);
    const res = await fetch("https://api.okta-proxy.internal/groups", {
      headers: { authorization: `Bearer ${token}` },
    });
    return res.json();
  },
});
```

Tool 的 `ctx` 暴露 provider-scoped auth accessors：

- `ctx.getToken(provider, options?)`：解析 inline provider，复用 connection auth 的 cache、callback 和 sign-in 机制。
- `ctx.requireAuth(provider, options?)`：驱逐 cached token，并启动新的 authorization challenge。下游 `401` 拒绝 token 后使用它。

Vercel Connect providers 通常会在 authorization challenge 中提供自己的 display name。只有要覆盖用户看到的文案时才传 `displayName`。如果多个 custom providers 没有 provider metadata，请给每个 provider 传显式 `authKey`，例如 `ctx.getToken(auth, { authKey: "github" })`。

## 接下来读什么（What to read next）

- [安全模型（Security model）](../../concepts/security-model)：trust boundaries 和上线前检查
- [连接（Connections）](../../connections)：connection auth 形状
- [部署（Deployment）](../deployment)：生产环境中 route-auth 配置放在哪里
