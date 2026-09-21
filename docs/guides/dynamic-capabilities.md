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

### 远程子智能体

单文件远程子智能体生命周期相同：返回 `defineRemoteAgent(...)` 暴露，`null` 省略。

```ts title="agent/subagents/finance.ts"
import { defineDynamic, defineRemoteAgent } from "eve";

export default defineDynamic({
  events: {
    "session.started": (_event, ctx) =>
      ctx.session.auth.current?.attributes.plan === "enterprise"
        ? defineRemoteAgent({
            description: "Analyze financial and accounting data.",
            url: "https://finance-agent.example.com",
          })
        : null,
  },
});
```

返回的远程定义可以改 URL、path、headers、auth、principal 转发、output schema。函数型 URL 在动态事件跑时解析；auth / headers 保持懒解析，在每次出站请求前解析，且不进入 durable workflow state。更多见 [远程 Agent](./remote-agents)。

### 事件、委派与 `SUBAGENT_UNAVAILABLE`

- 支持 `session.started` 与 `turn.started`。turn 选择会盖住该 turn 的 session 选择（含 turn 返回 `null`）。
- Resolver 抛错或返回非法定义时，eve 记日志并**省略**该子智能体。
- 解析后的集合适用于本地与远程的直接委派；authored workflow 可通过 `ctx.agent` 调用所选子智能体；生成的程序可通过提供的 `workflow` 工具调用。
- 启动子级前 eve 会再检查可用性：过期或手工构造的调用以 `SUBAGENT_UNAVAILABLE` 失败。

> **项目建议：** 把条件可用性当作**能力组合**，而不是唯一授权边界。敏感子工具仍要各自做鉴权与审批。

---

## 动态连接（Dynamic connections）

可用的 MCP / OpenAPI 服务取决于已鉴权调用方时，用动态连接。Handler 返回一个 `defineMcpClientConnection(...)` / `defineOpenAPIConnection(...)`、一张连接定义 map，或 `null`。每个返回值都要用对应协议 helper 包起来。

**官方说明：** Connection resolver 能拿到 `ctx.session` 与 `ctx.channel.kind`；**拿不到**对话消息、delivery payload、工具输入、模型输出、continuation token，或随意的 channel metadata。账号与端点应从已鉴权 session 身份或应用自有数据选择。

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

返回定义与静态 [MCP](../connections/mcp) / [OpenAPI](../connections/openapi) 连接共用同一套 auth、headers、过滤、provided arguments、审批选项。解析后的连接进入 per-step registry，出现在 `connection_search`，发现的工具名为 `<connection>__<tool>`。

### `instanceKey`（必设）

**带鉴权的动态连接必须设稳定、非密钥的 `instanceKey`。** 用稳定的账号 / 租户标识；端点、账号或鉴权提供方变更时一并改它。eve 会先哈希再写入 durable authorization state。若 parked 的登录回调恢复时，resolver 已选了不同 instance，eve 会拒绝该回调，而不是交给新连接或复用其 token。

### 命名与冲突

| 返回形状 | 文件 | 连接名 |
| --- | --- | --- |
| 单个连接定义 | `agent/connections/accounts.ts` | `accounts` |
| map `{ production, staging }` | `agent/connections/accounts.ts` | `production`、`staging` |

- Map key 须是合法连接名：小写 ASCII 字母、数字、短横线，以字母开头，最长 64 字符。
- Map key 是**裸名**：eve **不会**自动加文件 slug 前缀。
- 动态连接会**覆盖**同名静态连接。
- 两个生效的动态 resolver 不能发出同名；给其中一个 map key 加命名空间消歧。

### 事件与恢复

- 支持 `session.started` / `turn.started`。turn 结果替换该文件本 turn 的 session 结果（含返回 `null`）。
- 抛错或非法 handler 会使该生命周期失败，且**不会**重建 registry——被动态结果盖住的静态连接不会作为 fallback 重新出现。
- parked turn 恢复或 durable step 重试时，eve 可能再跑活跃的 session / turn handler，以重建 live 的 auth、header、approval、provided-argument 回调，而**不**把它们序列化进 workflow state。

**项目建议：** 连接 resolver 保持幂等；外部副作用放在 handler 外。

---

## 动态工具（Dynamic tools）

向 `defineDynamic` 传入 `events`；handler 返回单个 `defineTool(...)`、`Record<string, defineTool(...)>`，或 `null`。每条都要用 `defineTool()` 包住。

**官方说明：** eve 会为动态工具记录 durable descriptors：`execute`、审批请求/响应策略、**按输入作用域的 `approvalKey` 回调**，以及 `toModelOutput`，以便 parked call 在新进程里重建同一套回调。
