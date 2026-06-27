# Multi-tenant memory

这一页对应官方 Multi-tenant memory pattern。它说明多租户场景下如何隔离记忆和上下文。

## 要点

- 记忆必须按租户和主体隔离。
- 不同租户的数据不能混入同一上下文。
- 工具和后端服务都要校验租户边界。
