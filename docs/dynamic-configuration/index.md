---
title: "动态能力（Dynamic Capabilities）"
description: "官方侧栏分组：运行时解析能力，以及按请求自动选择模型。"
---

# 动态能力（Dynamic Capabilities）

官方原文：[Dynamic Capabilities](https://eve.dev/docs/guides/dynamic-capabilities)、[Automatic Model Selection](https://eve.dev/docs/guides/evaluate)。

本目录是官方侧栏分组，正文仍放在 `docs/guides/`：

- [动态能力](../guides/dynamic-capabilities)：用 `defineDynamic` 按 session / turn / step 解析 model、tools、connections、skills、instructions 和子智能体。
- [自动模型选择](../guides/evaluate)：`eve/models` 的 `auto` 按请求从候选名单里选模型；`eve/ai` 的 `evaluate` 在工具或应用代码里做类型化评判。

**怎么选：** 能力对所有调用方都一样时，继续用静态文件。按租户、套餐、渠道切换时用 `defineDynamic`。只想按当前消息难度换模型时，优先 `auto`，不必手写路由。
