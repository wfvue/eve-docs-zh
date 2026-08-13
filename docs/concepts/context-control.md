---
title: "上下文控制（Context Control）"
description: "控制 eve Agent 的模型看到什么、何时看到：instructions、skills、workspace 与子智能体。"
---

# 上下文控制（Context Control）

eve 给你几个控制模型看到什么、何时看到的杠杆。`instructions.md`（或 `instructions.ts`）始终开启，`skills/` 可用但按需加载，workspace 和 sandbox 通过工具可见，而不是粘贴进 prompt。

## 用 `instructions.md` 做基础身份

用 `instructions.md` 承载 Agent 的核心契约。

```md
You are a careful support assistant. Be concise, verify facts before replying, and explain when you
used a tool.
```

让这个文件聚焦于每个 turn 都该生效的稳定行为。

## 用 `instructions.ts` 组合 instructions

要从类型化 helpers、lib code 或环境派生值构建 instructions prompt，把它写成模块而不是 markdown。

```ts title="agent/instructions.ts"
import { defineInstructions } from "eve/instructions";
import { buildInstructionsPrompt } from "./lib/prompts";

export default defineInstructions({
  markdown: buildInstructionsPrompt(),
});
```

模块支撑的 instructions 在构建时运行一次。eve 把生成的 markdown 捕获进编译后的 manifest，所以 runtime 每个 session 都服务同一个 prompt，不会重新运行模块。

## 用 `skills/` 按需加载流程

Skills 默认不进入常驻 prompt，这让丰富的流程可用而不会膨胀每个 turn。eve 会宣传可用的 skills，并添加一个框架自有的 `load_skill` 工具。当请求明显匹配某个 skill 描述，或用户显式点名某个 skill 时，模型激活该 skill，eve 把 skill 的 markdown 追加到活跃 instructions 中，供后续 turn 工作使用。

### 扁平 skill

```md title="agent/skills/get-weather.md"
Use the weather tool before answering forecast or temperature questions.
```

### 打包 skill

```md title="agent/skills/research/SKILL.md"
---
description: Research unfamiliar topics before answering with confidence.
---
When the task is novel or ambiguous, gather evidence first, then answer with the key facts and the
remaining uncertainty.
```

当你想在同一 skill 目录下放 `references/`、`assets/` 或 `scripts/` 等兄弟文件时，打包 skill 很有用。这些文件在 runtime skill root 下可用，通常是 `$HOME/.agents/skills/<skill>/`。`SKILL.md` 内的相对引用从那个特定 skill 目录解析，所以 `references/checklist.md` 指的是 `$HOME/.agents/skills/<skill>/references/checklist.md`，除非 eve 回退到了 `/workspace/skills/<skill>/`。

完整的编写模型和安装说明见 [Skills](../skills)。

## 把运行时文件放进 workspace，而不是 prompt

eve 不会把整个 authored surface 内联进 prompt。相反，它给模型一个浅 workspace 提示、一个单独的 skill-root 提示，以及按需深入检查的 runtime 工具。Skill 包文件在正常情况下位于 `/workspace` 之外，模型用共享的 `bash` 工具检查它们，这让 prompt 更小，也让文件和命令工作显式化。

workspace 和 sandbox 模型见 [Sandbox](../sandbox)。

## 用子智能体委派给专家

如果任务值得拥有自己的 prompt 和工具表面，用本地子智能体而不是让根 Agent 过载。子智能体也是上下文控制的杠杆。它们有自己的 `instructions.md`、工具和 sandbox，并运行在自己被委派的上下文里，而不是内联扩展根 Agent。

见 [子智能体（Subagents）](../subagents)。

## 用 `defineDynamic` 做动态上下文

上面的杠杆是静态的：一次编写，每个 session 都一样。当正确的上下文取决于调用者是谁（他们的团队、租户、套餐或 feature flags）时，改为在运行时解析。`agent/instructions/` 中的 `defineDynamic` 返回每个 session 的 system prompt，`agent/skills/` 中的 `defineDynamic` 返回调用者可以加载的 skill 集合。两者都读取 `ctx.session.auth` 或 channel metadata，所以 billing 团队的调用者得到 billing 的 instructions 和 playbook，而其他人看不到。Resolver API 和每个事件何时触发见 [动态能力（Dynamic capabilities）](../guides/dynamic-capabilities)。

## 推荐的上下文布局

按上下文的用途选择杠杆：

- `instructions.md` 承载 Agent 的永久身份。保持简短和稳定。
- `instructions.ts` 用于需要在构建时从类型化 helpers 组合 prompt。
- `skills/` 承载应该只在需要时加载的可选流程。把长流程移到这里，而不是移进常驻 prompt。
- `tools/` 暴露类型化集成。
- 当任务需要不同的专家表面时用子智能体；只在真正的专业化边界使用它。
- 当模型应该检查文件或运行命令，而不是依赖粘贴的 instructions 时，用 workspace 或 sandbox。

## 接下来读什么（What to read next）

- [工具（Tools）](../tools)：暴露模型可以调用的类型化集成。
- [技能（Skills）](../skills)：按需流程的完整编写模型。
- [子智能体（Subagents）](../subagents)：把任务委派给拥有自己 prompt 和工具的专家。
- [动态能力（Dynamic capabilities）](../guides/dynamic-capabilities)：用 `defineDynamic` 解析每个 session 的 instructions 和 skills。
- [钩子（Hooks）](../guides/hooks)：在 session 事件上运行代码，更新动态 resolvers 读取的 channel state。
