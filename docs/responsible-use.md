---
title: "负责任使用（Responsible Use）"
description: "在把 eve 用于敏感、受监管或生产数据之前，部署者需要审查的责任与防护。"
---

# 负责任使用（Responsible Use）

作为部署者，你有责任确保 Agent 符合适用法律。

你需要为自己的场景配置合适的审批策略、工具限制、connection scopes、路由/session 鉴权、sandbox 控制、遥测导出，以及其他防护措施。

在把 eve 用于非公开、敏感、受监管或生产数据之前，请审查 Agent 当前可用的默认工具、自定义工具、MCP 工具、shell/文件/web 工具、已连接服务、子智能体、定时任务和外部动作。

对敏感、不可逆、受监管、金融、医疗、雇佣、住房、法律、安全相关、影响用户或会产生外部副作用的动作，要求人工审批或其他防护。

除非你配置了更严格的控制，eve Agent 可能以较宽松的默认值运行，包括：省略 `approval` 时工具可以不经人工审批就执行，以及 sandbox 网络出口并非默认 deny-all。不要只依赖模型行为来阻止敏感或不可逆动作。

官方原文：[Responsible Use](https://eve.dev/docs/responsible-use)。相关页面：[安全模型（Security Model）](./concepts/security-model)、[人在环中（Human-in-the-loop）](./tools/human-in-the-loop)、[内置工具（Built-in Tools）](./concepts/built-in-tools)。
