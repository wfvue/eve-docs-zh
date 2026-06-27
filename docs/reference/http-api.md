# HTTP API

这一页对应官方 HTTP API reference。它记录 eve 应用暴露的稳定 HTTP 接口。

## 常见接口

- 创建 session。
- 订阅 session stream。
- 发送 follow-up message。
- 回答等待中的输入请求。

正式集成时，建议在 API 外层增加鉴权、限流、日志和错误处理。
