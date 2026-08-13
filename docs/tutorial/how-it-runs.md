---
title: "它如何运行（How It Runs）"
description: "Build an Agent 教程第 2 步：session、turn 和 durable steps，以及 turn 为什么能扛过崩溃。"
---

# 它如何运行（How It Runs）

分析助手发了一条消息、得到一条回答。三个术语描述背后的模型。

| 术语 | 含义 |
| --- | --- |
| **session** | 你的整个对话（durable，可以跨数天）。 |
| **turn** | 你发送的一条消息和它触发的工作。 |
| **step** | turn 内的一个 durable checkpoint。 |

每个 turn 都作为 durable workflow 运行，eve 在每个 step 保存进度。已完成的 step 从不重跑；eve 重放记录的结果。中途被打断的 step 会重跑，所以要让扣费、邮件等非幂等副作用幂等，或用审批门禁。一个在等你的 turn（审批、提问）无论你多晚回答都会恢复。

这就是本教程其余特性如此工作的原因：

- 第 4 步的仓库登录让 turn park，直到你在浏览器里授权。几分钟没问题。
- 第 6 步的指标术语表跨 turn 存活。State 在 step boundaries 打点，所以它粘得住。
- 第 8 步的支出审批把你的 yes/no 暂停 turn，然后从它离开的确切位置继续。

你编写能力，包括 tools、instructions、channels 和 skills。eve 驱动模型到工具的循环，并决定 turn 何时继续、等待或结束。你从不自己写那个循环。

→ 下一步：[第 3 步：查询示例数据（Query sample data）](./query-sample-data)
深入阅读：[执行模型与持久性（Execution model & durability）](../concepts/execution-model-and-durability)
