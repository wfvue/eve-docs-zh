---
title: "沙盒（Sandbox）"
description: "Agent 的隔离 bash 环境：内置文件工具、播种的 /workspace、后端、生命周期与网络策略。"
---

# 沙盒（Sandbox）

沙盒是 Agent 的隔离 bash 环境：一个根在 `/workspace` 的文件系统，它可以在里面运行 shell 命令、执行脚本、读写文件，而绝不触碰你的应用 runtime。每个 eve Agent 恰好有一个。内置 `bash`、`read_file`、`write_file`、`glob` 和 `grep` 工具已经瞄准它，你编写的代码也可以。

默认就有一个可用的 sandbox，无需编写任何东西。只有在要添加设置、播种文件、选择后端或锁死网络时才覆盖它。

默认 sandbox 不能替代配置你的应用所需的网络策略、凭证、保留、删除或其他控制。

## 使用 sandbox

模型已经通过默认工具获得 shell 和文件访问：

| 工具 | 作用 |
| --- | --- |
| `bash` | 在 sandbox 里运行 shell 命令 |
| `read_file` / `write_file` | 读写 `/workspace` 下的文件 |
| `glob` | 按模式查找文件 |
| `grep` | 搜索文件内容 |

它们都以 `/workspace` 为工作目录运行。面向模型的文件工具接受绝对路径和以 `$HOME/` 开头的路径；eve 在读取、写入或搜索之前把后者在 sandbox 内解析。任何编写的 runtime 函数（工具、step、模型回调）都可以用 `ctx.getSandbox()` 拿到活跃 sandbox handle。

```ts title="agent/tools/run_analysis.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Run a Python analysis script and return its output.",
  inputSchema: z.object({ script: z.string() }),
  async execute({ script }, ctx) {
    const sandbox = await ctx.getSandbox();
    await sandbox.writeTextFile({ path: "analysis/run.py", content: script });
    const result = await sandbox.run({ command: "python analysis/run.py" });
    return { stdout: result.stdout };
  },
});
```

`ctx.getSandbox()` 不带参数、是异步的，只在编写的 runtime 执行中有效。

`/workspace` 在每一个后端上是同一个命名空间，所以无论后端是本地还是 Vercel，`/workspace/foo` 都指向同一个文件。当你需要把路径插值进生成的命令时，`sandbox.resolvePath("repo/build.py")` 把相对路径锚定到它绝对的 `/workspace/repo/build.py` 形式。

Handle 能做的比 `run` 和 `writeTextFile` 更多。每个方法里，相对路径从 `/workspace` 解析，绝对路径原样通过：

| 方法 | 作用 |
| --- | --- |
| `run({ command })` | 运行一个命令，阻塞到退出，返回 `{ stdout, stderr, ... }` |
| `spawn(options)` | 启动长运行进程（server、watcher）并返回 `SandboxProcess` handle |
| `readTextFile` / `writeTextFile` | 读写 UTF-8（或指定编码）文件；`readTextFile` 支持 1 基行范围 |
| `readBinaryFile` / `writeBinaryFile` | 读写原始字节（图片、归档、任何非文本） |
| `readFile` / `writeFile` | 以字节流式输入/输出文件 |
| `removePath({ path, force, recursive })` | 删除一个文件或目录；`force` 忽略缺失路径，`recursive` 移除非空目录 |
| `resolvePath(path)` | 把相对路径锚定到绝对 `/workspace/...` 形式 |
| `setNetworkPolicy(policy)` | turn 中途改变 egress 策略（后端相关；见 [网络策略](#network-policy)） |

因为 `run` 会阻塞到命令退出，当进程应该保持运行而 Agent 做其他工作时用 `spawn`：

```ts
const sandbox = await ctx.getSandbox();
const server = await sandbox.spawn({ command: "python -m http.server 8000" });
// ...do other work against the server...
await server.kill();
```

`SandboxProcess` 暴露 `stdout`/`stderr` 字节流、`wait()`（以退出码 resolve）和 `kill()`（幂等）。

`sandbox.id` 是稳定 per-session 标识符，跨重连到同一逻辑 session 保持不变。把它用作必须比单个 step 执行活得更久的 per-session state 的缓存键。

Option 类型（`SandboxSpawnOptions`、`SandboxReadBinaryFileOptions`、`SandboxWriteBinaryFileOptions` 等）与 `SandboxProcess` 一起从 `eve/sandbox` 命名导出。

## 播种 `/workspace`

把编写的文件放在 `agent/sandbox/workspace/` 下，在 session 启动时挂载进 sandbox。这需要文件夹布局（`agent/sandbox/sandbox.ts`），而不是顶层简写：

```txt
agent/sandbox/
  sandbox.ts        ← optional override (see below)
  workspace/
    schema.sql      ← lands at /workspace/schema.sql
    scripts/run.sh  ← lands at /workspace/scripts/run.sh
```

`workspace/` 下的每个文件都镜像进 sandbox cwd，结构保持不变，eve 会自动在 prompt 中把顶层条目列给模型。`agent/skills/` 文件在 `$HOME/.agents/skills/` 下单独物化，所以 `agent/sandbox/workspace/skills/...` 在你选择编写它时是普通 workspace 子树。

## 覆盖 sandbox

要添加设置、播种文件或选择后端，编写 `defineSandbox`。有两种布局：

- `agent/sandbox.ts`：简写。只需要定义、不需要播种文件时用它。
- `agent/sandbox/sandbox.ts`：文件夹布局。还要播种 `agent/sandbox/workspace/**` 时用它。两者都存在时，文件夹布局胜出。

```ts title="agent/sandbox/sandbox.ts"
import { defineSandbox } from "eve/sandbox";
import { vercel } from "eve/sandbox/vercel";

export default defineSandbox({
  backend: vercel({ resources: { vcpus: 2 } }),
  revalidationKey: () => "repo-bootstrap-v1",
  async bootstrap({ use }) {
    const sandbox = await use();
    await sandbox.run({ command: "sudo apt-get install -y jq" });
  },
  async onSession({ use }) {
    await use({ networkPolicy: "deny-all" });
  },
});
```

`defineSandbox` 和 `defaultBackend` 在 `eve/sandbox` 上。省略 `backend` 时 runtime 回退到 `defaultBackend()`（见 [后端](#后端)）。

## 后端

后端决定 sandbox 在哪里运行。eve 提供四个固定的工厂（来自嵌套 `eve/sandbox/*` imports）和一个可用性感知的默认（来自 `eve/sandbox`）：

| 后端 | 运行 sandbox 于 |
| --- | --- |
| `vercel()` | [Vercel Sandbox](https://vercel.com/docs/sandbox) 上。 |
| `docker()` | 本地 Docker 容器中，通过 `docker` CLI 驱动。 |
| `microsandbox()` | 本地轻量 [microsandbox](https://www.npmjs.com/package/microsandbox) VM 中。 |
| `justbash()` | 本地纯 JS `just-bash` 解释器中（无 daemon 或 VM，但也没有真实二进制）。 |
| `defaultBackend()` | 挑选最佳可用：托管 Vercel 上的 Vercel Sandbox → Docker → microsandbox → just-bash。 |

配置固定工厂会无条件使用那个后端。`docker()` 总是需要一个可达的 Docker daemon，`vercel()` 总是创建托管 sandbox（包括从本地 dev，带 Vercel 凭证）。

省略 `backend` 时 eve 使用 `defaultBackend()`，它在首次使用时按优先级解析：

1. 在 Vercel 上部署时（设置了 `process.env.VERCEL`）用 **Vercel Sandbox**，因为本地容器/VM runtime 在那里无法运行。
2. 通过 Docker 兼容的 `docker` CLI 可达 daemon 时用 **Docker**（Docker Desktop、OrbStack、Colima、Podman 的 docker 兼容 CLI；用 `EVE_DOCKER_PATH` 覆盖二进制）。
3. host 支持时用 **microsandbox**：Apple Silicon 上的 macOS，或带 KVM 的 glibc Linux。
4. 无依赖回退用 **just-bash**。

默认情况下，Docker 与 microsandbox 拉取 `ghcr.io/vercel/eve`，Vercel Sandbox 拉取 `vcr.vercel.com/vercel/eve/base`；镜像 tag 与已安装的 eve 版本一致。可用 `EVE_SANDBOX_IMAGE_TAG` 覆盖这些默认镜像的版本派生 tag。传给 `docker()`、`microsandbox()` 或 `vercel()` 的显式 `image` 优先。`vercel()` 上的 snapshot `source` 又优先于其 `image`，因为 Vercel Sandbox 把二者视为互斥。

在所有后端上，authored 命令以非 root 用户 `vercel-sandbox`、经非交互 `bash -lc` login shell 运行。`/workspace` 与 `$HOME` 可写，`$HOME/.local/bin` 在 `PATH` 上；`/usr/local` 等系统路径仍属 root。确需系统级变更时用免密 `sudo`；`sudo` 会重置环境，若特权步骤依赖 `NPM_CONFIG_PREFIX` 等变量，请显式透传。

`defaultBackend()` 也接受键控 bag，让每个内部后端得到自己的类型化 create options：

```ts
import { defaultBackend, defineSandbox } from "eve/sandbox";

export default defineSandbox({
  backend: defaultBackend({
    vercel: { networkPolicy: "deny-all", resources: { vcpus: 4 } },
    docker: { image: "ghcr.io/vercel/eve:latest" },
    microsandbox: { memoryMiB: 2048 },
  }),
});
```

### Docker

`docker()` 直接驱动 Docker CLI。默认基础镜像是 `ghcr.io/vercel/eve:latest`，eve 发布的 sandbox runtime 镜像。eve 在框架设置期间、编写的 bootstrap 代码运行之前创建 `/workspace` 并验证 Bash。通过 `docker({ image, env, pullPolicy, networkPolicy })` 配置它，并在 sandbox bootstrap 中安装编写的 runtime 工具，或通过自定义镜像提供。模板作为本地 Docker 镜像提交，当 sandbox source、seed 文件、`revalidationKey` 和 Docker 后端选项仍匹配时跨 session 复用。Session 作为长寿容器运行，其文件系统跨 turn 为同一 durable session 持久化 `/workspace` 变化。`eve dev` 在后台修剪过期的模板镜像。

### microsandbox

`microsandbox()` 在带快照备份模板、`vercel-sandbox` 用户和支持域名级网络策略与凭证代理的防火墙的轻量本地 VM 中运行每个 sandbox。它是托管 Vercel Sandbox 最接近的本地匹配。默认基础镜像是 `ghcr.io/vercel/eve:latest`，eve 发布的 sandbox runtime 镜像。框架设置期间，在编写的 bootstrap 代码运行之前，eve 验证 Bash 并创建 `/workspace` 和 sandbox 用户。在 sandbox bootstrap 中安装编写的 runtime 工具，或通过自定义镜像提供。支持的 host 是 Apple Silicon 上的 macOS，或带 KVM 的 Linux（glibc）。`microsandbox` npm 包和它的 VM runtime 不随 eve 捆绑，所以缺失时 `eve dev` 自动安装两者（用 `setup: { autoInstall: false }` 禁用）；生产进程会以可操作的安装错误失败。

### just-bash

`justbash()` 不需要 daemon 或 VM，但命令运行在带 `.eve/sandbox-cache/` 下虚拟文件系统的模拟 bash 里，没有真实二进制（`git`、`node`、包管理器），也没有网络隔离。`just-bash` 包是可选 peer dependency，所以缺失时 `eve dev` 自动把它安装进你的应用（用 `autoInstall: false` 禁用）；生产进程以可操作的安装错误失败。

你也可以写自己的后端。`SandboxBackend` 是带 `name`、`create` 和可选 `prewarm` 的 adapter 对象。它可以指向你自己的容器 runner、VM 池、内部 sandbox 服务或另一隔离层，只要返回 eve 需要的 `SandboxSession` 操作。`create` 返回的 handles 实现 `delete()`、`stop()` 和 `shutdown()`。见 `eve/sandbox` 上的 `SandboxBackend*` 类型。

## 生命周期（Lifecycle）

有两个 hooks，scope 不同：

- **`bootstrap({ use })`** 是模板 scope 的，在模板构建时运行一次。把每个后续 session 都继承的可复用设置放这里，比如克隆基线 repo、安装依赖或播种文件。调用 `use()` 拿 `SandboxSession`。只有模板文件系统 state 和支持的后端元数据会带进后续 session；网络策略等配置不会。如果外部输入影响 bootstrap 产出，设置 `revalidationKey: () => string` 让 eve 知道何时重建模板（编写的 sandbox source 和 seed 内容已经替你跟踪）。
- **`onSession({ use, ctx })`** 是 durable-session scope 的，每个 session 运行一次（sandbox 定义变化替换该 session 的 sandbox 时会再运行）。把 per-session 设置放这里，包括网络策略、资源、超时、per-user 凭证和一次性标记。因为它在活跃 runtime 上下文内运行，它可以读取 `ctx.session` 并派生当前 principal，而不把凭证烤进模板。调用 `use(opts?)` 拿 `SandboxSession`；`opts` 在 create 后流向后端的 update 路径。

如果你需要每个 session 的网络策略或其他配置，在 backend 工厂或 `onSession` 上配置；不要依赖仅 bootstrap 的配置。

```ts
import { defineSandbox } from "eve/sandbox";
import { vercel } from "eve/sandbox/vercel";

export default defineSandbox({
  backend: vercel(),
  async onSession({ use, ctx }) {
    const sandbox = await use({ networkPolicy: "deny-all" });
    const user = ctx.session.auth.current;
    if (user === null) return;
    await sandbox.writeTextFile({ path: "SESSION_USER.txt", content: `${user.principalId}\n` });
  },
});
```

Session 是持久的，底层 runtime 如何空闲取决于后端。Vercel 后端上，VM 在一段不活动后超时（默认 30 分钟）；eve 保留文件系统，并在持久 sandbox 仍可用时在下一条消息恢复 sandbox。Docker 后端为每个 durable session 保持长寿容器，在没有该超时的情况下跨 turn 持久化 `/workspace`，just-bash 后端在 `.eve/sandbox-cache/` 下存储它的虚拟文件系统。

编写的 runtime 回调可以通过 `ctx.getSandbox()` 返回的 handle 更早停止 compute：

```ts
const sandbox = await ctx.getSandbox();
await sandbox.stop();
```

每个内置后端都使用自己的原生生命周期操作，不删除 durable session。把 stop 当作当前回调里 sandbox 工作的结束。下一个回调时，`ctx.getSandbox()` 重新打开同一个 Docker 容器、microsandbox VM 或快照，或 just-bash 文件系统和环境。Vercel 也可以在它下一个 I/O 操作时自动恢复同一个 handle，就像不活动超时后那样。不需要单独的重连步骤或 stop 特定 state。Lifecycle `use()` 调用返回仅 I/O 的 `SandboxSession`，因为 bootstrap 和 session 初始化不拥有 runtime teardown。

### 删除 sandbox（Delete a sandbox）

从编写的 runtime 回调里永久删除当前 session sandbox：

```ts
const sandbox = await ctx.getSandbox();
await sandbox.delete();
```

eve 会先停 compute，再删除物理 sandbox 和它的一次性后端 state，并清掉已保存的 reconnect state。它保留包含 `bootstrap` 和 seeded workspace 文件的可复用模板 state。

Durable eve session 仍然活跃。下一次 `ctx.getSandbox()` 会按当前 sandbox 定义 provision 一份新 workspace，并再次运行 `onSession`。被删 sandbox 里的文件和其它 workspace 改动不会恢复。

后端行为不同：

- **Vercel Sandbox**：停止持久 sandbox、删除它的记录，并请求 Vercel 删除没有其它 sandbox 使用的 snapshots。Snapshot 清理是异步的。
- **microsandbox**：停止并移除 session VM 及其持久 state snapshot
- **Docker 和 just-bash**：停止 compute 并丢弃它们的 session runtime state

只有拥有共享 sandbox 的 session 能删除它。删除 owner 的 sandbox 会影响当前正在使用它的每个 parent 或 child。如果后端拒绝删除，eve 会保留当前 reconnect state，方便重试。

自定义 backend handles 在 `delete()` 里实现同一边界：移除 session runtime 和一次性持久 state，但不删除可复用模板。

Session sandbox 按 durable session 键控，不按部署，所以重新部署应用本身不会丢弃它们。编写的 sandbox source、workspace seed 内容或 `revalidationKey` 的定义变化会在下一个 turn 替换 sandbox 并再次运行 `onSession`。

重新挂载仍取决于后端保留物理 sandbox state。如果持久 Vercel sandbox 不再可用，eve 创建替代品，配置了模板时使用当前模板。原始 sandbox 创建后做出的文件和其他更改不会自动恢复。因为 durable session 仍有相同的 sandbox key，这个替代品不会再次运行 `onSession`。把重要 artifacts 持久化在 sandbox 之外，不要依赖 `onSession` 作为应用安全关键配置的唯一位置。

eve server 停止时，没有 sandbox compute 会活得比它长。`eve dev` 在 dev server 关闭时停止它启动的 sandbox，自托管生产 server 在关闭（`SIGTERM`/`SIGINT`）时停止每个打开的 sandbox。Session state 跨停止持久——下次 server 启动从它停止的容器、VM 或快照重新挂载每个 durable session。自定义 `SandboxBackend` adapters 为编写的 runtime 调用实现 `stop()`，为 server teardown 实现 `shutdown()`。两者都停止底层 compute，同时在后端支持时从持久 state 保持 session 可重新挂载；编写的 `stop()` 失败会 reject，而进程级 shutdown 收集并记录失败而不阻塞 teardown。

## 网络策略（Network policy）

Egress 规则放在 backend 工厂或 `onSession` 的 `use()` 上。有三种形式：

```ts
networkPolicy: "allow-all"; // default
networkPolicy: "deny-all"; // block all egress, including DNS
networkPolicy: {
  allow: ["ai-gateway.vercel.sh", "*.github.com"],
  subnets: { deny: ["10.0.0.0/8"] },
};
```

默认 egress 是 `allow-all`。对非公开、敏感、受监管或生产工作负载，在运行不可信工具或处理敏感数据之前配置 `deny-all` 或显式 allow-list。

在工厂上设置（`vercel({ networkPolicy: "deny-all" })`），它会在编写的 `bootstrap` 代码运行前生效；框架自有基础设置可能短暂保持 egress 打开以安装所需包。在 `onSession` 的 `use()` 里设置为 per-session 覆盖。同 sandbox key 的 provider-loss 替代品不会重跑 `onSession`，所以在工厂上强制安全关键基线。如果 `bootstrap` 需要网络访问，只给工厂它需要的 destinations，然后在 `onSession` 里进一步收窄策略。要 turn 中途改变策略，在活跃 handle 上调用 `sandbox.setNetworkPolicy(...)`。

`vercel()` 和 `microsandbox()` 支持域名级 allow-lists 和凭证代理。Docker 后端只遵循 `"allow-all"` 和 `"deny-all"`（创建时和通过 `setNetworkPolicy`）；just-bash 后端完全拒绝 `setNetworkPolicy`。

## 凭证代理（Credential brokering）

Secrets 从不进入 sandbox。相反，网络策略的 per-domain `transform` 在防火墙注入凭证，所以 header 可以向 host 认证 egress，而 secret 完全留在 sandbox 进程之外：

```ts
async onSession({ use }) {
  await use({
    networkPolicy: {
      allow: {
        "github.com": [{ transform: [{ headers: { authorization: "Basic your_base64_credentials_here" } }] }],
        "*": [],
      },
    },
  });
}
```

`"*": []` 兜底让一般 egress 保持打开，而 `transform` 只应用到 `github.com`。turn 中途代理时用同样的形状调用 `setNetworkPolicy`。[Vercel Sandbox docs](https://vercel.com/docs/sandbox) 覆盖代理机制本身。

## 接下来读什么（What to read next）

- [子智能体（Subagents）](./subagents)：每个子智能体有自己的 sandbox，独立于它的父级。
- [工具（Tools）](./tools)：编写的工具在应用 runtime 运行（完整 `process.env`）；只有 sandbox 工具在 sandbox 里运行。
- [安全模型（Security model）](./concepts/security-model)：完整的 app-runtime/sandbox 信任边界。
- [Vercel Sandbox](https://vercel.com/docs/sandbox)：平台文档，包括凭证代理和持久性限制。
