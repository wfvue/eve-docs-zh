---
title: "动态能力（Dynamic Capabilities）"
description: "使用 defineDynamic 在运行时解析 models、subagents、connections、tools、skills 和 instructions。"
---

# 动态能力（Dynamic Capabilities）

`defineDynamic` 会基于 session event 在运行时解析 model、subagents、connections、tools、skills 和 instructions。官方原文：[Dynamic Capabilities](https://eve.dev/docs/guides/dynamic-capabilities)。

动态 model 必须返回具体模型；动态 connections / tools / skills / instructions / subagents 可返回 `null` 省略能力。

解析后的集合适用于本地与远程的直接委派。后台子智能体不会暴露在模型编写的 `Workflow` 工具内部；durable 编排见 [Workflows as Tools](../../tools/workflows)。eve 在启动子级前还会再检查可用性，过期或手工构造的调用会以 `SUBAGENT_UNAVAILABLE` 失败。把条件可用性当作能力组合，而不是唯一授权边界。

## 动态连接 / 工具 / 技能 / 指令

编写形态、命名冲突、事件与恢复语义见官方页与既有中文分节。带鉴权的动态连接必须设稳定非密钥的 `instanceKey`。

eve 会为动态工具记录 durable descriptors：`execute`、审批请求/响应策略、**按输入作用域的 `approvalKey` 回调**，以及 `toModelOutput`，以便 parked call 在新进程里重建同一套回调。parked call 在其 session、生命周期作用域与 resolver 条目内绑定回调；另一 session 或作用域可以暴露同名工具而不替换该绑定。回调身份不依赖源码位置。编辑回调体但保持 resolver 条目与工具名不变是安全的；若 session 作用域回调在新进程/重部署后缺失实现，eve 会再跑一次 `session.started` resolvers 以重绑，然后重放。若所属 resolver 不再返回该工具，重放 fail-closed。

## 接下来读什么

- [子智能体](../../subagents)
- [Workflows as Tools](../../tools/workflows)
- [内置工具](../../concepts/built-in-tools)
- [记忆（Memory）](../../memory)
