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
| 按用户、租户、套餐、渠道切换 | `defineDynamic` + `session.started` / `turn.started` |
| 模型随**当前消息内容**切换（如是否含图） | 动态 model + `step.started` |
| 只观察事件、不注入能力 | [Hooks](./hooks) |

## Authored 模块生命周期

**官方说明：** eve 会在编译期评估一次动态定义模块（分类与校验），再保留为 runtime entry。顶层代码会在**编译期与运行期各跑一遍**。

**白话：** 不要把读用户 / 拉租户 / 调库写在文件顶层；放进 `events` handler。顶层只做稳定导入与纯常量。见 [TypeScript API](../reference/typescript-api)。

---

## 动态模型（Dynamic models）

`agent.ts` 的 `model` 可写成 `defineDynamic({ events })`。可挂 `session.started` / `turn.started` / `step.started`（优先级：**step > turn > session**）。

**官方说明：** 匹配到的 handler **必须**返回具体模型；缺失/非法/抛错会在依赖模型的工作开始前失败整轮 turn。优先 `session.started`（prompt cache 按模型隔离）。动态 model **不会**编译默认模型；首次选中时规范化并从 AI Gateway catalog 补齐 context-window 元数据。其它动态能力可返回 `null`；**动态 model 不行**。契约见 [Agent 配置](../agent-config)。

### 按图片切到视觉模型

用 `step.started`：纯文本走 GLM，历史含图则切 Gemini Flash。

```ts title="agent/agent.ts"
import { defineAgent, defineDynamic } from "eve";

export default defineAgent({
  model: defineDynamic({
    events: {
      "step.started": (_event, ctx) => {
        const hasImage = ctx.messages.some(
          (m) =>
            m.role === "user" &&
            Array.isArray(m.content) &&
            m.content.some(
              (p) =>
                p.type === "image" ||
                (p.type === "file" &&
                  (p.mediaType === "image" || p.mediaType.startsWith("image/"))),
            ),
        );
        return hasImage ? "google/gemini-3.5-flash" : "zai/glm-5.2";
      },
    },
  }),
});
```

`step.started` 前 eve 会把带字节的 `file` 落到 `/workspace/attachments`，但 `ctx.messages` 仍保留 media type。**eve 不会自动改道**。见 [Sandbox](../sandbox)。

**项目建议：** 默认 `session.started`；仅 per-step 内容决策用 `step.started`。

---

## 动态子智能体（Dynamic subagents）

按调用方/租户/环境/flag 决定是否暴露时，用 `defineDynamic` 包住子目录 `agent.ts`：返回配置即暴露，`null` 则省略。

```ts title="agent/subagents/finance/agent.ts"
import { defineAgent, defineDynamic } from "eve";

export default defineDynamic({
  events: {
    "session.started": (_event, ctx) => {
      if (ctx.session.auth.current?.attributes.plan !== "enterprise") return null;
      return defineAgent({
        description: "Analyze financial and accounting data.",
        model: ctx.model ? ctx.model.id : "openai/gpt-5.5-mini",
      });
    },
  },
});
```

### `ctx.model` 是父级 effective model

- `ctx.model` 为父级当时的 **effective model**；写法 `model: ctx.model ? ctx.model.id : "..."`。
- 返回配置会**快照** model ID；父模型后变不改子级靶标。
- 本地返回必须用**静态** model + **字符串 model ID**，不能再嵌 `defineDynamic` model。
- 构建 / Workflow-world 配置放外层 `defineDynamic`。

eve **始终**编译子智能体 filesystem 资源，但不给动态子智能体编译占位 agent/model；选中后再合并。

### 远程子智能体

返回 `defineRemoteAgent(...)` 或 `null`。可改 URL/path/headers/auth/principal/output schema；函数型 URL 在事件时解析；auth/headers 懒解析且不进 durable state。见 [远程 Agent](./remote-agents)。

### 事件与 `SUBAGENT_UNAVAILABLE`

支持 `session.started` / `turn.started`（turn 盖住 session，含 `null`）。抛错或非法则**省略**。启动子级前再检查；过期/手工调用以 `SUBAGENT_UNAVAILABLE` 失败。

> **项目建议：** 条件可用性是能力组合，不是唯一授权边界。

---

## 动态连接（Dynamic connections）

按已鉴权调用方解析 MCP/OpenAPI。返回 `defineMcpClientConnection` / `defineOpenAPIConnection`、map 或 `null`。

**官方说明：** 能拿 `ctx.session` 与 `ctx.channel.kind`；**拿不到**消息、delivery、工具输入、模型输出、continuation、随意 channel metadata。

```ts title="agent/connections/accounts.ts"
import { defineDynamic, defineMcpClientConnection } from "eve/connections";
import { listEnabledAccounts, mintAccountToken } from "../lib/accounts";

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => {
      const principal = ctx.session.auth.current;
      if (principal?.principalType !== "user") return null;
      const accounts = await listEnabledAccounts(principal);
      return Object.fromEntries(
        accounts.map((account) => [
          account.slug,
          defineMcpClientConnection({
            url: "https://mcp.cloud.example.com",
            description: `${account.label} (${account.accountId})`,
            instanceKey: account.accountId,
            auth: {
              credentialOwner: "user",
              getToken: ({ principal }) => mintAccountToken(principal, account),
            },
          }),
        ]),
      );
    },
  },
});
```

与静态 [MCP](../connections/mcp) / [OpenAPI](../connections/openapi) 共用 auth/headers/过滤/provided args/审批。进入 per-step registry，工具名 `<connection>__<tool>`。

### `instanceKey`（必设）

带鉴权动态连接必须设稳定、非密钥的 `instanceKey`。变更端点/账号/鉴权方时一并改。parked 登录回调恢复时若 instance 已变，eve **拒绝**回调。

### 命名、冲突、恢复

| 返回 | 文件 | 名 |
| --- | --- | --- |
| 单个定义 | `accounts.ts` | `accounts` |
| map | 同上 | 裸 key |

Map key 合法连接名、无自动 slug 前缀；动态覆盖同名静态；两动态同名抛错。支持 `session.started`/`turn.started`；非法 handler 失败且不重建 registry。恢复/重试可能再跑 handler 以重建 live 回调（不序列化进 workflow）。**保持幂等。**

---

## 动态工具（Dynamic tools）

返回 `defineTool(...)`、map 或 `null`。eve 记录 durable descriptors：`execute`、审批策略、**按输入作用域的 `approvalKey`**、`toModelOutput`。

```ts title="agent/tools/query.ts"
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { listTables, runReadOnly } from "../lib/warehouse";

export default defineDynamic({
  events: {
    "session.started": async () =>
      Object.fromEntries(
        (await listTables()).map((t) => [
          t.name,
          defineTool({
            description: `Query ${t.name}`,
            inputSchema: z.object({ sql: z.string() }),
            execute: ({ sql }) => runReadOnly(t.name, sql),
          }),
        ]),
      ),
  },
});
```

### 可重放回调与 schema

回调写成内联/箭头/方法简写/模块级引用。Closure 必须 JSON 可序列化。Schema 写在 `defineTool()` 内联或模块级；`execute: makeExecutor()` **不会被变换**。

### package：`defineDurableCallback` / `defineDurableSchema`

provider 包无法被变换时用 `defineDurableCallback({ closure, callback })` 包住 labels/approval/`approvalKey`/`execute`/`toModelOutput`。活 schema 用 `defineDurableSchema({ closure, schema })`。见 [memory](../memory/overview)。

### 身份、命名、冲突、事件

Parked call 绑定在 session/生命周期/resolver 条目内；改回调体但保持条目与工具名 → 用最新代码 + 旧 closure。缺失 session 回调可再跑 `session.started` rebind；resolver 不再返回则 fail-closed。

| 返回 | 工具名 |
| --- | --- |
| 单个 | 文件 slug |
| map | 裸 key |

动态覆盖同名 authored；两动态同名抛错。

| 事件 | 可见范围 |
| --- | --- |
| `session.started` | 该 session 每次模型调用 |
| `turn.started` | 该 turn |
| `step.started` | 这一次 |

`turn.started` 时 tools/skills/models/subagents 的 `ctx.messages` 含可见历史与入站消息。执行顺序：channel handler → [hooks](./hooks) → 动态 tool resolvers。同一文件多事件时**最近触发者**拥有工具集。

---

## 动态技能（Dynamic skills）

只支持 `session.started` / `turn.started`。返回 `defineSkill({ markdown })` 或 `null`（按文件 slug）。命名/冲突规则与工具相同。

```ts title="agent/skills/team_playbook.ts"
import { defineDynamic, defineSkill } from "eve/skills";
import { PLAYBOOKS } from "../lib/playbooks";

export default defineDynamic({
  events: {
    "session.started": (_e, ctx) => {
      const team = ctx.session.auth.current?.attributes.team;
      const md = team ? PLAYBOOKS[team] : undefined;
      return md ? defineSkill({ markdown: md }) : null;
    },
  },
});
```

---

## 动态指令（Dynamic instructions）

`defineInstructions({ content, role? })`；省略 `role` 为 system。

```ts title="agent/instructions/persona.ts"
import { defineDynamic, defineInstructions } from "eve/instructions";

export default defineDynamic({
  events: {
    "session.started": (_e, ctx) => {
      const plan = ctx.session.auth.current?.attributes.plan ?? "free";
      return defineInstructions({
        content: `The caller is on the ${plan} plan. Match answer depth to it.`,
      });
    },
  },
});
```

应用/用户上下文进 durable 历史时用 `role: "user"`（常挂 `turn.started`）。

### system vs user、快照

只支持 `session.started`/`turn.started`。system 不进历史；user 在生命周期边界追加（session 在 turn 前，都在当前 delivery 前）。**无自动去重**。增强 `ctx.messages` **仅**给 instruction resolvers。`null`/空白不贡献。park/resume/replay 不重复追加 user 消息。

**项目建议：** 稳定值放 session；频繁变的 system 会伤 prompt cache。

---

## 常见误区

1. 把动态可用性当成唯一授权边界  
2. 动态 model 返回 `null`  
3. 子配置再套 `defineDynamic` model  
4. `execute: makeExecutor()`（不被变换）  
5. 带鉴权连接漏 `instanceKey`  
6. 两动态 resolver 裸 key 撞名  
7. resolver 里做不可幂等副作用  

## 接下来读什么

- [子智能体](../subagents) · [连接](../connections/overview) · [工具概览](../tools/overview) · [内置工具](../concepts/built-in-tools)  
- [鉴权与路由保护](./auth-and-route-protection) · [State](../concepts/state) · [Memory](../memory/overview)  
- [Workflows as Tools](../tools/workflows) · [TypeScript API](../reference/typescript-api)
