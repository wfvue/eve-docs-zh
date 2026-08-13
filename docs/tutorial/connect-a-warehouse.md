---
title: "连接仓库（Connect a Warehouse）"
description: "Build an Agent 教程第 4 步：让每个用户通过 Vercel Connect 上的 OAuth MCP 连接自己的仓库。"
---

# 连接仓库（Connect a Warehouse）

示例数据集让分析助手跑起来了，但它是替身。现在把 Agent 指向真实仓库，让每个用户通过浏览器登录连接自己的仓库。这就是 connection 的用途。它是一个模型通过工具触达的 MCP server，带 eve 为你驱动的认证。

这一步依赖 Vercel Connect，它还在 private beta。没有 Connect 访问？保留第 3 步的示例数据集并阅读这一步了解 connection 模型。第 5 到 9 步在示例数据集上工作，所以不连接仓库也能完成教程。

文件名设定运行时名字。把文件放在 `agent/connections/warehouse.ts`，它就注册为 `"warehouse"`，工具以 `warehouse__<tool>` 浮出。

## 声明 connection

仓库暴露一个 OAuth 后面的通用 SQL MCP。把 `@vercel/connect/eve` 的 `connect()` 作为 auth 传入，Vercel Connect 处理 OAuth 流程、存储 tokens 并为你刷新：

```ts title="agent/connections/warehouse.ts"
import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.your-warehouse.example/sse",
  description: "The team's data warehouse: run read-only SQL and list tables and columns.",
  auth: connect("warehouse"),
});
```

`"warehouse"` 是你注册 Connect client 时选的 UID。默认这个 OAuth 是 user-scoped。每个终端用户在自己的浏览器里授权，eve 在每次工具调用前解析那个用户的 token。

从 web 应用测试仓库之前，确保 eve channel 路由认证把你登录的应用用户映射到 `principalType: "user"`。Connect 支撑的 connection 只会在活跃 session 已有已认证用户 principal 时启动 per-user OAuth。如果路由认证只接受 `localDev()`、runtime token 或占位守卫，第一个仓库工具调用会以 `reason: "principal_required"` 失败，而不是显示登录挑战。

一旦你的账户启用了 Connect，接上它：

1. 安装包：`npm install @vercel/connect`。
2. 创建 Connect client：`vercel connect create <type> --name warehouse`。
3. 把 client 关联到你的项目。
4. 运行 `vercel link` 和 `vercel env pull`，让 `VERCEL_OIDC_TOKEN` 在本地可用。

完整参考见 [MCP 连接（MCP connections）](../connections/mcp)。

## 用户看到什么

问一个需要仓库的问题：

```txt
How many enterprise customers signed up last month?
```

第一次，模型挑了一个仓库工具但没有 token，所以 turn park，channel 显示 "Sign in" 提示。你在浏览器里授权，OAuth 回调完成后，turn 从那个确切 step 恢复（第 2 步的 durable parking），查询运行。session 里后续调用复用缓存的 per-user token，所以没有提示。

## Token 永远不会到达模型

每次请求 MCP server 之前，eve 解析 bearer 并作为 `Authorization: Bearer <token>` 发送。模型只看到工具名、描述和结果。凭证在它够不到的地方。

想要更多控制，用审批门禁 connection（`approval: once()`）或收窄模型看到的工具（`tools.allow`）。见 [MCP 连接（MCP connections）](../connections/mcp)。

→ 下一步：[运行分析（Run analysis）](./run-analysis)
了解更多：[MCP 连接（MCP connections）](../connections/mcp) · [鉴权与路由保护（Auth and route protection）](../guides/auth-and-route-protection)
