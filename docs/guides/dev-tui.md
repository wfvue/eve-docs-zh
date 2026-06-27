---
title: "开发终端界面（Dev TUI）"
description: "在交互式终端 UI 中驱动 Eve Agent：聊天、流式输出、审批工具、回答问题、调整展示，并连接部署环境。"
---

# 开发终端界面（Dev TUI）

`eve dev` 会启动本地 runtime，并进入交互式终端 UI。你可以和 Agent 聊天，观察流式输出，审批工具调用，也可以回答 Agent 反问的问题。

```bash
eve dev
```

启动时，TUI 会打印 Agent 名称和一条轮换 tip。本地 session 示例：

```text
 eve weather-agent
 Use /channels to add more ways to reach your agent.
```

如果 discovery 报告了问题，错误和警告数量会显示在这两行之间。Instructions、tools、skills 和 subagents 都可以通过 `eve info` 查看，`/help` 会列出所有命令。TUI 也会执行 startup check。新鲜的 `eve init` 项目在本地 `eve dev` 时会预填 `/model`，引导你安装 Vercel CLI、登录并配置模型。其它 `eve dev` sessions 会把缺失配置显示为 attention line，并把每个命令的结果挂在 `⎿` 下。

## 阅读 transcript（Reading the transcript）

对话会直接流入终端原生 scrollback，所以你可以使用终端自己的滚动、复制粘贴，并在退出后保留 transcript。Scrollback 会包含 prompts、Agent 回复、reasoning、tool calls、嵌套 subagents、connection authorization prompts，以及捕获到的 `stdout`、`stderr` 和 sandbox lifecycle lines。

每个 turn 不会用 box 包起来。彩色 gutter glyph 表示说话方，tool calls 会折叠成一行 summary，例如 `✓ get_weather  city="SF" → 73°F`。Subagent 的工作会缩进到 `◆` header 下方。当可以输入时，prompt 保持裸露；Agent 等待响应时会显示绿色圆点脉冲，reasoning 或 answer 内容开始后消失。

Prompt 或 status 下方的持久行会显示 model、session token flow、已链接的 Vercel project，以及 channel 添加后还未 `/deploy` 时的黄色 `/deploy pending`。本地 session 显示灰色 `:port` badge，远程 session 显示 `↗ project (environment)` 或 host。错误会紧凑显示，并高亮 docs links；Agent 自身代码抛出的 bug 会把 stack trace 以 dim 样式显示在错误标题下方。

## Slash commands（Slash commands）

每个 slash command 会以 invocation line 回显，通过临时 panel 提问，然后以一行 `⎿` 结果结束。Loading states 会放在 ephemeral status line 上，而不是反复堆到 transcript 中。

| Command | 作用 |
| --- | --- |
| `/model` | 打开模型和 provider 配置菜单。见 [配置模型和 provider](#配置模型和-providerconfigure-the-model-and-provider)。 |
| `/channels` | 展示 Agent channel 列表，并添加所选 channel。见 [添加 channel](#添加-channeladd-a-channel)。 |
| `/connect` | 展示 Vercel Connect MCP catalog，并配置所选 server。见 [添加 connection](#添加-connectionadd-a-connection)。 |
| `/deploy` | 把 Agent 发布到 Vercel production，未链接目录时会先链接。 |
| `/vc:install` | 安装 Vercel CLI。本地和远程 session 都可用。 |
| `/vc:login` | 本地登录 Vercel。远程 session 中会解析部署项目、刷新 OIDC token，并确认 Trusted Sources 规则。 |
| `/loglevel` | 切换 transcript 显示哪些 logs。见 [控制日志显示](#控制日志显示control-what-logs-show)。 |
| `/new` | 开始一个新 session。 |
| `/exit` | 退出 TUI。 |
| `/help` | 列出当前本地或远程 session 可用命令。 |

`/model`、`/channels`、`/connect` 和 `/deploy` 用来管理本地 Agent 或其已链接项目。它们只在 `eve dev` 本地启动 server 时可用；连接远程 server（`--url`）时不可用。

### 配置模型和 provider（Configure the model and provider）

裸 `/model` 会打开配置菜单。未配置 provider 时，会直接打开 provider picker，Esc 回到配置菜单。“Change model” 会打开可搜索 model picker，使用 Vercel AI Gateway catalog，并预选 runtime 当前服务的 model。模型变更会写入 Agent authored source，只有 Eve 确认新 id 后命令才报告成功。完成模型或 provider 变更后，菜单关闭并把结果写回 transcript。Done 或 Esc 不做变更直接关闭。`/model <provider/model-id>` 可以跳过菜单直接应用。

Provider 行会打开三类菜单：通过 project 使用 AI Gateway、通过 `AI_GATEWAY_API_KEY` 使用 AI Gateway，或 **Other providers**。Key 选项高亮时会变成 masked input。输入会被验证，失败时显示 `Invalid key`，成功后保存到 `.env.local`。Project 选项会选择 Vercel team、打开该 team 最近 projects，并支持搜索较旧项目。Vercel 会链接所选 project，Eve 验证 project ID，然后把环境写入 `.env.local`。Dev server 会自动重新加载 env files 和刷新 status bar，不需要重启。

### 添加 channel（Add a channel）

`/channels` 会展示 Agent 的 channel 列表。已注册 channels 会显示为 checked，并带有 “Already installed” 提示。选择某个 channel 会添加它，包括 Slack Connect provisioning，并安装 scaffold 新增的依赖，让 dev server 立刻能加载新 channel。每次添加后列表会重新渲染，直到 Done 或 Esc 退出流程。

### 添加 connection（Add a connection）

`/connect` 会展示 Vercel Connect 可用的 MCP servers 搜索列表。已 authored connections 会保持 checked。未登录用户会被引导到 `/vc:login`。目录未链接时，选择 server 会打开和 `/model` 相同的 team / project 流程，可以创建 project 或链接已有项目。

对于所选 server，Eve 会先尝试附加 provider canonical connector。如果失败，可以从搜索列表中选择已有 connector，或使用指定名称创建一个。成功后会写入 `agent/connections/<name>.ts`，记录 attached connector UID，并安装新依赖，让 dev server 能加载它，然后返回主 prompt。

## 键盘快捷键（Keyboard shortcuts）

Chat 和 freeform `ask_question` 输入像 shell line editor 一样工作。

| Key | Action |
| --- | --- |
| `Enter` | 提交消息或 question response。 |
| `Shift+Enter` | 插入换行，不发送。需要终端支持 modified keys。 |
| `Ctrl+C` | 中断正在运行的 turn；在输入框有内容时清空；空输入时退出。 |
| `↑` / `↓` | 在输入行之间移动；到达 chat buffer 边缘时，浏览本 session 中发过的消息。 |
| `←` / `→`, `Home` / `End`, `Ctrl+A` / `Ctrl+E` | 移动光标；Home/End 保持在当前行内。 |
| `Ctrl+U` / `Ctrl+K` / `Ctrl+W` | 删除到行首、行尾或前一个词。 |
| `Ctrl+L` | 循环日志展示模式：`none → all → stderr → sandbox → none`，并短暂显示当前模式。 |
| `Ctrl+R` | 重绘屏幕。 |

支持 bracketed paste 的终端中，粘贴多行文本会保持多行插入，不会在第一行自动提交。`Shift+Enter` 可以手动添加换行。输入框会向下增长直到可用终端高度，然后滚动保持光标可见。

如果某个 turn terminally failed，例如 server session 死亡或连接断开，TUI 会开始一个新 session，并在行内提示你可以继续。旧 session 的 server-side context 会重置。

## 内联回答 Agent（Answer the agent inline）

当 Agent 需要你补充信息时，TUI 会在内联位置提问：

- Tool approvals 使用 `y` 或 `n`。
- Option questions 可以用 `↑` / `↓` 和 `Enter` 选择，也可以写多行 freeform answer。
- 如果某个 tool 需要授权 [连接（Connections）](../../connections)，URL 会直接显示在 transcript 中。你完成浏览器授权后，turn 会继续。这个回调 route 由本地 `eve dev` server 持有，所以授权期间保持命令运行。`eve dev --url` 连接已有 server，不会启动本地 callback host。

## 控制日志显示（Control what logs show）

默认情况下，`eve dev` 显示 `stderr`，并缓冲但隐藏 stdout 和 sandbox lines。捕获的 server `stdout` / `stderr` 会以 dim、缩进的 log runs 显示，sandbox lifecycle lines 使用自己的 label。

- `/loglevel <all|stderr|sandbox|none>` 会切换 transcript 显示内容，并 retroactively 生效。裸 `/loglevel` 显示当前模式。
- `--logs <all|stderr|sandbox|none>` 设置启动时模式，默认 `stderr`。
- `Ctrl+L` 在 idle prompt 下循环 `none → all → stderr → sandbox → none`。

## 展示参数（Display flags）

Density flags 控制每个 section 渲染多少内容。可选值是 `full`、`collapsed`、`auto-collapsed` 或 `hidden`。

```bash
eve dev --tools full --assistant-response-stats tokens --context-size 200000
```

| Flag | Values | Effect |
| --- | --- | --- |
| `--tools <mode>` | `full` / `collapsed` / `auto-collapsed` / `hidden` | tool calls 如何渲染，默认 `auto-collapsed`。 |
| `--reasoning <mode>` | `full` / `collapsed` / `auto-collapsed` / `hidden` | reasoning 如何渲染，默认 `full`。 |
| `--subagents <mode>` | `full` / `collapsed` / `auto-collapsed` / `hidden` | subagent sections 如何渲染。 |
| `--connection-auth <mode>` | `full` / `collapsed` / `auto-collapsed` / `hidden` | connection authorization 如何渲染。 |
| `--assistant-response-stats <mode>` | `tokens` / `tokensPerSecond` | assistant header 展示哪种统计。 |
| `--context-size <tokens>` | token count | 模型上下文窗口大小，以 usage percentage 展示。 |
| `--logs <mode>` | `all` / `stderr` / `sandbox` / `none` | 展示哪些 server 和 agent logs，默认 `stderr`。 |

Connection flags：`--host` 和 `--port` 用来绑定本地 server，`--no-ui` 以 headless 方式运行。当 stdout 不是 TTY 时，也会自动 fallback 到 headless。完整参数见 [CLI](../../reference/cli)。

## 远程模式：`eve dev <url>`（Remote: `eve dev <url>`）

传入 URL 后，TUI 会和正在运行的部署通信，而不是启动本地 server。这适合 Vercel preview 或 production smoke test。

```bash
eve dev https://<your-app>
```

裸 URL 是 `--url` 的简写，不能和 `--host`、`--port` 或 `--no-ui` 组合。

启动时，TUI 会请求 Vercel 在当前 scope 下解析远程 origin。解析成功后，可以获取 project-scoped OIDC token，或使用 automation-bypass secret。无法解析的 host 会匿名 probe。随后 TUI 请求 `/eve/v1/info`，超时 10 秒。成功响应表示 remote ready。Eve OIDC challenge、Vercel Deployment Protection challenge 或 `TRUSTED_SOURCES_ENVIRONMENT_MISMATCH` 会自动打开 `/vc:login`；普通网络失败和 server errors 仍然是 remote availability errors，不会启动 auth flow。Esc 或 Ctrl-C 会取消鉴权流程。

远程 session 中的 `/vc:login` 会先从 URL 解析部署所属 Vercel project。如果当前 scope 无法解析，会询问另一个 team，并在该 team scope 中重新查找。CLI 未登录时，会先走浏览器登录。该流程会在添加所需 Trusted Sources rule 前询问你，并通过 `@vercel/oidc` 获取 project-scoped token；不会重新链接目录，也不会修改 `.env.local`。最后会重试 `/eve/v1/info`，证明凭据可用。

`VERCEL_AUTOMATION_BYPASS_SECRET` 仍可用于 Protection Bypass for Automation token。Smoke test 流程见 [部署（Deployment）](../deployment)。

## 接下来读什么（What to read next）

- [可观测性（Instrumentation）](../instrumentation)：OpenTelemetry、run tags 和常见失败
- [CLI](../../reference/cli)：所有命令和参数
