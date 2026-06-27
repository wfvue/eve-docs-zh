# Execution model and durability

这一页对应官方 Execution model and durability 文档，说明 eve 如何运行一次 Agent 工作，以及为什么 session 可以持久、恢复和抗崩溃。

## 要点

- 每轮会话由 durable runtime 管理。
- 工具结果会被记录，恢复时不会重复已完成步骤。
- 中断中的步骤可能重跑，因此副作用需要幂等或审批。
