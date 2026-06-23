# Eve 中文文档与工程实践指南

本项目是 [Vercel Eve](https://github.com/vercel/eve) / [eve.dev](https://eve.dev) 文档的中文学习、翻译与工程实践补充项目。

Eve 是 Vercel 推出的 filesystem-first durable AI agents 框架。它围绕 `agent/` 目录组织 `instructions`、`tools`、`skills`、`subagents`、`channels`、`schedules` 等能力，并结合 AI SDK、Workflow SDK、Sandbox 和 Nitro，提供可部署、可恢复、可观测的 Agent Runtime。

## 项目目标

1. 用中文解释 eve.dev/docs 的核心概念。
2. 对官方文档做学习型翻译和工程化补充，而不是机械直译。
3. 补充本地部署、自托管、Hono、Vite SPA、Workflow SDK、DeepSeek provider 等实践。
4. 记录真实项目接入经验，尤其是 `SPA + Hono API + Eve Agent` 的架构。
5. 为中文开发者提供可运行示例、常见问题和迁移建议。

## 推荐阅读路线

1. [文档首页](docs/index.md)
2. [filesystem-first 是什么](docs/core-concepts/filesystem-first.md)
3. [Workflow SDK 原理](docs/core-concepts/workflow-sdk.md)
4. [Sandbox 是什么](docs/core-concepts/sandbox.md)
5. [自部署指南](docs/deployment/self-hosting.md)
6. [鉴权与路由保护](docs/guides/auth-and-route-protection.md)
7. [术语表](docs/glossary.md)

## 文档原则

- 不只直译，要解释“为什么这样设计”。
- 每篇文档尽量包含：官方原意、白话解释、代码示例、本地部署建议。
- 明确区分：官方能力、推断建议、项目实践。
- 保留官方文档链接和来源说明。
- Eve 仍处于 beta，内容需要持续跟随上游变化。

## 免责声明

本项目不是 Vercel 官方中文文档。准确 API、参数、限制和最新行为，请以 [eve.dev](https://eve.dev) 和 [vercel/eve](https://github.com/vercel/eve) 官方仓库为准。

## License

本项目中的原创中文解释、示例和补充内容采用 Apache-2.0 许可证发布。官方 Eve 文档和代码版权归 Vercel / 原作者所有，请以官方仓库许可证和说明为准。
