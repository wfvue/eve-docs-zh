---
title: "Instructions"
description: "使用 instructions.md 或 instructions.ts 编写 Agent 的常驻系统提示词。"
---

# Instructions：常驻指令

Instructions 是 Agent 的常驻系统提示词。它们是 Agent 的永久身份，而不是在某个时刻才按需拉取的流程。凡是每一轮都应该成立的内容，例如规则、人格或约束，都适合写在 instructions 里。eve 会把 instructions 放在 session 中每一次模型调用的前面。

## 编写 instructions

最小形式下，instructions 是 Agent 根目录里的一个 Markdown 文件。你写进去的内容就是 prompt：

```md title="agent/instructions.md"
You are a concise assistant. Use tools when they are available.
```

这个文件应该用于稳定行为，例如身份、语气和长期规则。

## Markdown 和 TypeScript

静态 prompt 适合写在 Markdown 中，也就是 `agent/instructions.md`。当你需要从类型化 helper、`lib/` 代码或构建时变量里生成 prompt 时，再切换到 TypeScript module，也就是 `agent/instructions.ts`。

```ts title="agent/instructions.ts"
import { defineInstructions } from "eve/instructions";
import { buildInstructionsPrompt } from "./lib/prompts.js";

export default defineInstructions({
  markdown: buildInstructionsPrompt(),
});
```

`defineInstructions` 接收一个字段：`markdown`，也就是最终解析出的 prompt 文本。由 module 支撑的 prompt 会在构建时运行一次。eve 会把得到的 Markdown 捕获进已编译 manifest，所以运行时每个 session 都会使用同一份 prompt，不会重新执行这个 module。

## 把 instructions 拆成一个目录

如果有多个文件，可以添加 `agent/instructions/` 目录。eve 会非递归读取其中的条目，支持 `.md` 文件和 `.ts` module。`.ts` 文件可以包装 `defineInstructions` 或 `defineDynamic`。这些条目会按文件名的字母顺序，也就是 `localeCompare` 的结果，组合起来。

Agent 根目录下的扁平文件 `agent/instructions.md` 或 `agent/instructions.ts` 可以和这个目录共存。根文件内容会排在前面，然后再接上目录内排序后的条目。但不能同时在根目录编写 `instructions.md` 和 `instructions.ts`，这会导致构建错误。

## Instructions 和 skills 的区别

Instructions 和 [skills](./skills) 都会把文本喂给模型上下文。区别在于加载时机：

| 位置 | 何时加载 | 适合用于 |
| --- | --- | --- |
| `instructions.md` / `.ts` | 永远开启，每一轮都加载 | 永久身份和长期规则 |
| `agent/skills/*` | 按需加载，当模型调用 `load_skill` 时进入上下文 | 不应该膨胀每一轮上下文的可选流程 |

保持 instructions 短小、稳定。长流程或场景化流程应该放到 [skills](./skills) 中，只有在请求需要时才进入上下文。

Instructions 不会运行代码。需要类型化的可执行行为时，应该使用 [tool](./tools)。

## Dynamic instructions

如果需要在运行时根据 session context（例如鉴权、租户或 channel）解析 prompt，可以把 `defineInstructions` 包在 `defineDynamic` resolver 里。见 [Dynamic capabilities](./guides/dynamic-capabilities)。

## 免责声明

作为部署者，你有责任确保自己的 Agent 遵守适用法律。

当 eve agent 与人交流时，某些法律可能要求你披露对方正在和自动化 AI 系统交互。eve 不会自动添加这类披露；你需要在 instructions 和/或 channel responses 中配置。

## 接下来读什么

- [Tools](./tools)：类型化动作，也是下一步要添加的能力。
- [Context control](./concepts/context-control)：控制模型能看到什么的全部手段。
- [Skills](./skills)：按需加载的流程，是常驻 instructions 的对应能力。
