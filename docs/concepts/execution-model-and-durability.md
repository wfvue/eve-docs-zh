---
title: "执行模型与持久性（Execution Model and Durability）"
description: "eve session 如何运行：durable 对话、按 step 打点的 turn，以及稍后恢复的 parked work。"
---

# 执行模型与持久性（Execution Model and Durability）

eve session 是一次 durable 对话。它可以运行数天，并且在你不做任何工作的情况下扛过进程重启和重新部署。你编写能力（tools、instructions、channels），eve 运行循环。

官方原文：[Execution Model and Durability](https://eve.dev/docs/concepts/execution-model-and-durability)。

## Sessions、turns 和 steps

工作嵌套在三个层级：

- **session**：整段 durable 对话或任务；可跨很多请求、持续数天到数周而不丢上下文。
- **turn**：一条用户消息及其触发的全部工作（模型调用、工具、推理），直到 Agent 产出回复。
- **step**：turn 内的 durable checkpoint；默认含一次模型调用及其后的内联工具。

**每个 session 作为一条 durable workflow 运行**，构建在开源 [Workflow SDK](https://workflow-sdk.dev/) 上（部署到 Vercel 时用 Vercel Workflow）。session workflow 执行每个 turn，并在 step 边界打 checkpoint。你的代码跑在托管 step 里，所以 tools、sandbox、子智能体用起来像同步，但底层 session 是 durable 的。

实验性 [`workflow.modelCallsPerStep`](../agent-config#workflow-checkpoint-batching) 可把多次顺序模型-工具周期打进同一个 Workflow step，以减少 checkpoint 开销，但整组成为同一 replay 单元。

Workflow SDK 并不绑定 Vercel。本地开发与自托管 `eve start` 默认用 SDK local world（持久化在 `.eve/.workflow-data`，经同一套 Nitro workflow 路由分发）。在 Vercel 上，同一套 workflow 代码对接 Vercel Workflow，获得部署感知路由与 dashboard run 元数据。

### 部署 handoff（单 owner）

当 Vercel production 部署变更后，对**空闲** session 的新投递会把该 session 已 settle 的状态交给**接受该请求的那次部署**。无论经 session ID 还是 session 已认领的任意 channel continuation 地址都适用。session 保留原 ID 与事件流；下一模型 turn 使用该部署当前的 system-role instructions、model 与 tools。静态 user-role instructions 钉在 durable 历史里，不会再次 seed。成功的 handoff 会**重启**原先配置的 [`sessionTimeoutMs`](../agent-config#runtime-limits)；已关闭的超时保持关闭。失败或跳过的 handoff 保留现有截止。

接手前，目标部署会校验 checkpoint 里存储的 tasks / 子智能体 handles，并确认没有 pending 工作（含已 settle 的 tasks）。校验失败时，前一 owner 收回 session 并处理触发投递。task / handle 状态会保留未知 metadata 字段，但已知字段与生命周期规则必须仍有效。Authored session state 对该校验保持不透明。

eve **不会**在部署之间搬移活工作。有进行中 turn、pending 人类输入 / 授权、排队消息，或活跃 tasks / 子智能体的 session 留在当前部署。工作 settle 后，后续投递才可能移动空闲 session；更早的部署信号不会被记住。

### 从旧执行模型升级 session

可从「session driver + 独立 turn workflows」直接升级。当现有 driver 下一次向本部署分派 turn 时，eve 把已提交对话导入当前 runtime。session 保留 ID、历史、authored state、usage、limits 与原始事件流；后续 turns 使用新部署的 instructions / model / tools。

这是对 pending 工作的一次性中断：旧工具调用、子智能体、输入请求与授权尝试会被放弃（仍需要则重做）。只在旧 driver 内缓冲的消息不导入。触发消息会保留，且不重复已提交的工具副作用。

Import 支持 eve 0.45+ 启动的 driver；更旧 release 的 session 在下一条消息上报 inactive，channel 会开新 session。在这些 session 结束前请保留原部署：旧 driver 仍等待以保持原 streams；当前 runtime 拥有后续 turns。Import 会重启原配置的 session timeout。尚未到达下一次 turn dispatch 的 driver 尚未迁移。

不支持透明回滚到旧执行模型；回滚前请退役并重启受影响 session。

Nitro 托管 HTTP 路由与 workflow 入口，但不提供 workflow 状态存储或 sandbox runtime——那是独立适配器。高级自托管可在根 `agent.ts` 用 `experimental.workflow.world` 选择已安装的 Workflow world 包；密钥与部署选项放在该包读取的环境变量里，不要写进 `agent.ts`。

## Agent 循环与 sandbox

Agent 循环作为 durable workflow 跑在 app runtime；模型调用、工具 executors、hooks、instrumentation、connection 客户端也在那里，具备完整 Node.js 访问。App 侧经 `ctx.getSandbox()` 进入 sandbox；默认 `bash` / `read_file` / `write_file` 等走它。[Sandbox](../sandbox) 拥有 per-session 文件系统与进程。循环与 sandbox 生命周期解耦：workflow 可 park / 重启；app runtime 仅在需要时打开或复用 sandbox compute。Provider 密钥与连接凭据留在 app runtime；sandbox 进程需要认证网络时走 [credential brokering](./security-model#credential-brokering)。

## 崩溃后恢复（Resuming after a crash）

进程崩溃、超时或 turn 中途重新部署时，run 从**最后一个已完成 step** 继续，而不是重放整个 turn。已完成 step 永不重跑；eve 重放记录结果。中途打断的 step 会重跑，因此收费 / 发信等非幂等副作用请自备幂等或审批门。该 step 已写入 session stream 的内容仍在；重跑用新 id 再发事件，stream 消费者会看到两次尝试——见 [事件信封](./sessions-runs-and-streaming#the-event-envelope)。

`experimental.workflow.modelCallsPerStep` > `1` 时，被打断的 Workflow step 也可能重放同批更早的模型调用与内联工具；等待输入 / 授权 / 阻塞协调 / 确认后台任务之前仍会强制 checkpoint。

**Steering** 会等待当前批提交，再把已接受消息加入活跃 turn，然后进入下一次模型 step。增大 batch 也会拉长 steering 边界间隔。

持久性本身无需配置；checkpoint batching 是显式实验 opt-in。普通工具由 eve 管理 workflow；需要 timer / webhook / 人类回答等 durable wait 时用 [`defineWorkflowTool`](../tools/workflows)。

## Parked work

人类审批 [tool](../tools) 或 [connection](../connections) 的交互式 OAuth 等点上，turn 会 durable 地 park。Workflow 挂起、不持有 compute，直到等待的输入到达。

后台执行是关于结果投递的独立选择：后台 workflow 工具返回 task receipt，父 turn 可继续；工具自己的 workflow 可独立运行或挂起。默认 workflow 工具也可挂起，原 tool call 仍 pending。普通后台工具的 executor 仍在发起 step 内跑，设 `execution: "background"` **不会**获得 durable waits。

## 消息投递与 steering（Message delivery and steering）

eve **不为** session 维护 durable FIFO 用户消息队列。按 ID 的 HTTP 投递与按 channel 地址的投递都瞄准 session 当前的 command inbox。

同一时刻只有一个活跃 session 能拥有某个 channel continuation token。Channel 创建的 session 在处理首个 turn 前会认领稳定 session-ID inbox **与**初始 channel 地址；若另一 run 已拥有该地址则创建失败。**Aliasing** 给同一 session 追加 continuation 地址；此前认领的地址在 session 结束或 reset 前都保持有效。仅 ID 的 HTTP session 只有稳定 inbox、没有 channel 地址。冷启动争用同一地址时，落败候选会把已接受消息转发给 owner 后退出。

Channel 投递会先尝试 resume 地址再创建 session。Workflow 接受投递后，eve 再解析稳定 session ID——该查找不阻塞 workflow 恢复。含糊的投递失败**不会**触发创建 session。

handoff 进行中，地址会短暂无主；释放方为每个地址留下短命标记，落在该窗口的投递会重试直到后继认领，而不是报 inactive。因此 mid-handoff 的地址不会被 channel 开成替代 session。

session 在等待时，经其 ID 或任一已认领 channel 地址的投递会唤醒并启动下一 turn。消息发送默认 `turnPolicy: "steer"`：turn 活跃时，session owner 缓冲消息，在当前 workflow step 提交后应用。模型调用与工具工作安全完成；steering 以**同一 turn ID** 继续。发出 turn 完成事件前，owner 会检查该边界是否接受了 steering。

`turnPolicy: "queue"` 保留消息直到活跃 turn settle。owner 检查时若有多条就绪投递，eve 可按到达顺序折叠相邻消息进下一 turn。纯 `inputResponses` 不 steer，仍服务于被寻址的 pending 请求。

每个内置 / 自定义 channel 都接受默认 `turnPolicy`，命令式发送可覆盖。策略与消息同属一条 durable 投递命令。独立 session 仍独立运行。

## 子智能体（Subagents）

一个 turn 可以把工作交给 [subagent](../subagents)。每个子智能体有自己的上下文和 durable session；声明的子智能体还有自己的 sandbox、skills 和 state。边界上默认不隐式共享。

## 历史顺序

Session 内对话历史 append-only。静态 user-role instructions 领先新 session 历史；动态 user-role instructions 落在其 session / turn 边界、当前投递之前。Turns 与 turn 内工具调用 / 结果按发生顺序排列。

## 接下来读什么

- [Sessions 和 streaming](./sessions-runs-and-streaming)
- [安全模型](./security-model)
- [State](./state)
- [Workflows as Tools](../tools/workflows)
- [子智能体](../subagents)
