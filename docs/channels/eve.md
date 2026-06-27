# Eve HTTP Channel

Eve 内置 HTTP channel。每个 eve 应用都会提供稳定的 HTTP API，用来创建 session、读取 stream、发送 follow-up message，以及处理等待中的输入。

## 核心用途

- 给 Web 前端或脚本提供统一入口。
- 在本地、预览和生产环境用同一套 API 做验证。
- 把 session id、continuation token 和 stream 事件交给客户端处理。

## 工程建议

正式暴露 HTTP channel 时，需要在外层做好鉴权、租户隔离、速率限制和日志审计。
