---
title: "CLI"
description: "eve CLI 每个命令的参考：init、set、info、build、start、dev、logs、trace、link、deploy、eval、channels 和 extension。"
---

# CLI

`eve` 二进制（`bin: eve`）从应用根目录运行，每个命令都会先从该根目录加载 `.env`/`.env.local`。不带命令运行 `eve` 会执行 `eve dev`。

## 命令（Commands）

| 命令 | 描述 |
| --- | --- |
| `eve init [target]` | 创建新 Agent，或把 Agent 加入已有项目 |
| `eve info` | 打印解析后的应用，包括发现的 tools、skills、subagents、schedules、channels、routes、artifact 路径和发现诊断 |
| `eve build` | 编译 `.eve/` artifacts 并构建 host 输出；打印输出目录 |
| `eve start` | 服务已构建的 `.output/` 应用；打印监听 URL |
| `eve dev` | 启动本地 dev server 并打开终端 UI |
| `eve dev <url>` | 把 UI 连接到现有 server URL（例如远程部署），而不是启动本地 server |
| `eve acp [url]` | 把本地应用或现有 eve server URL 作为稳定的 ACP v1 agent，通过 stdio 提供服务 |
| `eve logs [logid]` | 打印 `eve dev` 诊断日志（省略 `logid` 时打印最近一条） |
| `eve logs ls` | 列出 `eve dev` 诊断日志，最新的在前 |
| `eve traces ls` | 列出本地捕获的 agent traces，最新的在前 |
| `eve traces [trace]` | 显示本地 span 树（省略时显示最近一条） |
| `eve link` | 把目录关联到 Vercel 项目并拉取 AI Gateway 凭证 |
| `eve deploy` | 把 Agent 部署到 Vercel 生产环境（需要时先 link） |
| `eve eval` | 对本地应用或远程目标运行 evals |
| `eve channels list` | 列出用户编写的渠道 |
| `eve extension init [target]` | 创建新的 extension 包 |
| `eve extension build` | 把当前包构建为 extension |
| `eve set` | 修改根 Agent 的 model 和 reasoning effort |
| `eve add <item>` | 从官方或已配置的 shadcn registry 安装条目 |
| `eve registry <command>` | 添加 sources，并列出、搜索或查看 registry catalog 条目 |

当 `eve build` 因发现错误失败时，它打印完整诊断报告（severity、message、source path）和 diagnostics artifact 路径。

## `eve init`

```sh
eve init [target] [--model <provider/model-id>] [--reasoning <effort>] [--channel-web-nextjs]
```

创建新的 Agent 应用，或把 Agent 加入已有应用。总是安装依赖。新目录也会初始化 Git。

| 目标 | 发生什么 |
| --- | --- |
| `eve init my-agent` | 在 `my-agent/` 里创建新 Agent 项目 |
| `eve init .`（或已有项目目录） | 添加 `agent/` 以及缺失的 `eve`、`ai` 和 `zod` 依赖。需要一个 `package.json`，且还没有 `agent/` 文件 |
| `eve init` 无目标 | 同 `eve init .`，但编码 Agent（Claude Code、Cursor 等）会得到设置指南而不是脚手架——它们还没选名字 |

脚手架之后，人类终端通常会继续进入 `eve dev`。如果 coding-agent REPL 在 `PATH` 上，交接菜单可以打开它，或直接退出而不启动任一进程。Coding-agent 启动打印下一步而不是打开 TUI，所以 session 不会卡住。新项目在有父 workspace package manager 时使用它；否则使用启动 `eve init` 的那个 manager。

| Flag | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `--model <model>` | string | `openai/gpt-5.6-luna-fast` | 设置根 Agent 的 AI Gateway model ID。 |
| `--reasoning <effort>` | enum | provider default | 把 reasoning 设为 `none`、`minimal`、`low`、`medium`、`high` 或 `xhigh`。`provider-default` 让该字段保持未编写。 |
| `--channel-web-nextjs` | flag | off | 添加 Web Chat 应用（Next.js）。不适用于已有项目——在那里改跑 `eve add channel/web`。 |

## `eve extension`

用于可复用 [extension](https://eve.dev/docs/extensions) 包的命令。一个 extension 在 `package.json#eve.extension` 里声明不同的编写和分发根（例如 `"eve": { "extension": { "source": "./extension", "dist": "./dist/extension" } }`）。

### `eve extension init`

```sh
eve extension init [target]
```

创建新的 extension 包、安装依赖并初始化 Git。打印下一步而不是启动 `eve dev`。

| 目标 | 发生什么 |
| --- | --- |
| `eve extension init my-crm` | 在 `my-crm/` 里创建新 extension 包 |
| `eve extension init .` | 在当前空目录脚手架 |
| 无目标 | 对人类同 `.`；coding agents 得到简短设置指南 |

仅创建：不能以已有 `package.json` 的现有项目为目标。

编写和挂载细节见 [Extensions](https://eve.dev/docs/extensions)。

### `eve extension build`

```sh
eve extension build
```

把完整的 agent 形状 extension 树构建进它配置的 dist root，发出 declarations 和兼容性元数据，并填充包的 `exports` map。发布包中不需要原始 TypeScript 源码。

## 设置模型设置

不打开 dev TUI 的情况下修改根 Agent 的 AI Gateway model 和 reasoning effort：

```sh
eve set \
  --model openai/gpt-5.6-sol \
  --reasoning high
```

单独传任一 flag 修改一个设置。两个都传时，eve 在一次源码编辑中把它们写进 `agent/agent.ts`。`--reasoning` 接受 `provider-default`、`none`、`minimal`、`low`、`medium`、`high` 或 `xhigh`；`provider-default` 移除编写的 `reasoning` 字段。

该命令使用与本地 dev TUI 中 `/model` 相同的 model ID 校验和源码编辑器。它不配置模型凭证。`--model` flag 不能重写用 `defineDynamic`、环境表达式或 provider 编写的 SDK model 定义的模型；在 `agent.ts` 中修改那些模型。当根配置的模型来自 SDK 调用时，`--reasoning` 仍可以更新可编辑的根配置。

## Registry 条目

用于安装和发现 [shadcn registry](https://ui.shadcn.com/docs/registry) 条目的命令。官方 registry 条目使用 kind 和 slug（例如 `extension/agent-browser`）；也支持 URL 和配置的 registry 地址。

```sh
eve add extension/agent-browser
eve add linear
eve add channel/slack --skip-install
eve add https://example.com/r/my-extension.json --overwrite
eve registry add @acme=https://example.com/r/{name}.json
eve registry search browser
eve registry search browser --limit 5
eve registry search browser --registry @acme
eve registry view @acme/my-extension
eve add @acme/my-extension
```

`eve add` 在运行官方条目声明的 setup 之前询问，并按声明顺序运行多个声明的流程。产品级包可以提供可独立安装的组件：`eve add linear` 让你选择 Linear Channel、Linear MCP 或两者，默认两者都选。交互式 Vercel 支撑的设置会在需要时登录并创建或关联项目，而不是以先决条件停止。`--yes` 安装包的默认组件并接受检测到或推荐的设置答案。

Coding agents 应该使用 `eve add <item> --non-interactive`，加 `--yes` 接受推荐的设置值并减少设置往返。显式 `--answer` 值优先。该模式从不打开 eve prompt。当组件或设置决定缺失时，NDJSON 终端事件包含稳定的 question key 和安全续行命令；把要求的答案加进那个命令。用可重复的 `--answer 'key=<JSON value>'` 选项提供答案。重试 Vercel Connect 设置前先遵循报告的 `eve link` 先决条件。不要把 secrets 放进命令行答案；使用集成文档中的环境变量或 secret store。

当设置被跳过、取消或在安装后需要更多输入时，eve 打印或返回匹配的 `eve add <item> --skip-install` 续行命令。它重新运行所选组件声明的流程，而不重装 registry 文件。

`eve registry add` 在 `package.json#registries` 中记录配置的 sources。`eve registry list` 默认汇总官方 catalog 和所有配置的 sources。`eve registry search` 也包含 [skills.sh](https://skills.sh)，在 `@skills` 无需配置即可用，并按 source 分组结果，带每个 source 的可用结果数。搜索默认每个 source 返回最多 10 个匹配；传 `--limit <count>` 请求 1 到 100 个。任一命令都可以浏览一个提供的 URL 或命名空间。官方和其他带显式文件目标的通用条目不需要 shadcn 项目配置。

## `eve info`

```sh
eve info [--json]
```

| Flag | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `--json` | flag | off | 以 JSON 发出 |

当某些行为异常时先运行它。它确认文件被发现、列出活跃表面并浮出发现诊断，都比启动 dev server 快。

## `eve build`

```sh
eve build [--profile <path>] [--skip-sandbox-prewarm]
```

在 `.eve/builds/` 下一个调用拥有的目录里编译和打包，然后发布完成的 host 输出并打印它的路径。Scratch workspaces 在成功或失败后被移除。

| Flag | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `--profile <path>` | string | off | 尽力而为的版本化 JSON 报告，带构建阶段计时和最终输出大小测量 |
| `--skip-sandbox-prewarm` | flag | off | 为 Vercel 构建跳过 sandbox 模板预热；输出可能不可部署 |

用 profile 文件在修改构建管线之前建立可重复基线：

```sh
eve build --profile .eve/build-profiles/baseline.json
```

报告只在构建成功后尝试。它记录总耗时、完成的阶段计时，以及文件总数、原始字节数和每个文件 gzip 压缩后总和的最终常规文件统计。对 Vercel 输出，它还为每个真实的 `.func` 目录包含小计，因此应用和流程 bundle 可以分开比较。Profile 路径从应用根解析，应该在已发布输出目录之外；profile 收集不会给部署加文件。如果收集或写入失败，eve 发出警告，但保持已完成的构建成功。

生产构建不写 `eve dev` 拥有的稳定编译器、host、Nitro 或 Workflow 文件，所以构建可以在本地 dev server 活跃时运行。失败的构建让最后的成功 `.output/` 和 agent summary 不受影响。并发的已完成构建只在最终发布窗口序列化。

`.eve/` 下检查和开发流程写出的有用稳定 artifacts 包括：

| Artifact | 描述 |
| --- | --- |
| `.eve/discovery/agent-discovery-manifest.json` | eve 在磁盘上找到什么 |
| `.eve/discovery/diagnostics.json` | authored-shape 错误和警告 |
| `.eve/compile/compiled-agent-manifest.json` | eve 在运行时加载的序列化 authored surface |
| `.eve/compile/compile-metadata.json` | 构建时元数据和路径 |
| `.eve/compile/module-map.mjs` | eve 在运行时 import 的编译模块 entrypoints |

## `eve start`

```sh
eve start [--host <host>] [--port <port>]
```

| Flag | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `--host <host>` | string | all interfaces | 绑定到的主机接口 |
| `--port <port>` | number | `$PORT`，然后是 3000 | 监听端口 |

服务之前构建的输出。打印监听 URL。

## `eve dev`

```sh
eve dev [options]
eve dev https://your-app.vercel.app
```

传一个裸 URL，UI 就连接到那个 server 而不是启动本地一个（同 `--url`），这让你可以冒烟测试 preview 或生产部署。在非 TTY 终端中交互式 UI 会关闭。

| Flag | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `--host <host>` | string | all interfaces | 绑定到的主机接口 |
| `--port <port>` | number | `$PORT`，然后是 2000 | 监听端口 |
| `-u, --url <url>` | string | none | 连接到现有 server URL 而不是启动一个 |
| `-H, --header <header>` | string | none | URL 目标的请求头，`Name: value` 形式；可重复 |
| `--no-ui` | flag | UI on | 无交互式 UI 启动 server |
| `--name <name>` | string | app folder name | 终端 UI 中显示的标题 |
| `--input <text>` | string | none | 预填 prompt 输入；裸本地 `/model` 启动 onboarding |
| `--tools <mode>` | enum | `auto-collapsed` | 工具调用渲染：`full` \| `collapsed` \| `auto-collapsed` \| `hidden` |
| `--reasoning <mode>` | enum | `full` | 推理渲染：`full` \| `collapsed` \| `auto-collapsed` \| `hidden` |
| `--subagents <mode>` | enum | `auto-collapsed` | 子智能体区块渲染：`full` \| `collapsed` \| `auto-collapsed` \| `hidden` |
| `--connection-auth <mode>` | enum | `full` | 连接授权渲染：`full` \| `collapsed` \| `auto-collapsed` \| `hidden` |
| `--assistant-response-stats <mode>` | enum | `tokensPerSecond` | Assistant 头统计：`tokens` \| `tokensPerSecond` |
| `--context-size <tokens>` | number | none | 模型上下文窗口大小，显示为使用百分比 |
| `--logs <mode>` | enum | `stderr` | 显示的 server/agent 日志：`all` \| `stderr` \| `sandbox` \| `none` |

`eve acp` 为换行分隔的 JSON-RPC 保留 stdin 和 stdout，并把诊断发到 stderr。没有 URL 时，它监督一个隔离的本地开发 server。有 URL 时，它把 ACP 桥接到那个 server 的现有 eve HTTP API，并接受与 `eve dev <url>` 相同的 URL 凭证和请求头。当活跃 Vercel scope 不拥有该部署时传 `--scope <team>`；`EVE_VERCEL_SCOPE` 为受管理的 harness 提供同样的值。客户端配置和能力限制见 [Use eve through ACP](../guides/acp)。

新鲜的 `eve init` 传 `--input /model`。那个裸本地输入启动 onboarding：TUI 在需要时安装 Vercel CLI、在需要时要求登录、打开 `/model`，然后在第一个 prompt 之前提供分类的 registry 下一步。其他输入在 prompt 中保持可编辑。

对受 HTTP Basic auth 保护的 URL 目标，把凭证放进 URL。eve 把它们作为 Basic `Authorization` 头发送，并在连接前从 server URL 剥离它们：

```sh
eve dev https://user:pass@your-app.example.com
```

对 bearer tokens 或自定义 scheme，用 `-H` 传显式 headers。

### `eve invoke`

| Option | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `[prompt]` | string | none | Prompt、后续消息或对挂起输入的回答 |
| `-u, --url <url>` | string | local | 调用现有 server |
| `-H, --header <header>` | string | none | URL 目标的请求头；可重复 |
| `--resume` | flag | off | 从 stdin 读取之前的可恢复结果 |
| `--scope <team>` | string | current | 拥有 URL 目标的 Vercel team |
| `--json-schema` | flag | off | 打印结果 JSON Schema 并退出 |

用 `eve invoke` 提交 turn 而不打开 TUI。它在调用完成或到达阻塞输入或授权事件后发出 JSON。

```sh
eve invoke "Summarize station telemetry"
result=$(eve invoke "Deploy the application")
printf '%s' "$result" | eve invoke --resume "approve"
eve invoke --json-schema
```

`--resume` 从 stdin 读取完整的前一个结果。为 `ready` 后续消息或挂起输入提供文本；agent harness 会把输入文本解析到所有挂起请求。`ready` 结果包含前一个 turn 的完成或失败 `outcome`。`authorization-required` 结果在 `authorizations` 中列出每个未解决的挑战；完成它们，然后不带文本恢复。对受保护的远程 server 再次传显式 headers。如果 URL 属于另一个 Vercel team，用 `--scope` 传它的 slug；这不会重新关联当前目录。恢复时再次传 scope。暂停的调用以 `3` 退出；失败以 `1` 退出。

基于本地回调的 connection 授权需要持久 server。运行 `eve dev`，然后用 `eve invoke --url <dev-url>` 代替。如果等待中的调用在接受后收到 `SIGINT` 或 `SIGTERM`，它会在退出前发出一个最终可恢复的 `running` 结果。

本地 dev 在 `.eve/dev-server-state.v1.json` 中记录每个解析应用根的最近 ready URL。第二次交互式 `eve dev` 只在该 URL 是 loopback 且健康时重连；每个终端 UI 创建全新客户端 session，同时共享 server 进程。过时或格式错误的记录会在 eve 启动新 server 时被替换。传 `--host`、`--port` 或 `PORT` 环境值会跳过重连，并报告健康的已记录 server。

本地 dev 在 `.eve/dev-runtime/snapshots/` 下保留不可变的 runtime 源码快照，让进行中的 turn 持有一致的代码版本，而新 turn 拾取重建。终端 REPL 在成功的重建之间保持逻辑 session，所以下一个 turn 在最新一代上继续对话；`/new` 在清空 transcript 之前终结性退役那个 session，下一个 prompt 在首次使用 sandbox 时以新的 session-scoped sandbox 启动全新 session。一代被取代后，`eve dev` 至少保留它 30 分钟，也保留最近五代被取代的 generation，无论配置的 Workflow World 如何。活跃 generation 从不被修剪。旧 runtime 快照和本地 sandbox 模板在后台修剪。手动清理时，先停 `eve dev` 再删除 `.eve/dev-runtime/snapshots/` 或 `.eve/sandbox-cache/local/templates/`。在自动保留窗口之外仍未完成的 turn，在其 generation 被修剪后无法再恢复。

当没有编写的 `agent/instrumentation.ts` 时，本地 dev 也在 `.eve/traces/` 下记录 traces，并按年龄、大小和 keep-newest floor 限制该存储。用 `.env.local` 中的 `EVE_TRACES*` 配置它；规则和默认值见 [`eve traces`](#eve-traces)。

## `eve logs`

```sh
eve logs # print the most recent diagnostic log
eve logs ls # list logs, most recent first
eve logs <logid> # print a specific log
eve logs --dump # prepend the log's environment dump
eve logs --events # interleave session events from the local workflow store
```

每个交互式 `eve dev` 进程在 `.eve/logs/` 下写一个私有诊断日志，捕获 stderr、stdout（包括 sandbox 和重建行）、工具失败、workflow 错误和 eve 框架日志记录——无论 transcript 显示什么。文件是 JSON Lines——每行是一条带 `at` 和 `source` 字段的 JSON 记录。`eve logs` 读回那些文件。

Log id 是不带 `.log` 的文件名（例如 `dev-2026-07-15T12-00-00.000Z-123`）。`eve logs <logid>` 也接受文件名、dev transcript 中打印的 `.eve/logs/...` 路径，或 id 的任意无歧义前缀，带或不带 `dev-` 前缀——所以单个日志匹配时 `eve logs 2026-07-15` 有效。歧义前缀会失败并列出候选。

`eve logs` 只打印记录——两个流上都没有路径横幅——所以 `eve logs 2>&1 | jq -c .` 总是可解析。用 `eve logs ls` 发现 id 和文件路径；`eve logs ls --json` 发出带 `id`、`path`、`startedAt` 和 `sizeBytes` 的机器可读数组。

`eve logs --events` 在查询时从本地 workflow store（`.eve/.workflow-data`）解析 session 事件（`session.started`、`turn.failed`、消息增量等），并按时间戳以 `source: "event"` 记录交错进输出——日志文件本身从不存储它们，所以捕获时不会重复。选择按日志的时间窗口（它的开始到下一个日志的开始），所以并发运行的 `eve dev` 进程的事件可能出现。

每个日志都有一个同名 `.dump` 兄弟文件，作为单个 JSON 文档持有环境诊断和 session 统计。`eve logs --dump`（带或不带 log id）把那个文档前置到 JSONL 日志 body；组合输出是有效的 JSON 值流（`eve logs --dump | jq -c .`），一个自包含的报告可以贴到 issue 上。当日志没有 dump 时，该 flag 静默 no-op。

## `eve traces`

```sh
eve traces ls # list traces, most recent first
eve traces ls --json # emit machine-readable trace summaries
eve traces # show the most recent span tree
eve traces <trace> # show one span tree
eve traces --verbose # expand every span with all attributes and events
eve traces --json # dump the full trace as JSON
```

读取 `.eve/traces/v1` 下不可变的 OTLP/JSON segments，所以 `eve dev` 不需要在运行。接受完整 trace id、`agent.session.id`，或两者的无歧义前缀。格式错误的 segments 会被跳过，不会隐藏同一 trace 中的有效 spans。

Span 行在 span 记录它们时携带内联指标——`↑input`/`↓output` token 计数、gateway cost，以及 `ai.toolCall` spans 的工具名——header 汇总 trace 的 step spans 中的模型、token 总计、成本和错误数。`--verbose` 在树行下展开每个 span：状态（失败时带错误消息）、计时、ids、每个 attribute（prompts、responses 和工具负载作为 transcript 或 pretty-printed JSON），以及每个带 span 开始偏移的 span 事件。`--json` 把同样的记录打印为 JSON，每个选中的 trace 一个对象。

子智能体保留自己的 session id，但记录到 dispatch 时它的父级打开的 trace，所以被委派的工作出现在引起它的 session 下，标记为 `agent.root.session.id`。任一 session id 都能解析到那个 trace。远程 Agent 在自己的部署下 trace，不在这里记录。

长得超出单个 trace 的 session——远比你在本地驱动的任何东西都长——会继续进入新 trace。每个都是一个 session window，从 `agent.session.window` 上的零开始编号；传 session id 会显示它产生的每个 window（最旧的在前），trace id 只显示那个 window。

一个父 turn 可以把几个子智能体 dispatch 进同一个 window，所以子级的 turn spans 命名了 dispatch：`agent.parent.session.id`、`agent.parent.turn.id` 和 `agent.parent.call_id` 标识创建子级的工具调用，`agent.subagent.name` 标识它调用的子智能体。顶级 session 不带这些。

除 `agent.session` 外每个 span 都携带真实时长：空闲 session 从不关闭，所以它被记录为零时长标记，span 树显示它的后代范围。Turn 的 span 在 turn settle 时写入，所以运行中的 turn 只显示它的 steps。

模型和 `execute_tool` spans 默认不携带输入和输出。设 `EVE_TRACES_CONTENT=on` 才会捕获模型的 system prompt、prompt messages 和响应文本，以及工具的调用参数和结果。每条捕获值上限 32 KB。

Step spans 携带 token 计数，Vercel AI Gateway 服务调用时携带 cost。两者都遵循 [OTel GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai)（`gen_ai.usage.*`），所以第三方后端无需映射即可读取。

### 保留（Retention）

eve 在 session 完成和 dev server 启动时清扫存储，超过以下界限时最旧优先驱逐——除了最新 traces 和过去五分钟内写入的任何东西总是保留，所以清扫会超过大小预算而不是丢弃你刚记录的 trace。在 `.env.local` 中设置界限，`eve dev` 会自动加载；每个都接受 `off` 单独禁用。

| 变量 | 默认 | 效果 |
| --- | --- | --- |
| `EVE_TRACES` | on | `off` 停止写 traces 并停止清扫 |
| `EVE_TRACES_CONTENT` | off | `on` 在本地 spans 上捕获模型 prompt/response 和工具 input/output attributes |
| `EVE_TRACES_MAX_AGE_MS` | `604800000`（7d） | 超过该年龄的 trace 可能被驱逐 |
| `EVE_TRACES_MAX_TOTAL_BYTES` | `536870912`（512 MB） | 整个存储的大小预算 |
| `EVE_TRACES_RETAIN_COUNT` | `20` | 无论年龄或大小都保留的最新 traces |

## `eve link`

```sh
eve link
```

把当前目录关联到 Vercel 项目。选择 team 后，你可以创建以 Agent 命名的项目，或关联现有项目。现有项目选择器显示最近的项目；输入项目名并选择 **Search for ''** 搜索该 team 的其余项目。Vercel 关联解析后的项目，eve 校验它的 project ID，然后拉取项目的环境，让 AI Gateway 凭证（`VERCEL_OIDC_TOKEN` 或 `AI_GATEWAY_API_KEY`）落进 `.env.local`。再次运行会重新关联：选择器总是运行，新选择胜出。命令仅交互式；在 CI 中改用 `vercel link --project <name> --yes --non-interactive`。运行中的 `eve dev` 会自动重载 env 文件，所以拉取后不需要重启。

## `eve deploy`

```sh
eve deploy
```

把 Agent 部署到 Vercel 生产环境（`vercel deploy --prod`），先安装依赖，之后拉取环境变量。已关联的项目带或不带 TTY 都能部署（非交互式运行传非交互式 `vercel` flags）。有终端时，未关联的部署会在需要时登录 Vercel，然后走 `eve link` 选择器；否则带指引退出。

## `eve eval`

```sh
eve eval [evalId...] [--url <url>] [options]
```

未给 eval ids 时运行所有发现的 evals；ids 精确匹配或按目录前缀匹配（`eve eval weather` 运行 `evals/weather/` 下的一切）。每个 eval 通过检查时退出 `0`，任何 eval 失败（失败的检查、执行错误或 `--strict` 阈值未达）时退出 `1`，配置错误时退出 `2`。

| Flag | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `--url <url>` | string | none | 远程 Agent URL（跳过本地 host 启动） |
| `--tag <tag...>` | string | none | 只运行带某 tag 的 evals |
| `--exclude-tag <tag...>` | string | none | 跳过带某 tag 的 evals |
| `--strict` | flag | off | 低于阈值的分数也影响退出码 |
| `--list` | flag | off | 打印被 tag 过滤器选中的 evals，不运行 |
| `--timeout <ms>` | number | none | 每个 eval 的超时毫秒数 |
| `--max-concurrency <n>` | number | 8 | 最大并发 eval 执行 |
| `--json` | flag | off | 以 JSON 输出结果 |
| `--junit <path>` | string | none | 把 JUnit XML 结果写入文件 |
| `--skip-report` | flag | off | 跳过 eval 定义的 reporters（例如 Braintrust） |
| `--verbose` | flag | off | 把每个 eval 的 `t.log` 行流到 stdout |

编写 evals 见 [Evals](../evals/overview)。

## `eve channels list`

```sh
eve channels list [--json]
```

列出当前项目中用户编写的渠道。

| Flag | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `--json` | flag | off | 以 JSON 输出 |

## 推荐循环（Recommended loop）

1. 编辑 `agent/` 下的文件。
2. `eve info` 确认发现或读取诊断。
3. 本地迭代时 `eve dev`。
4. 发布前 `eve build`。
5. `eve start` 本地冒烟测试构建输出。

相关：[Project layout](./project-layout) · [instrumentation.ts](../guides/instrumentation)。

## 接下来读什么（What to read next）

- [Project layout](./project-layout)：`eve info` 发现什么
- [instrumentation.ts](../guides/instrumentation)：tracing 和错误目录
- [部署（Deployment）](../guides/deployment/overview)：生产环境中的 `eve build` 和 `eve start`
