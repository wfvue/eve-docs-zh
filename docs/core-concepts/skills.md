---
title: "技能（Skills）"
description: "编写按需加载的流程文档，让模型通过 load_skill 拉入上下文。"
---

# 技能（Skills）

技能（Skill）是一种模型可加载的流程，遵循 `SKILL.md` 约定。它是一个 Markdown 文档，可选地是带支持文件的打包目录，模型按需把它拉进上下文，而不是每个 turn 都携带。eve 宣传每个技能的 description，模型只在某个 turn 需要时才加载完整 body。这是渐进式披露（progressive disclosure），与更广泛的 Agent Skills 标准使用同一个模型，所以针对该标准编写的技能可以直接移植。

## 加载如何工作

eve 扫描 `agent/skills/` 下的文件，并把每个技能的 description 连同框架自有的 `load_skill` 工具一起暴露给模型。当请求匹配某个技能的 description（或你直接点名该技能）时，模型调用 `load_skill`，eve 把该技能的 markdown 追加到当前 turn 的上下文。

静态技能不需要 sandbox：`load_skill` 直接从编译后的 agent 返回它们的 instructions。动态技能和访问支持包文件需要 sandbox。构建也可以预热包含静态包文件的 sandbox 模板。支持文件在 `$HOME/.agents/skills/<skill>/` 下可用，`$HOME` 不可用时 `/workspace/skills/<skill>/` 作为回退。`SKILL.md` 内的兄弟引用（如 `references/checklist.md`）相对包含那个特定 `SKILL.md` 的目录解析。

Description 是路由提示，不是标签。把它写成应该触发激活的任务：

```md
Use when the user needs a release checklist or changelog workflow.
```

加载技能只会增加 instructions，绝不会增加新的执行面。无论技能是否加载，工具都保持可见。需要类型化运行时行为时，请使用 [tool](./tools)。

## Markdown vs `defineSkill`

最小的技能是扁平 markdown 文件。内容是流程，名字来自路径。

```md title="agent/skills/forecast.md"
Use the weather tool before answering forecast or temperature questions.
```

扁平 markdown 技能可以省略 `description` frontmatter。省略时，eve 宣传 body 的第一条非空、非代码围栏行，剥离任何前导 `#`、`>`、`*` 或 `-` 标记。如果 body 没有这样的行，eve 回退到字面 `Instructions for the <name> skill.`，这是一个很弱的路由提示，所以当你希望模型按意图路由时，添加 `description`。

打包技能是带 `SKILL.md` 的目录，外加 `references/`、`assets/` 和 `scripts/` 等兄弟文件。打包的 `SKILL.md` 必须携带 `description` frontmatter；它没有文件名 slug 可以回退。

```md title="agent/skills/research/SKILL.md"
---
description: Research unfamiliar topics before answering with confidence.
---
When the task is novel or ambiguous, gather evidence first, then answer with the
key facts and the remaining uncertainty.
```

eve 读取 `description`、可选的 `license` 和字符串 `metadata`；其他 `SKILL.md` frontmatter 会被接受为 no-op。

当 markdown 无法表达你需要的（类型化值、生成内容或内联兄弟文件）时，用 `eve/skills` 的 `defineSkill` 以 TypeScript 编写技能：

```ts title="agent/skills/research.ts"
import { defineSkill } from "eve/skills";

export default defineSkill({
  description: "Research unfamiliar topics before answering with confidence.",
  markdown:
    "When the task is novel or ambiguous, gather evidence first, then answer with the key facts and the remaining uncertainty.",
  files: {
    "references/checklist.md": "# Checklist\n\n- Find primary sources.\n",
  },
});
```

eve 从 `markdown` 生成 `SKILL.md`，每个 `files` 条目变成包相对兄弟文件。从纯 markdown 开始，只在触到它的极限时才转向 `defineSkill`。

## 查找和安装社区技能

`eve registry search` 把 [skills.sh](https://skills.sh) 作为内置 `@skills` source。按任务搜索、审查 source，然后把返回的技能安装进你的项目：

```sh
eve registry search react --registry @skills
eve add @skills/vercel-labs/agent-skills/vercel-react-best-practices
```

skills.sh 技能是社区编写的项目文件。运行 Agent 前审查它们的 source 和产生的 diff。Registry 配置和安装行为见 [Install integrations](./install-integrations#add-a-skill)。

## 技能按 Agent 作用域隔离

技能作用域到声明它的 Agent。子智能体的 `skills/` 对根 Agent 不可见，反之亦然。要跨 Agent 共享一个技能定义，把它打包进 [workspace extension](./extensions#use-an-extension-in-a-workspace)，并在每个 Agent 挂载那个 extension。共享可执行 helpers 放在 `lib/`。

## 运行时读取技能文件

加载技能只把它的 `SKILL.md` 加进上下文。要从工具或 hook 内部触达打包技能的兄弟文件（references、assets、scripts），用 `ctx.getSkill(id)`：

```ts
const research = ctx.getSkill("research");
const checklist = await research.file("references/checklist.md").text();
```

Handle 暴露技能的 `name` 和 `file(relativePath)`；文件内容从活跃 sandbox 惰性读取，相对该技能包目录。

## 动态技能

要为每个 principal、租户或渠道服务不同技能（比如调用者自己的团队手册），把 `defineSkill` 包进键控 `ctx.session.auth` 的 `defineDynamic` resolver。见 [动态能力（Dynamic capabilities）](./guides/dynamic-capabilities)。

## 接下来读什么（What to read next）

- [连接（Connections）](./connections)：从外部 MCP 和 OpenAPI servers 添加工具
- [动态能力（Dynamic capabilities）](./guides/dynamic-capabilities)：用 `defineDynamic` 按调用者解析技能
- [上下文控制（Context control）](./concepts/context-control)：技能如何适配完整上下文模型
