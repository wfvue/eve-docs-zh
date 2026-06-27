---
title: "OpenAPI 连接（OpenAPI Connections）"
description: "把 OpenAPI 3.x 或 Swagger 2.0 文档转换成 Eve connection tools，配置鉴权，并控制模型能发现哪些 operation。"
---

# OpenAPI 连接（OpenAPI Connections）

OpenAPI connection 会把 OpenAPI 3.x 或 Swagger 2.0 文档转换成 connection tools，通常一个 operation 对应一个工具。

当服务已经发布 HTTP API 契约，并且你希望 Eve 从这个契约自动推导模型可见工具时，使用 OpenAPI connection。

如果服务已经暴露 MCP Server，或者远端服务需要自己动态维护工具 schema，优先使用 [MCP connection](./mcp)。

## 定义一个 OpenAPI connection

在 `agent/connections/` 下创建文件。文件名就是运行时连接名：

```txt
agent/connections/petstore.ts
```

会注册为：

```txt
petstore
```

生成出来的 operation 工具会以这种形式命名：

```txt
petstore__<operation>
```

示例：

```ts title="agent/connections/petstore.ts"
import { defineOpenAPIConnection } from "eve/connections";

export default defineOpenAPIConnection({
  spec: "https://petstore3.swagger.io/api/v3/openapi.json",
  description: "Pet store inventory and orders.",
  auth: { getToken: async () => ({ token: process.env.PETSTORE_TOKEN! }) },
});
```

如果 operation 有 `operationId`，工具名会使用它，例如：

```txt
petstore__getInventory
```

如果没有 `operationId`，Eve 会根据 HTTP method 和 path 派生一个确定性的工具名。

## spec 可以是什么

`spec` 可以是：

- HTTPS URL：Eve 运行时拉取 OpenAPI 文档。
- 已解析的 inline OpenAPI object：直接写在代码里或从本地文件导入。

选择建议：

| 形式 | 适合场景 |
| --- | --- |
| URL | API 提供方维护契约，并可能更新。 |
| Inline object | 私有 API、小型手写契约、或你希望把 spec 固定在源码里。 |

## Base URL 和 servers

如果提供了 `baseUrl`，Eve 会用它解析 operation path。否则会从 spec 推导：

- OpenAPI 3.x：使用第一个可用 `servers` entry。
- Swagger 2.0：使用 `schemes`、`host` 和 `basePath`。

当 spec 缺少 server 信息、指向错误环境、使用了不想要的 relative server URL，或你希望为 Agent 固定环境时，应该显式设置 `baseUrl`。

```ts title="agent/connections/crm.ts"
import { defineOpenAPIConnection } from "eve/connections";

export default defineOpenAPIConnection({
  spec: "https://api.example.com/openapi.json",
  baseUrl: "https://api.example.com",
  description: "CRM accounts, contacts, and opportunities.",
});
```

## 使用 Vercel Connect 做 OAuth

对于 OAuth API，推荐使用 Vercel Connect。Connect 会处理浏览器授权、加密 token 存储、refresh 和 project access。`@vercel/connect/eve` 的 `connect()` 会把这些流程接入 Eve connection auth。

```bash
npm install @vercel/connect
vercel link
vercel connect create github --name github
vercel connect attach <connector-uid> --yes
vercel env pull
```

然后使用 connector UID：

```ts title="agent/connections/github.ts"
import { connect } from "@vercel/connect/eve";
import { defineOpenAPIConnection } from "eve/connections";

export default defineOpenAPIConnection({
  spec: "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json",
  baseUrl: "https://api.github.com",
  description: "GitHub repositories, issues, pull requests, and users.",
  auth: connect("github/github"),
});
```

`connect("...")` 默认是 user-scoped，要求当前 Eve session 已经有用户身份。如果 API 应该代表 Agent 自己调用，而不是代表最终用户调用，可以改成 app-scoped：

```ts
auth: connect({ connector: "github/github", principalType: "app" })
```

如果 provider 要求指定 OAuth scopes、audiences、resource indicators 或 authorization details，可以在 `connect(...)` 上使用 `tokenParams`。

## 静态 token 和 headers

如果你已经有 bearer token、API key、service account token 或自己的 OAuth 流程，可以用 `auth.getToken`：

```ts title="agent/connections/crm.ts"
import { defineOpenAPIConnection } from "eve/connections";

export default defineOpenAPIConnection({
  spec: "https://api.example.com/openapi.json",
  baseUrl: "https://api.example.com",
  description: "CRM accounts, contacts, and opportunities.",
  auth: {
    getToken: async () => ({ token: process.env.CRM_TOKEN! }),
  },
});
```

如果服务需要非 Bearer 认证、版本 header 或租户路由，可以用 `headers`：

```ts title="agent/connections/notion.ts"
import { defineOpenAPIConnection } from "eve/connections";

export default defineOpenAPIConnection({
  spec: "https://developers.notion.com/openapi.json",
  baseUrl: "https://api.notion.com",
  description: "Notion pages, databases, comments, and users.",
  headers: {
    Authorization: `Bearer ${process.env.NOTION_API_KEY!}`,
    "Notion-Version": "2022-06-28",
  },
});
```

`auth` 和 `headers` 也可以写成函数，并接收当前 session context。适合凭据、租户或 API 环境依赖当前调用者的场景。

## Operation filters

大多数 OpenAPI spec 都比模型真正需要的范围更大。建议用 `operations.allow` 或 `operations.block` 缩小模型可见 operation。

二者只能选一个。

```ts title="agent/connections/petstore.ts"
import { defineOpenAPIConnection } from "eve/connections";

export default defineOpenAPIConnection({
  spec: "https://petstore3.swagger.io/api/v3/openapi.json",
  description: "Pet store inventory and orders.",
  auth: { getToken: async () => ({ token: process.env.PETSTORE_TOKEN! }) },
  operations: { allow: ["getInventory", "placeOrder"] },
});
```

过滤器匹配 `operationId`。如果 operation 没有声明 `operationId`，就使用 Eve 根据 method 和 path 派生出的确定性名称。

生产环境优先使用 `allow`，只放出 Agent 必须使用的 operation。

## Path parameters

如果 operation path 包含动态片段，spec 必须声明匹配的 OpenAPI path parameter。

Eve 会把 path、query、header、cookie 参数暴露成工具顶层输入，然后把 `in: "path"` 的值替换进对应的 `{name}` 占位符。

```ts title="agent/connections/cart.ts"
import { defineOpenAPIConnection } from "eve/connections";

export default defineOpenAPIConnection({
  baseUrl: "https://api.example.com",
  description: "Cart and checkout API.",
  spec: {
    openapi: "3.0.3",
    info: { title: "Cart API", version: "1.0.0" },
    paths: {
      "/api/{cartId}/items/{itemId}": {
        get: {
          operationId: "getCartItem",
          parameters: [
            {
              name: "cartId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "itemId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
    },
  },
});
```

`parameter.name` 必须和 path 里的 `{name}` 完全一致。如果 spec 漏掉了 `in: "path"` 参数，生成的工具就没有输入可以填充这段 path，Eve 也不能从 query 参数里猜出来。

## 审批 gates

OpenAPI 生成的 operation tools 和手写工具一样，可能会修改状态。只要 operation 能创建、修改、删除、发送消息、传输数据、购买或访问敏感数据，就应该加 approval：

```ts title="agent/connections/crm.ts"
import { defineOpenAPIConnection } from "eve/connections";
import { once } from "eve/tools/approval";

export default defineOpenAPIConnection({
  spec: "https://api.example.com/openapi.json",
  baseUrl: "https://api.example.com",
  description: "CRM accounts, contacts, and opportunities.",
  auth: { getToken: async () => ({ token: process.env.CRM_TOKEN! }) },
  approval: once(),
});
```

建议把 `approval` 和 `operations.allow` 结合起来，形成最小可用工具面。

## 适合 OpenAPI connection 的场景

- 你的内部服务已经有 OpenAPI 文档。
- 希望模型能调用一小组经过过滤的 REST API。
- 希望基于现有 API 契约自动生成工具输入 schema。
- 不想为每个 HTTP endpoint 手写 tool。

## 不适合的场景

- 远端服务已经有 MCP Server，并且 MCP 工具语义更完整。
- 需要复杂多步骤协议，而不是单次 HTTP operation。
- OpenAPI spec 过于宽泛、混乱或缺少安全边界，无法直接暴露给模型。

## 接下来读什么

- [连接概览](./overview)：共享鉴权、headers、approval 和按调用者解析的模式。
- [MCP connections](./mcp)：连接远程 MCP Server。
- [鉴权与路由保护](../guides/auth-and-route-protection)：route auth 与交互式 OAuth 生命周期。
- [安全模型](../concepts/security-model)：connection 凭据如何避免暴露给模型。
