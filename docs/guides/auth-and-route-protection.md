# 鉴权与路由保护

## 一句话解释

Eve 的 Auth and Route Protection 讲的是：如何保护 `/eve/v1/session` 这些 Agent 接口，防止未授权用户创建、继续或读取 Agent 会话。

## 需要保护哪些路由

常见需要保护的 Eve 路由：

```txt
POST /eve/v1/session
POST /eve/v1/session/:sessionId
GET  /eve/v1/session/:sessionId/stream
```

`GET /eve/v1/health` 通常用于健康检查，可以保持公开。

## 为什么必须保护

如果不保护，别人可能：

- 创建 Agent 会话；
- 继续已有会话；
- 读取 stream 输出；
- 消耗你的模型额度；
- 诱导 Agent 调用工具；
- 尝试访问敏感业务能力。

## 配置位置

通常在：

```txt
agent/channels/eve.ts
```

配置 route auth：

```ts
import { eveChannel } from "eve/channels/eve";
import { localDev } from "eve/channels/auth";

export default eveChannel({
  auth: [localDev()],
});
```

## 开发环境

本地开发可以用 `localDev()`：

```ts
import { eveChannel } from "eve/channels/eve";
import { localDev } from "eve/channels/auth";

export default eveChannel({
  auth: [localDev()],
});
```

它只适合本地，不建议生产使用。

## 内网测试

内网早期可以使用 Basic Auth：

```ts
import { eveChannel } from "eve/channels/eve";
import { localDev, httpBasic } from "eve/channels/auth";

export default eveChannel({
  auth: [
    localDev(),
    httpBasic({
      username: "admin",
      password: process.env.ROUTE_AUTH_BASIC_PASSWORD!,
    }),
  ],
});
```

## 正式产品

正式产品建议接你自己的用户体系，例如：

- Hono API 的 session；
- JWT；
- OIDC；
- 自定义 AuthFn。

建议架构：

```txt
SPA 前端
  → Hono API 校验登录、workspace、thread 权限
  → Hono 代理或创建 Eve session
  → Eve 只接受受信任请求
```

这样可以避免浏览器直接裸调 Eve。

## Route Auth 不等于业务归属校验

这是最重要的坑。

Route Auth 只能证明请求者“通过了入口鉴权”。它不会自动知道：

```txt
这个 sessionId 是否属于当前用户？
这个 threadId 是否属于当前 workspace？
当前用户是否有权继续这个 Eve session？
```

这些必须由你自己的业务系统处理。

推荐存映射表：

```txt
threadId
workspaceId
userId
eveSessionId
continuationToken
status
lastEventIndex
```

每次继续会话或读取 stream 前，都要校验当前用户是否能访问对应 thread/workspace/session。

## continuationToken 要保密

`continuationToken` 是继续 Eve session 的凭证。它不是模型 API Key，但也不应该公开暴露或写入无保护日志。

## Tool Auth 和 Route Auth 的区别

Route Auth：

```txt
用户能不能访问你的 Eve Agent
```

Tool / Connection Auth：

```txt
Agent 调外部服务时，怎么代表用户访问那个服务
```

第一阶段如果你的工具都是内部工具，例如 `query_database`、`save_report`，可以先重点做好 route auth 和工具内部权限校验。

## 官方链接

- https://eve.dev/docs/guides/auth-and-route-protection
