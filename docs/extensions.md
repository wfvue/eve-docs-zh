---
title: "扩展（Extensions）"
description: "把可复用的 eve 能力打包，并从 npm 或 monorepo workspace 挂载。"
---

# 扩展（Extensions）

Extensions 打包 eve 的 tools、channels、connections、skills、schedules、subagents、instruction fragments 和 hooks。作者构建 extension 包；每个使用它的 Agent 把它声明为依赖并 mount。包可以发布到 registry，也可以只留在 monorepo workspace 里。

现成的 extensions 也可以通过 eve integration registry 分发。发现并用 `eve add` 添加见 [添加集成（Add Integrations）](./install-integrations)；本页说明如何编写、挂载、配置和覆盖 extension 包。

这让很多不同的能力集可以共享。例如一个浏览器 extension 可以包含若干导航网站的工具；一个自我改进的 extension 可以把 hooks 和动态 instructions 配在一起。

官方原文：[Extensions](https://eve.dev/docs/extensions)。

## 作者：创建 extension

### 创建包

从 extension scaffold 开始：

```bash
npx eve@latest extension init my-crm
```

命令会创建包、安装依赖并初始化 Git。它包含 `extension/extension.ts`、TypeScript 配置，以及构建和发布所需的包 metadata。

Extension 对其贡献使用与 Agent 相同的文件约定：

```text
@acme/crm/
  package.json
  extension/
    extension.ts
    tools/search.ts
    channels/webhook.ts
    connections/api.ts
    skills/triage/SKILL.md
    schedules/sync.ts
    subagents/reviewer/agent.ts
    instructions.md
    hooks/audit.ts
    lib/http.ts
```

每个列出的 slot 都接受与 Agent 对应 slot 相同的 authored 形式。静态和动态 tools、skills、instructions 都可以：`extension/instructions.ts` 和 `extension/instructions.md` 一样有效，`extension/tools/` 也可以包含 `defineDynamic(...)`。

名字来自路径，所以把工具叫 `search` 而不是 `crm_search`；消费者的 mount 会加上 `crm__` 前缀。同样的前缀适用于 channel、schedule 和父级可见的 subagent ID；channel 路由路径和 schedule cron 表达式保持不变。共享代码放在 `extension/lib/`。

Extension 根不能声明 Agent 配置、instrumentation、[记忆（Memory）](./memory)、sandbox 或嵌套 extensions。那些 Agent 级关注点属于消费应用。`extension/subagents/` 下贡献的子智能体，像任何其它[声明式子智能体](./subagents)一样拥有自己的 Agent 配置、memory 和 sandbox。

### 添加配置和贡献

作者的 `extension/extension.ts` 默认导出一个 `defineExtension` handle。消费者需要提供设置时，给它一个 [Standard Schema](https://standardschema.dev)：

```ts title="extension/extension.ts"
import { defineExtension } from "eve/extension";
import { z } from "zod";

export default defineExtension({
  config: z.object({
    apiKey: z.string(),
    baseUrl: z.string().url().default("https://api.acme.example"),
  }),
});
```

贡献（包括 schedule handlers）可以 import 这个 handle 读取已校验配置。Defaults 已经应用过：

```ts title="extension/tools/search.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";
import extension from "../extension";

export default defineTool({
  description: "Search the CRM.",
  inputSchema: z.object({ query: z.string() }),
  async execute({ query }) {
    const { apiKey, baseUrl } = extension.config;
    return { query, baseUrl, authenticated: apiKey.length > 0 };
  },
});
```

不需要配置时，导出 `defineExtension()` 并让消费者直接 re-export。Config schemas 必须同步校验。

`defineState` 会自动按 extension 包隔离，所以同一个 state name 不会和消费者或另一个 extension 碰撞。

### 添加子智能体

在 `extension/subagents/<id>/` 下用与 Agent 声明的子智能体相同的文件编写。把 extension 挂成 `crm` 时，`extension/subagents/reviewer/` 会作为 `crm__reviewer` 暴露给消费 Agent node。子智能体自己的 tools、connections、skills、hooks、instructions、sandbox 和嵌套 subagents 仍隔离在它的 node 内，并保留路径派生的名字。

贡献的子智能体内部模块可以 import extension handle。例如 `extension/subagents/reviewer/tools/` 下的工具可以读取消费者在 `agent/extensions/crm.ts` 绑定的配置。

### 构建并可选发布

Scaffold 的 `package.json` 声明分开的 source 和 distribution 根：

```jsonc title="package.json"
{
  "name": "my-crm",
  "version": "0.0.0",
  "type": "module",
  "eve": {
    "extension": {
      "source": "./extension",
      "dist": "./dist/extension",
      "externalDependencies": ["@acme/runtime-sdk"]
    }
  },
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.mjs"
    },
    "./tools": {
      "types": "./dist/tools/index.d.ts",
      "default": "./dist/tools/index.mjs"
    }
  },
  "scripts": {
    "build": "eve extension build",
    "prepare": "eve extension build",
    "typecheck": "tsc"
  },
  "peerDependencies": {
    "eve": "*"
  },
  "engines": {
    "node": ">=24"
  }
}
```

Scaffold 在创建 workspace 包时会省略 `engines`。用 `eve extension build` 构建：

```bash
eve extension build
```

它会写出 Agent 形状的 `dist/extension` 树、复制 skill 资源、发出 declarations，并记录兼容性 metadata。它也管理 mount factory（`@acme/crm`）和 tool definitions（`@acme/crm/tools`）的 package exports。发布 `dist/`；消费者不需要作者的 TypeScript 源码。

精确的 `eve` development pin 控制 extension 编写 API 和构建工具。Wildcard peer 让消费者提供 runtime 那份 eve。消费时 eve 检查生成的 metadata，而不是 npm peer range。不要把 eve 加进普通 `dependencies`。

运行时包如 `zod` 或 SDK 放进 `dependencies`。大多数依赖会自动打包进消费 Agent。

当包必须在 runtime 保持普通 Node.js 包布局时，把它加到 `eve.extension.externalDependencies`。常见情况包括 native addons 和加载相对包资源的 SDK。`eve extension build` 要求每个列出的包也出现在 `dependencies`、`optionalDependencies` 或 `peerDependencies` 中，并写进生成的兼容性清单。消费端 eve 会保持该包 external 并保留完整包树；消费者不需要编辑 `agent.ts` 或直接安装这个传递依赖。

## 消费者：安装并挂载 extension

Mount 给 extension 的贡献一个 namespace。更新包就会更新已挂载的 extension；不会复制进消费者的 Agent。

### 安装包

用消费者 Agent 项目已经在用的包管理器安装。新的 eve 项目默认用 pnpm：

```bash
pnpm add @acme/crm
```

### 挂载

在 `agent/extensions/` 下创建文件。文件名成为 mount namespace。需要配置时调用 extension 的默认导出：

```ts title="agent/extensions/crm.ts"
import crm from "@acme/crm";

export default crm({ apiKey: process.env.CRM_API_KEY! });
```

在消费者环境里设置 `CRM_API_KEY`，本地开发例如 `.env.local`。

Mount 会给命名贡献加上 `crm__`：`tools/search.ts` 变成 `crm__search`，`channels/webhook.ts` 变成 `crm__webhook`，`schedules/sync.ts` 变成 `crm__sync`，`connections/api.ts` 变成 `crm__api`，`subagents/reviewer/` 变成 `crm__reviewer`。Channels 保留声明的路由路径，schedules 保留 cron 表达式。

没有配置的 extension 直接 re-export 默认导出：

```ts title="agent/extensions/gizmo.ts"
export { default } from "@acme/gizmo";
```

同一套 mount 形状适用于 npm 包、workspace 依赖或 link 的本地包。

### 在 workspace 里使用 extension

Workspace extension 是和消费者放在同一个 monorepo 里的普通 extension 包。适合多个 Agent 需要同一套能力，或私有能力要和使用者一起演进。

例如一个 pnpm workspace 可以让一个 extension 挨着两个独立可部署的 Agent：

```text
acme-agents/
├── pnpm-workspace.yaml
├── packages/
│   └── shared-capabilities/
│       ├── package.json
│       └── extension/
└── agents/
    ├── support/
    │   └── agent/extensions/shared.ts
    └── operations/
        └── agent/extensions/shared.ts
```

让 extension 和 Agent 目录都成为 workspace members，然后从已被 workspace 覆盖的目录脚手架：

```bash
cd packages
npx eve@latest extension init shared-capabilities
```

给生成的包一个消费者会 import 的名字。永远不该发布时加 `"private": true`。每个消费 Agent 声明自己的 workspace 依赖（`"@acme/shared-capabilities": "workspace:*"`），再各自 mount。Mount 是按 Agent 的：每个消费者选自己的 mount namespace，配置型 extension 传入自己的配置。`shared.ts` 贡献 `shared__search`；另一个 Agent 把同一包挂成 `company.ts` 则贡献 `company__search`。

#### 从源码开发

`eve dev` 启动消费 Agent 时，会先构建同一 workspace 里找到的、源码支撑的已挂载 extensions，再编译 Agent。它监视 extension 源码以及相关的 package 和 TypeScript 配置，然后只重建受影响的 extension。如果一次 extension 编辑构建失败，上一次成功的 development generation 继续运行。

生产 `eve build` 期望 extension distribution 已经存在。像 scaffold 那样把 `eve extension build` 放进 extension 包的 `build` 和 `prepare` scripts，并按依赖顺序跑 workspace builds，让 extensions 在消费 Agent 之前构建。

### 覆盖贡献

用目录 mount 把覆盖放在 mount 声明旁边。声明放在 `extension.ts`，覆盖放在旁边：

```text
agent/extensions/crm/
  extension.ts
  tools/search.ts
```

同名的消费者 channel、tool、connection、skill、schedule 或 subagent 会赢。要调整 extension tool，从包的 `./tools` export import 它再定义一次：

```ts title="agent/extensions/crm/tools/search.ts"
import { search } from "@acme/crm/tools";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";

export default defineTool({ ...search, approval: always() });
```

移除 extension tool 时，在对应 slot 使用 `disableTool()`：

```ts title="agent/extensions/crm/tools/search.ts"
import { disableTool } from "eve/tools";

export default disableTool();
```

Hooks 和 instruction fragments 是叠加的，所以不能替换。要替换 dynamic tool，在同一 slot 使用 dynamic 定义；运行时 dynamic tools 会赢过同名 static tools。`disableTool()` 两种都能移除。

也可以用最终限定名把覆盖放在对应的 Agent 根 slot。例如 `agent/tools/crm__search.ts` 会替换 extension 包或其目录覆盖里的 `tools/search.ts`。应用源优先级最高，两种形式都存在时 Agent 根覆盖会赢。

### 在 hook 里使用 extension tool 结果

要在消费者 hook 里保留 extension tool 的结果类型，从 `./tools` import 它的定义并传给 [`toolResultFrom`](./guides/hooks)：

```ts title="agent/hooks/narrow-crm.ts"
import { defineHook } from "eve/hooks";
import { toolResultFrom } from "eve/tools";
import { search } from "@acme/crm/tools";

export default defineHook({
  events: {
    "action.result"(event) {
      const match = toolResultFrom(event.data.result, search);
      if (match) console.log(match.output);
    },
  },
});
```

`toolResultFrom` 从原始定义识别已挂载的 `crm__search` 结果，而不是命名空间字符串。发布者应保持 tool descriptions 互不相同，这样 eve 才能给每个定义分配明确身份。

### 兼容性

构建时 eve 检查 extension 生成的 capability metadata。如果 extension 需要不受支持的 capability contract，升级 eve 或安装兼容的 extension release。

## 接下来读什么

- [Integrations](https://eve.dev/integrations)：用 Extensions 筛选器浏览可安装的 extensions
- [工具（Tools）](./tools)、[动态能力](./guides/dynamic-capabilities)、[技能（Skills）](./skills)、[连接（Connections）](./connections)、[渠道（Channels）](./channels/overview)、[定时任务（Schedules）](./schedules)、[子智能体（Subagents）](./subagents)、[钩子（Hooks）](./guides/hooks)
