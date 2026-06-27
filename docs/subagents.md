---
title: "子智能体（Subagents）"
description: "把工作委派给子智能体：可以是当前 Agent 的副本，也可以是有独立目录的专门 Agent。"
---

# 子智能体（Subagents）

子智能体是由一个 Agent 委派出去、专门处理某个聚焦子任务的子级 Agent。它适合三类场景：

- 把一组互不依赖的小任务并行处理。
- 给子任务更窄的工具范围，降低主 Agent 的上下文和选择压力。
- 给某个专家角色独立身份、独立提示词和独立能力目录。

Eve 里有两种子智能体：内置的 `agent` 工具，以及声明式子智能体。

## 内置 agent 工具

每个 Eve Agent 默认都有一个内置 `agent` 工具。模型可以调用它，把一个子任务交给“当前 Agent 的副本”去完成。

这个副本有几个特点：

- 共享父 Agent 的工具和沙盒工作区。
- 子智能体写入的文件，父 Agent 可以马上看到。
- 子智能体不会继承父 Agent 的完整对话历史，而是从父 Agent 传入的 `message` 开始。
- 每个子智能体有新的运行状态。

内置 `agent` 工具适合简单并行：例如一次性拆出几个独立子问题，让多个副本分别处理，再由父 Agent 汇总。

调用形状可以理解为：

```ts
{
  message: string;
  outputSchema?: object;
}
```

`message` 里应该包含子智能体完成任务所需的全部上下文，因为它看不到父 Agent 的完整历史。

## 声明式子智能体

声明式子智能体放在：

```txt
agent/subagents/<id>/
```

它使用和根 Agent 相同的 `defineAgent`，但必须提供 `description`。父 Agent 会根据这个描述判断什么时候应该委派。

```ts title="agent/subagents/researcher/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({
  description: "Investigate ambiguous questions before the parent agent responds.",
  model: "anthropic/claude-opus-4.8",
});
```

一个最小声明式子智能体通常长这样：

```txt
agent/subagents/researcher/
├── agent.ts
├── instructions.md
├── tools/
├── skills/
├── sandbox/
└── subagents/
```

其中只有 `agent.ts` 是必须的，并且必须导出 `description`。其它目录按需添加。

## 隔离边界

声明式子智能体不会自动继承根 Agent 的 authored slots。也就是说，它有自己的：

| 能力位置 | 声明式子智能体的行为 |
| --- | --- |
| instructions | 使用自己的 `instructions.md` 或 `instructions.ts` |
| tools | 使用自己的 `tools/` |
| connections | 使用自己的 `connections/` |
| skills | 使用自己的 `skills/` |
| sandbox | 使用自己的 `sandbox/`，没有配置时回退到框架默认 |
| hooks | 使用自己的 `hooks/` |
| state | 使用新的状态 |
| channels | root-only，子智能体不单独声明 channel |
| schedules | root-only，子智能体不支持 schedules |

内置 `agent` 工具是例外：它是当前 Agent 的副本，因此共享父 Agent 的工具和沙盒。

## 父 Agent 能看到什么

无论是内置副本、声明式子智能体，还是远程 Agent，Eve 都会把它们降低成一个模型可见的工具。输入形状都是：

```ts
{
  message: string;
  outputSchema?: object;
}
```

声明式子智能体的工具名来自目录名。例如：

```txt
agent/subagents/researcher/
```

会注册成模型可见工具：

```txt
researcher
```

因此，子智能体目录名不能和已有工具名冲突。比如同时存在 `agent/tools/researcher.ts` 和 `agent/subagents/researcher/`，构建时就应该被拒绝。

## 什么时候应该拆子智能体

适合拆子智能体的情况：

- 子任务需要不同的角色设定或提示词。
- 子任务只应该看到更少的工具。
- 子任务需要自己的沙盒或运行上下文。
- 父 Agent 需要并行分派多个独立任务。
- 你希望把某类专家能力长期沉淀成独立 Agent。

不适合拆子智能体的情况：

- 只是一个按需流程说明，这时用[技能（Skills）](./skills)更轻量。
- 只是一个可执行动作，这时应该写成[工具（Tools）](./tools/overview)。
- 只是想减少 instructions 长度，这时优先考虑技能或重构提示词。

## 和技能、工具的区别

| 概念 | 解决什么问题 |
| --- | --- |
| instructions | 每轮都生效的身份和长期规则 |
| 技能（Skills） | 按需加载的流程说明 |
| 工具（Tools） | 真正执行动作的类型化函数 |
| 子智能体（Subagents） | 把聚焦任务委派给另一个 Agent 运行 |

简单说：

```txt
技能 = 让同一个 Agent 临时学会一套流程
工具 = 让 Agent 能执行一个动作
子智能体 = 让另一个 Agent 接手一个子任务
```

## 读取子智能体事件

每个被委派的子智能体都会启动自己的 child session 和 stream。父 Agent 的 stream 里通常只看到控制事件，例如：

```txt
subagent.called
subagent.completed
```

如果想查看子智能体的完整运行过程，需要拿到 `childSessionId`，再订阅对应 session 的 stream。

## 接下来读什么

- [技能（Skills）](./skills)：按需加载流程，适合比子智能体更轻量的场景。
- [工具（Tools）](./tools/overview)：定义真正可执行的动作。
- [Dynamic workflows](./guides/dynamic-workflows)：让 Agent 动态编排多步骤和多个子智能体。
- [Remote agents](./guides/remote-agents)：调用另一个部署中的 Eve Agent。
