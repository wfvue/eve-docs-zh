---
title: "安全模型（Security Model）"
description: "eve 的信任边界、secret 存放位置、凭证如何到达 host，以及默认 fail-closed 的内容。"
---

# 安全模型（Security Model）

你的 eve Agent 运行在两种上下文里，之间有信任边界，每个 secret 都留在可信侧。在决定 Agent（以及驱动它的模型）允许触达什么时，用这个心智模型。

## 信任边界（Trust boundaries）

| | App runtime | Sandbox |
| --- | --- | --- |
| `process.env` / secrets | 是 | 否 |
| 你的 Node.js 代码 | 是 | 否 |
| 网络 | 不受限制 | 由策略控制 |
| 文件系统 | 应用自己的 | 隔离的 `/workspace` |

App runtime 是可信侧。你的工具实现、模型调用、connections、state 和 durable execution 都运行在这里，有 `process.env` 和完整 Node.js 可用。（在 Vercel 上，这是一个 Vercel Function。）

Sandbox 是隔离侧。模型通过内置 `bash`、`read_file`、`write_file`、`glob` 和 `grep` 工具在那里运行 shell 命令。它有自己的 `/workspace` 文件系统，但没有 `process.env`、没有 secrets、没有回到 app runtime 的路径。（在 Vercel 上，每个 sandbox 是一个带硬件级隔离的 [Vercel Sandbox](https://vercel.com/docs/sandbox) microVM。）只有 shell 命令在 sandbox 里执行。即使是内置的 `bash`/`read_file`/`write_file` 工具也活在 app runtime 里，并*代理*进 sandbox。模型看到的是工具定义和结果，绝不是你的 secrets。

一条具体的踪迹让边界清晰。当模型调用自定义 `charge_card` 工具时，它的 `execute` 在 app runtime 运行，读取 `process.env.STRIPE_KEY`，调用 Stripe，并返回 `{ ok: true }`。模型只看到 `{ ok: true }`：key 从不离开 app runtime，调用也不碰 sandbox。内置 `write_file` 是镜像：它在 app runtime 运行，把写入代理进 sandbox 的 `/workspace`。无论哪种方式，模型都通过工具调用和它们的结果驱动工作，从不持有凭证或直接触达 runtime。

eve 如何连接这两种上下文、同时保持它们的状态和生命周期分离，见 [Agent loop and sandbox](./execution-model-and-durability#agent-loop-and-sandbox)。

## 数据流一览

eve 把数据发往你的 Agent 配置和 runtime 选择所指向的地方：

- 入站 channel 数据流经你配置的渠道 provider，然后进入 eve app runtime。
- 模型输入和输出流向 `agent.ts` 中选择的模型或路由路径，比如 Vercel AI Gateway 模型 id 或 provider 编写的 `LanguageModel`。
- 工具和 connection 调用流向你配置的外部服务、MCP servers、OpenAPI 端点和渠道。
- Sandbox 命令可以到达 sandbox 网络策略允许的网络目的地。
- 遥测和 eval 数据流向你在 `instrumentation.ts` 或 eval 设置中配置的 exporters 和 providers。

eve 存储恢复对话、流式事件、重放已完成步骤和展示运行可观测性所需的 durable session 和 workflow state。你有责任决定所选渠道、模型 providers、连接的服务、sandbox egress 目的地、遥测 exporters、保留设置和删除控制是否适合你的数据和使用场景。

## 凭证代理（Credential brokering）

当没有 [tool](../tools) 或 [connection](../connections) 可以路由时，凭证代理给模型从 sandbox 内部提供*已认证*的网络访问，比如私有仓库的 `git clone` 或已认证的 `curl`。在 Vercel Sandbox 后端，认证头会在 sandbox 的网络防火墙处为匹配的域名注入。Secret 留在 app runtime；sandbox 进程只看到响应。平台机制见 [Vercel Sandbox Credential Brokering](https://vercel.com/docs/sandbox/concepts/firewall#credentials-brokering)，eve 策略 API 见 [Sandbox](../sandbox)。

## 连接凭证（Connection credentials）

[Connection](../connections) tokens（MCP 和 OpenAPI）来自 `getToken()` 或交互式 OAuth 流程，eve 会把解析后的 token 注入每个出站请求。Token 按 step 缓存，从不序列化进 durable state。

## 渠道校验（Channel verification）

[Channel](../channels/overview) 是你 Agent 的前门，所以认证入站流量是它的工作。内置平台渠道遵循两条规则，你自写的任何渠道也必须如此：

- **常量时间校验签名。**平台渠道（Slack、GitHub、Telegram、Twilio）用常量时间比较校验平台对原始请求体的 HMAC 签名，所以对响应计时无法暴露伪造签名。对任何你检查的 secret 用常量时间比较，绝不要用 `===` 比较签名。
- **不要信任 body 提供的身份。**从*已校验的*签名或 token 派生调用者，绝不从请求体声称的 `principalId`（或类似字段）派生。Body 字段是攻击者控制的；把它当作身份就是跨用户冒充。

接受 dashboard 风格 webhooks 的自定义渠道应该遵循同样的形状：用 HMAC 认证原始 body、常量时间比较签名，并且只在签名校验通过后信任 body 提供的 principal。

## Author 的 markdown 是数据

[Skill](../skills) 和 [schedule](../schedules) 文件是带 YAML frontmatter 的 markdown，eve 严格把 frontmatter 当作数据。支持代码的引擎（`---js` / `---javascript`，会在文件解析的瞬间 `eval()` frontmatter body）被禁用，所以这样的 fence 会抛错而不是运行。Frontmatter 必须解析为普通 YAML 对象。

## 认证 fail-closed

路由默认拒绝未认证流量。如果 walk 中没有 `AuthFn` 接受请求，就得到 `401`，允许匿名调用者需要显式的 `none()`。脚手架里的 `placeholderAuth()` 让半配置的应用在生产环境保持关闭，直到你替换它。完整的 walk 和 verifiers 见 [鉴权与路由保护（Auth & route protection）](../guides/auth-and-route-protection)。

## 上线前检查清单

把 Agent 暴露给真实流量之前：

- 把 `agent/channels/eve.ts` 中的 `placeholderAuth()` 替换成真正的 `AuthFn`（`vercelOidc()`、`httpBasic()`、`oidc()` 或你自己的）。验证未认证的生产请求得到 `401`。
- 校验渠道签名。每个平台渠道都需要设置它的 signing secret；自定义渠道必须常量时间校验签名，并且绝不信任 body 提供的身份。
- 把 secrets 放在 `process.env` 里，绝不放进编译产物，绝不传入 sandbox。把特权调用路由到 tools 或 connections。
- 把 connection tokens 限制到 Agent 需要的最小权限；它们能触达 host，但绝不到达模型。
- 如果模型不该有开放 egress，把 sandbox 网络策略设得比 `allow-all` 更紧；对已认证 egress 使用凭证代理。
- 不要以 markup 形式暴露不可信文本。渲染进渠道 UI 的模型或用户控制字符串，应该为该表面转义。

## 接下来读什么（What to read next）

- [鉴权与路由保护（Auth & route protection）](../guides/auth-and-route-protection)：完整的 auth walk 和 verifier helpers
- [Sandbox](../sandbox)：后端、网络策略和代理配置
- [执行模型与持久性（Execution model and durability）](./execution-model-and-durability)：durable session 如何运行
- [连接（Connections）](../connections)：静态 token 和 OAuth connections
- [Responsible use](../responsible-use)：上线前要审查的部署者责任和安全措施
