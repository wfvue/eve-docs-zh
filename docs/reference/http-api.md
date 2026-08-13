---
title: "HTTP API"
description: "eve 应用暴露的稳定 HTTP 接口：session 路由、事件流与控制。"
---

# HTTP API

每个运行中的 eve 应用都会暴露自己的 HTTP API。官方将 HTTP API 参考合并进了 [eve HTTP channel](../channels/eve) 页面，那里覆盖了完整内容：路由、认证和定制。

这里列出快速入口：

- [eve HTTP channel](../channels/eve)：路由清单（`/eve/v1/health`、`/eve/v1/info`、`/eve/v1/session*`）、CORS 与认证
- [Sessions、Runs 与 Streaming](../concepts/sessions-runs-and-streaming)：事件流契约、重连与回卷、`meta.id` 信封
- [TypeScript SDK](../guides/client/overview)：从脚本和服务端调用这些路由的类型化客户端
- [TypeScript API](./typescript-api)：`eve/client` 等导入入口

正式集成时，建议在 API 外层增加鉴权、限流、日志和错误处理。参见 [安全模型](../concepts/security-model) 与 [鉴权与路由保护](../guides/auth-and-route-protection)。
