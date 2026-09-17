---
title: "前端概览（Overview）"
description: "使用 useEveAgent 把 Eve Agent 接到浏览器聊天 UI 或 Agent UI。"
---

# 前端概览（Overview）

已有浏览器应用、需要接到 eve Agent 时看本页。`useEveAgent()` 打开 durable session、发送 turns、流式接收回复，并把原始 event stream 转成可渲染状态。React 是参考实现；[Vue](./use-eve-agent-vue) 与 [Svelte](./use-eve-agent-svelte) 提供同一表面。官方原文：[Frontend Overview](https://eve.dev/docs/guides/frontend/overview)。前后端是对等服务还是框架集成，见[项目结构](../../concepts/project-structure#configure-a-web-deployment)。

## 返回状态要点

大多数聊天 UI 只需要 `data.messages` 和 `status`。

`resume: true` 配合 `initialSession` 时，mount 后会从 durable stream 重建投影。`status === "resuming"` 期间可渲染已 hydrate 的 `data`，但应禁用发消息与 HITL；不要展示取消或进行中 turn 的进度控件。要用 follow-up **steer** 活跃 turn 时，用 `turnPolicy: "steer"` 发送：答案输出或本地工具执行开始前，eve 会打断待进行的模型生成并在同一 turn 继续校正；正在执行的 tools 先收尾并 checkpoint；答案开始后等到下一已提交的 Workflow 边界。推理与搜索进度不算答案输出。hook 在完成前保持挂接（`await agent.send(message, { turnPolicy: "steer" })`）。catch-up 发现进行中 turn 会先变 `"streaming"` 再跟到边界；**已结算的尾部会在有界 catch-up 检查后直接变 `"ready"`，不必等 live stream 空闲超时**——若检查发现刚开始的 turn 或 pending authorization，eve 会继续跟随。终态 session 失败变 `"error"`。

`data.messages` 是 Eve 拥有的消息投影。根 Agent 委派时，其 stream 会发出带 `childSessionId` 的 `subagent.called`，admit 后发出携带 working 任务回执的 `subagent.completed`；后续更新与最终结果经 task notifications 唤醒父级。详细子级进度在 child session 的 stream 上，不会压平进根 `data.messages`。需要 live 子级活动时，用底层 [Client SDK](../client/overview) attach 该 ID。完整契约见 [父级看到什么](../../subagents#父级看到什么)。

## 接下来读什么

- [Sessions, runs & streaming](../../concepts/sessions-runs-and-streaming)
- [子智能体](../../subagents)
- [Client SDK](../client/overview)
- [Next.js](./nextjs)
