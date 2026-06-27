---
title: "技能（Skills）"
description: "编写按需加载的流程文档，让模型通过 load_skill 拉入上下文。"
---

# 技能（Skills）：按需加载的流程

技能（Skill）是一种可被模型按需加载的流程说明，遵循 `SKILL.md` 约定。它本质上是 Markdown 文档，也可以是一个带有参考资料、脚本或资源文件的目录包。和 instructions 不同，技能不会每轮都进入上下文，而是等模型判断有用时再通过 `load_skill` 加载。

## 加载机制

eve 会扫描 `agent/skills/` 下的文件，并把每个技能的 description 作为路由提示暴露给模型。请求匹配到某个技能时，模型调用框架内置的 `load_skill`，eve 再把该技能的 Markdown 追加到当前 turn 的上下文中。

Description 不是标签，而是触发条件。推荐写成：

```md
Use when the user needs a release checklist or changelog workflow.
```

加载技能只会增加说明文字，不会增加新的执行能力。真正的可执行动作仍然应该写成 [tool](./tools)。

## Markdown 和 defineSkill

最小技能是一个普通 Markdown 文件：

```md title="agent/skills/forecast.md"
Use the weather tool before answering forecast or temperature questions.
```

打包形式则是目录加 `SKILL.md`：

```text
agent/skills/research/
├── SKILL.md
├── references/
└── scripts/
```

当需要类型化生成内容或内联附带文件时，可以使用 `defineSkill`：

```ts
import { defineSkill } from "eve/skills";

export default defineSkill({
  description: "Research unfamiliar topics before answering with confidence.",
  markdown: "Gather evidence first, then answer with facts and uncertainty.",
});
```

## 作用域

技能按 Agent 作用域隔离。Root Agent 的 `skills/` 对 subagent 不可见，subagent 的技能也不会自动暴露给 root。共享的可执行 helper 应该放在 `lib/` 中。

## 什么时候用技能

当内容是长流程、专项操作手册、模板或临时知识，并且不应该每轮都占上下文时，用技能。短小、永久、每轮都必须遵守的规则，放在 instructions 中。
