---
title: "动态能力（Dynamic Capabilities）"
description: "使用 defineDynamic 在运行时解析 models、subagents、connections、tools、skills 和 instructions。"
---

# 动态能力（Dynamic Capabilities）

`defineDynamic` 会基于 session event，在运行时解析 model、subagents、connections、tools、skills 和 instructions，而不是在编译期全部写死。适合「会话开始前还不知道该挂哪套能力」的场景：取决于调用方身份、租户、feature flag，或外部数据。

官方原文：[Dynamic Capabilities](https://eve.dev/docs/guides/dynamic-capabilities)。相关静态形态见 [子智能体](../subagents)、[连接](../connections/overview)、[工具](../tools/overview)、[技能](../skills)、[指令](../instructions)。

> ⚠️ **Beta 提示：** Eve 仍处于 beta，动态能力（尤其是 durable callback / schema factory、重部署后的 rebind）语义可能随版本调整。上线前请对照官方页核对。

## 什么时候用

| 场景 | 更合适的做法 |
| --- | --- |
| 能力固定、所有调用方一样 | 静态 `defineAgent` / `defineTool` / 连接文件 |
| 按用户、租户、套餐、渠道切换能力 | `defineDynamic` + `session.started` / `turn.started` |
| 模型要随**当前消息内容**切换（如是否含图） | 动态 model + `step.started` |
| 只是观察事件、不注入能力 | [Hooks](./hooks)，不要硬塞进 dynamic |

## Authored 模块生命周期（先知道这点）

**官方说明：** eve 会在编译期评估一次动态定义模块，用于分类与校验，再把它保留为 runtime entry，以便事件 handler 可运行。因此模块顶层代码会在**编译期与运行期各跑一遍**。

**白话：** 不要把「读当前用户、拉租户配置、调数据库」写在文件顶层；放进 `events` handler 里。顶层只做稳定导入与纯常量。详见 [TypeScript API · Authored module lifecycle](../reference/typescript-api)。

---

## 动态模型（Dynamic models）

`agent.ts` 的 `model` 字段可以写成 `defineDynamic({ events })`。Resolver 可挂在 `session.started`、`turn.started`、`step.started`（优先级：**step > turn > session**）。

**官方说明：**

- 每个匹配到的 handler **必须**返回具体模型；缺失、非法或抛错会在依赖模型的工作开始前失败整轮 turn。
- 优先用 `session.started`。Prompt cache 按模型隔离，中途换模型会按未缓存价格重新吃进整段对话。
- 动态 model **不会**编译默认模型或模型元数据；首次选中时 eve 会规范化选择，并从 AI Gateway catalog 补齐省略的 context-window 元数据。
- 动态 connections / tools / skills / instructions / subagents 可以返回 `null` 省略能力；**动态 model 不行**。

完整契约见 [Agent 配置 · 动态选择模型](../agent-config)。

### 按图片输入切到视觉模型

消息内容决定模型时，用 `step.started`：纯文本走 GLM，用户历史含图则切 Gemini Flash。

```ts title="agent/agent.ts"
import { defineAgent, defineDynamic } from "eve";

export default defineAgent({
  model: defineDynamic({
    events: {
      "step.started": (_event, ctx) => {
        const hasImage = ctx.messages.some(
          (message) =>
            message.role === "user" &&
            Array.isArray(message.content) &&
            message.content.some(
              (part) =>
                part.type === "image" ||
                (part.type === "file" &&
                  (part.mediaType === "image" ||
                    part.mediaType.startsWith("image/"))),
            ),
        );

        return hasImage ? "google/gemini-3.5-flash" : "zai/glm-5.2";
      },
    },
  }),
});
```

`step.started` 之前，eve 会把带字节的 `file` part 落到 `/workspace/attachments`，但 `ctx.messages` 里仍保留 media type。图送到 provider 后：视觉模型能处理，非视觉模型会拒绝。**eve 不会自动改道**——要自己在 dynamic model 里路由。见 [Sandbox · Inbound attachments](../sandbox)。

**项目建议：** 默认挂在 `session.started`；只有「这一步消息里有没有图 / 有没有某类附件」这类 per-step 决策才用 `step.started`，以免频繁换模型打穿 prompt cache。

---

## 动态子智能体（Dynamic subagents）

当子智能体是否可用取决于调用方、租户、环境或 feature flag 时，用 `defineDynamic` 包住该子目录的 `agent.ts`：返回子配置即暴露，返回 `null` 则从父级模型可见工具中省略。

```ts title="agent/subagents/finance/agent.ts"
import { defineAgent, defineDynamic } from "eve";

export default defineDynamic({
  events: {
    "session.started": (_event, ctx) => {
      if (ctx.session.auth.current?.attributes.plan !== "enterprise") {
        return null;
      }

      return defineAgent({
        description: "Analyze financial and accounting data.",
        // 有父模型就跟父模型，否则回退
        model: ctx.model ? ctx.model.id : "openai/gpt-5.5-mini",
      });
    },
  },
});
```

### `ctx.model` 是父级 effective model

**官方说明（中文页长期保留的要点）：**

- 动态子智能体 resolver 拿到的 `ctx.model` 是父级当时的 **effective model**。
- 写法 `model: ctx.model ? ctx.model.id : "openai/gpt-5.5-mini"`：有父模型就跟父模型，否则回退。
- 返回的子配置会**快照** model ID；之后父模型再变，也不会自动改子级靶标。
- 本地返回的配置必须用**静态** model，不能再嵌一层 `defineDynamic` model；运行时选中的模型要用**字符串 model ID**。
- 构建 / Workflow-world 相关配置放在外层 `defineDynamic` 上；handler 结果里不能再选这些。

eve **始终**会编译子智能体的 filesystem 资源（instructions、tools、skills、connections、sandbox、嵌套子智能体），但不会给动态子智能体编译占位 agent config / placeholder model。Resolver 选中后，再把返回的 config 与这些资源合并，启动子 session。每次解析可以返回不同 model 或其他 runtime agent 设置。
