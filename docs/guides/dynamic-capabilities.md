---
title: "动态能力（Dynamic Capabilities）"
description: "使用 defineDynamic 在运行时解析 models、subagents、connections、tools、skills 和 instructions。"
---

# 动态能力（Dynamic Capabilities）

`defineDynamic` 会基于 session event 在运行时解析 model、subagents、connections、tools、skills 和 instructions。官方原文：[Dynamic Capabilities](https://eve.dev/docs/guides/dynamic-capabilities)。

动态 model 必须返回具体模型；动态 connections / tools / skills / instructions / subagents 可返回 `null` 省略能力。

解析后的集合适用于本地与远程的直接委派。后台子智能体不会暴露在模型编写的 `Workflow` 工具内部；durable 编排见 [Durable Tools](../../tools/workflows)。eve 在启动子级前还会再检查可用性，过期或手工构造的调用会以 `SUBAGENT_UNAVAILABLE` 失败。把条件可用性当作能力组合，而不是唯一授权边界。

## 动态连接 / 工具 / 技能 / 指令

编写形态、命名冲突、事件与恢复语义见官方页与既有中文分节。带鉴权的动态连接必须设稳定非密钥的 `instanceKey`。

## 接下来读什么

- [子智能体](../../subagents)
- [Durable Tools](../../tools/workflows)
- [内置工具](../../concepts/built-in-tools)
- [记忆（Memory）](../../memory)
