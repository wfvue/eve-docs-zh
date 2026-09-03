---
title: "前端概览（Overview）"
description: "使用 useEveAgent 把 Eve Agent 接到浏览器聊天 UI 或 Agent UI。"
---

# 前端概览（Overview）

Frontend helpers 会把浏览器 chat UI 或 Agent UI 放在 Eve Agent 之上。`useEveAgent()` 打开 durable session、发送 turns、流式接收回复，并把原始 event stream 转成可渲染状态。官方原文：[Frontend Overview](https://eve.dev/docs/guides/frontend/overview)。

## 返回状态要点

大多数聊天 UI 只需要 `data.messages` 和 `status`。

`data.messages` 是 Eve 拥有的消息投影。根 Agent 委派时，其 stream 会发出带 `childSessionId` 的 `subagent.called`，admit 后发出携带 working 任务回执的 `subagent.completed`；后续更新与最终结果经 task notifications 唤醒父级。详细子级进度在 child session 的 stream 上，不会压平进根 `data.messages`。需要 live 子级活动时，用底层 [Client SDK](../client/overview) attach 该 ID。完整契约见 [父级看到什么](../../subagents#父级看到什么)。

## 接下来读什么

- [Sessions, runs & streaming](../../concepts/sessions-runs-and-streaming)
- [子智能体](../../subagents)
- [Client SDK](../client/overview)
- [Next.js](./nextjs)
