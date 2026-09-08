---
title: "连接仓库（可选）（Connect a Warehouse）"
description: "Build an Agent 教程的可选后续：通过 Vercel Connect 上的 OAuth MCP，让每个用户连接自己的仓库。"
---

# 连接仓库（可选）（Connect a Warehouse）

先完成[示例数据路径下的教程](./first-agent)。当你已有带 MCP server 的仓库时，可以把它接到分析助手，并让每个用户在浏览器里登录授权。这就是 connection：模型通过工具触达的 MCP server，认证由 eve 驱动。

[Vercel Connect 已正式可用（GA）](https://vercel.com/changelog/vercel-connect-secure-access-to-external-services-for-your-agents)。用[示例数据集](./query-sample-data)就能完成教程；Connect 只用于本页展示的 OAuth 集成。

## 开始之前

这个集成需要：

- 仓库账户，以及该仓库可用的 MCP server 完整 endpoint URL。Connect 管理凭证，但不会替你创建仓库，也不会把普通 SQL 库变成 MCP server。
- 授权该 server 的权限，并具备你希望 Agent 查询数据的只读访问。
- Vercel 账户，以及已 link 的项目供 Connect 使用。
- eve session 上已认证的用户。先从 Web 应用做 per-user OAuth 前，完成 [上线（Ship it）](./ship-it#replace-placeholderauth) 里的路由认证设置。

若你第一次跟教程，请保留 `run_sql` 并[继续到运行分析](./run-analysis)。这个集成可以稍后再加。

## 注册 connector

在 `analytics-assistant/` 下运行。把示例 URL 换成你的 MCP server 真实 endpoint（含 path）：

```sh
npm install @vercel/connect
npx vercel@latest link
npx vercel@latest connect create "https://your-warehouse.example/mcp" --name warehouse
```

按提供方提示完成注册。**复制 CLI 返回的 connector UID**。传给 `--name` 的显示名不是 UID。把返回的 connector attach 到本项目，再拉取本地环境：

```sh
npx vercel@latest connect attach "<returned-connector-uid>" --yes
npx vercel@latest env pull
```

`vercel env pull` 会提供本地请求 Connect 所需的 `VERCEL_OIDC_TOKEN`。该 token 标识 Vercel 项目，并不会让终端用户登录应用。下面步骤使用 [上线](./ship-it#replace-placeholderauth) 中已认证的部署。[Connect 参考](https://vercel.com/docs/connect) 覆盖各服务设置与项目 attach。

## 声明 connection

创建 `agent/connections/warehouse.ts`。把 endpoint URL 与 connector UID 都换成你刚配置的值：

```ts title="agent/connections/warehouse.ts"
import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://your-warehouse.example/mcp",
  description: "The team's data warehouse: run read-only SQL and list tables and columns.",
  auth: connect("<returned-connector-uid>"),
});
```

文件名把 eve connection 注册为 `"warehouse"`，工具名为 `warehouse__<tool>`。这个 eve 名与 Connect connector UID 无关。远端 server 决定有哪些工具；使用前先核对工具清单与只读权限。

`connect("...")` 默认是 user-scoped。每个终端用户在自己的浏览器授权，eve 在工具调用前解析该用户的 token。eve channel 的路由认证必须把已登录应用用户映射到 `principalType: "user"`。`localDev()`、runtime token 或占位守卫不能提供该身份；那些 session 会在 OAuth 开始前以 `reason: "principal_required"` 失败。共享应用凭证见 [app vs. user auth](../connections#choose-app-vs-user-auth)。

## 部署并试用

部署更新后的应用，让已认证 Web 应用带上新 connection：

```sh
npx vercel@latest deploy
```

打开新的 HTTPS preview URL，用 [上线](./ship-it#replace-placeholderauth) 配置的凭证登录，并创建新 session。教程的 dev server 会绕过浏览器登录并使用 `localDev()`；仅重启 `npm run dev` 并不能提供此 connection 需要的用户身份。

在已认证 Web 应用中，让 Agent 先查看仓库可用表，再查询你有权限的表。使用该 server 自己的 schema，不要假设它有教程里的 `orders` / `customers`。

若用户尚未授权 connector，turn 会 park，channel 显示登录链接。在浏览器完成授权；回调成功后 turn 恢复并重试工具调用。之后在授权仍有效期间复用既有 grant。若注册成功但工具连不上，见 [MCP connection troubleshooting](../connections/mcp#troubleshooting)。

## Token 永远不会到达模型

每次请求 MCP server 前，eve 解析 bearer 并作为 `Authorization: Bearer <token>` 发送。模型看到工具名、描述和结果。凭证留在应用 runtime。

需要时用审批门禁 connection（`approval: once()`）或收窄模型看到的工具（`tools.allow`）。见 [MCP 连接（MCP connections）](../connections/mcp)。

→ 回到教程：[运行分析（Run analysis）](./run-analysis)

了解更多：[MCP 连接（MCP connections）](../connections/mcp) · [鉴权与路由保护（Auth and route protection）](../guides/auth-and-route-protection)
