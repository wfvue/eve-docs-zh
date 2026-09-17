---
title: "开发终端界面（Dev TUI）"
description: "在交互式终端 UI 中驱动 Eve Agent：聊天、流式输出、审批工具、回答问题，并连接部署环境。"
---

# 开发终端界面（Dev TUI）

`eve dev` 会启动本地 runtime，并进入交互式终端 UI。你可以和 Agent 聊天，观察流式输出，审批工具调用，也可以回答 Agent 反问的问题。

官方原文：[Terminal UI](https://eve.dev/docs/guides/dev-tui)。

```bash
eve dev
```

页脚用圆点分隔显示当前模型与连接。Vercel 账户连接在 team slug 解析后显示；本地 server 端口不再出现在页脚。

退出后 transcript 仍留在终端 scrollback。当前 session 可用命令见 `/help`。

## 命令（Commands）

| Command | 说明 |
| --- | --- |
| `/login` | 连接 ChatGPT 订阅、Vercel 账户或 provider API key |
| `/model` | 选择模型与设置；也可 `/model provider/model-id` 直接设定 |
| `/add` | 搜索并安装 channels、MCP connections、extensions、可观测性集成；也可 `/add channel/slack` 直接装 |
| `/deploy` | 部署到 Vercel production；需要时会安装 Vercel CLI、登录并 link |
| `/info` | 显示解析后的应用、编译产物、discovery diagnostics、messaging routes |
| `/loglevel` | 选择 transcript 显示哪些 server / agent logs |
| `/traces` | 打开本地 trace 查看器；可传 trace ID 前缀 |
| `/reset` | 开始全新 session |
| `/cancel` | 取消当前 turn，不丢弃已结算上下文 |
| `/clear` | 清空 session 的模型消息历史；`/new` 是别名 |
| `/compact` | 压缩当前 session 上下文 |
| `/exit` | 退出 UI |
| `/help` | 列出可用命令 |

`/login`、`/model`、`/add`、`/deploy`、`/info`、`/traces` 仅在本地 `eve dev` 时可用；用 `--url` 连远程 server 时不可用。

## 设置新 Agent（Set up a new agent）

交互式 `eve init` 之后，TUI **直接打开**。eve 会保留项目已选连接。新连接时依次检查：显式环境凭据 → 已保存的机器默认 → Vercel CLI 当前 team。已有项目 OIDC 连接仍支持。自动复用 Vercel 时只校验账户访问，**不会**创建或 link 项目。

启动时 composer 保持可见，进度指示会点名正在检查的连接，并显示何时准备好聊天。可先打字按 `Enter` 排队；需要选择或 API key 时 picker 临时接管输入，草稿之后会回来。取消或失败时，排队消息回到草稿。

没有就绪连接时，`/login` 提供：

1. Vercel Account
2. Vercel AI Gateway API Key
3. ChatGPT Subscription
4. OpenAI API Key
5. Anthropic API Key

Vercel 账户登录会开浏览器。多个 team 时出现可搜索 team picker（高亮当前 project / CLI team）；只有一个 team 则自动选。自动启动复用已选连接时不会打开该 picker。账户 token 访问 Gateway 取决于账户与 team 可用性；不可用时请选 API key 或其它连接。

输入可过滤菜单，`Enter` 选择，`Esc` 回聊天。关掉设置菜单不会往 transcript 加取消消息；已完成的工作与失败仍会显示。也可用方向键。取消 login 会保留草稿。连接失败请再试 `/login`；eve **不会**静默换 provider。

### 凭据与部署

API key 与 eve 自有的 OAuth refresh 凭据经 just-secrets 存在 OS secret store。上次成功登录会存为机器默认；项目的连接与 team 作为非密钥元数据记在 `.eve/provider.json`。新输入的 key **不会**写入项目文件。经 `/login` 显式选中的 key 优先于 shell 里同 provider 的其它 key；用环境凭据连上的项目继续用环境。Vercel CLI 仍拥有自己的凭据与 refresh token。

本地 discovery 只在开发环境运行。部署需要显式配置 `AI_GATEWAY_API_KEY`、`OPENAI_API_KEY`、`ANTHROPIC_API_KEY` 或受支持的 project OIDC。ChatGPT 订阅模型仅本地。`/login` **不会** link 部署或给远程 server 鉴权；需要时由 `/deploy` 处理 Vercel CLI 安装与账户登录。

### 模型与设置

`/model` 打开模型选择与设置。每次完成选择立即生效并回聊天，没有最终 Done 步。成功的 login 或模型变更在下一条 prompt 生效。

OpenAI / ChatGPT / Gateway 默认 `gpt-5.6-luna-fast`；Anthropic 默认 `claude-sonnet-5`。已显式编写且兼容的模型会保留。新默认不可用时，eve 提供该连接上可用的模型。动态或自定义 model 表达式须在 `agent.ts` 里改。

## 添加集成（Add an integration）

`/add` 打开 channels、connections、extensions、integrations 的统一可搜索目录。输入过滤，`Enter` 安装一项并跑其必要设置，然后回聊天。

也可直接传地址：

```text
/add channel/slack
/add @acme/analytics
```

所选条目仍会跑必要的授权或部署设置。`Esc` 取消设置；已写入项目的文件会保留。

## 与 Agent 协作（Work with the agent）

打字后 `Enter` 发送。Agent 提问或请求工具审批时，在 UI 提示里回答。连接授权可能开浏览器；保持本地 `eve dev` 运行直到浏览器返回。

turn 进行中，`Enter` 会立刻把消息作为 **steering** 发送。助手输出开始前，runtime 打断待进行的模型生成，并在同一 turn 用你的校正继续。正在执行的 tools 会安全收尾。输出开始后，steering 在下一 workflow 边界应用，并保留已流式文本。

除 `/cancel`（直接取消）外，斜杠命令会等到 turn 结束。session 不支持 steering 时，消息排到下一 turn。无排队时，`Esc` / `Ctrl+C` 取消 turn；有排队时选最旧一条做 steering（或不支持时作下一 turn）。直接取消若未 settle，再按 `Ctrl+C` 停止等待；随后回到 prompt，再按一次退出。空闲 prompt 连按两次 `Ctrl+C` 退出。

| Key | 作用 |
| --- | --- |
| `Enter` | 发送消息；turn 进行中则 steer（或排队） |
| `Esc` / `Ctrl+C` | 取消 / 选择排队消息；见上文 |
| `Shift+Enter` | 换行（需终端支持 modified keys） |

更多键盘与 transcript 阅读习惯见官方页；本地也可继续用 `Ctrl+L` 循环日志模式（若当前构建仍暴露）。

## 连接远程部署

```bash
eve dev https://your-app.example.com
eve dev https://your-app.example.com -H 'Authorization: Bearer your_token_here'
```

远程 Vercel session 复用**已有**已授权 CLI session，不会打开账户登录流，也不会改本地项目的 Vercel link 或 `.env.local`。

若 Deployment Protection 挡住启动，eve 会校验目标项目，并在征得同意后为该部署环境加 Trusted Sources 开发访问规则；批准后应用规则并再次检查访问，再回聊天。取消会保留草稿；重试请再跑 `eve dev <url>`。若无法改项目策略，提供 `VERCEL_AUTOMATION_BYPASS_SECRET`，或请项目管理员在 Deployment Protection 里配置访问。

## 接下来读什么

- [快速开始](../getting-started)
- [Agent Files](../reference/agent-files)
- [CLI](../reference/cli)
- [部署到 Vercel](./deployment/vercel)
