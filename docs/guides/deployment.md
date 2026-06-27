# Deployment：部署

这一页对应官方 Deployment guide。它说明如何把 eve app 从本地开发带到可运行的部署环境。

## 要点

- 本地用 `eve dev` 验证。
- 构建时把 Agent 编译成运行产物。
- 生产环境需要准备模型凭据、存储、网络和 channel 配置。
- 部署后用 HTTP API 或 CLI 做冒烟测试。

## 工程建议

自托管时要确认 durable session 依赖的 Workflow world、数据库、日志和定时任务 runner 都已经配置好。
