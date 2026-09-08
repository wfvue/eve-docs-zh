---
title: "运行分析（Run Analysis）"
description: "Build an Agent 教程第 4 步：把示例库 schema 播种进 sandbox workspace，然后在 SQL 之外计算和绘图。"
---

# 运行分析（Run Analysis）

SQL 告诉分析助手数字，但队列曲线、预测或图表需要真正的计算。这就是 sandbox 的用途。它是一个带 `/workspace` 文件系统的隔离 bash 环境，每个 Agent 恰好有一个。

这需要两块。先把模型可以读的参考文件播种进去，然后在它们之上计算。

## 把 schema 播种进 workspace

把示例库 schema 挂载进 sandbox，让模型不用猜测表结构。播种使用文件夹 sandbox 布局，其中 `agent/sandbox/workspace/` 下的任何东西在 session bootstrap 时落到活跃 `/workspace` cwd。

```txt
agent/sandbox/
  workspace/
    schema.sql        ← lands at /workspace/schema.sql
    notes/grain.md    ← lands at /workspace/notes/grain.md
```

```sql
-- agent/sandbox/workspace/schema.sql
-- Reference only: table shapes the analyst can read before writing queries.
CREATE TABLE orders     (id INTEGER, customer_id INTEGER, amount_cents INTEGER, created_at TEXT);
CREATE TABLE customers  (id INTEGER, name TEXT, plan TEXT);
```

顶层 workspace 条目会自动宣传给模型，所以它知道 `schema.sql` 在那里可以读。`workspace/` 文件夹可以播种文件而无需 sandbox 定义。下一步再补定义，以便安装图表依赖。

## 安装图表依赖

Python 需要能跑真实二进制的 sandbox。本地开发请启动 Docker 兼容守护进程，并用 `docker info` 确认可达，再重启 `npm run dev`。eve 在兼容主机上也支持 [microsandbox](../sandbox#microsandbox)。`just-bash` 回退不能跑 Python 或装包；只在笔记本上安装 Python 不会进入 sandbox。若暂时不想配本地容器/VM，可以[先跳到下一章](./remember-definitions)。

Docker、microsandbox 与 Vercel Sandbox 的默认 eve 镜像含 Python，但不含 matplotlib。在 `workspace/` 旁加这个定义，把 matplotlib 装进虚拟环境。安装与绘图共用同一环境，不改动系统 Python：

```ts title="agent/sandbox/sandbox.ts"
import { defineSandbox } from "eve/sandbox";

export default defineSandbox({
  async bootstrap({ use }) {
    const sandbox = await use();
    const commands = [
      "sudo apt-get update && sudo apt-get install -y python3 python3-venv",
      "python3 -m venv /workspace/.venv",
      "/workspace/.venv/bin/python -m pip install matplotlib==3.10.8",
      "/workspace/.venv/bin/python -c \"import matplotlib.pyplot; print('Chart dependencies ready')\"",
    ];
    for (const command of commands) {
      const result = await sandbox.run({ command });
      if (result.exitCode !== 0) {
        throw new Error(
          `Chart setup failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`,
        );
      }
    }
  },
});
```

Bootstrap 在 eve 构建 sandbox 模板时运行，session 继承已安装环境。首次构建需要访问 Ubuntu 包仓库与 PyPI 的网络。跟本例时保持默认网络策略；自定义 `deny-all` 或 allow-list 必须在 bootstrap 期间允许这些下载。部署到 Vercel 后，同一份定义会使用 Vercel Sandbox。

添加定义后重启 `npm run dev`。要图表前，先在 TUI 发这条消息：

```txt
Run /workspace/.venv/bin/python -c "import matplotlib; print(matplotlib.__version__)" in the sandbox.
```

命令应打印 `3.10.8`。若 setup 失败，在 dev server 的 sandbox 日志里查失败命令。先解决包下载或后端错误再继续。

## 在 sandbox 中计算和绘图

内置 `bash`、`read_file` 和 `write_file` 工具已经瞄准 sandbox。写自己的分析步骤时，用 `ctx.getSandbox()` 拿活跃 handle：

```ts title="agent/tools/chart_series.ts"
import { randomUUID } from "node:crypto";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Plot a time series to a PNG in the workspace. Pass {date, value} points; " +
    "returns the chart path and PNG data for the client to save.",
  inputSchema: z.object({
    title: z.string().min(1).max(120),
    points: z
      .array(z.object({ date: z.string().max(40), value: z.number() }))
      .min(1)
      .max(366),
  }),
  async execute({ title, points }, ctx) {
    const sandbox = await ctx.getSandbox();
    const directory = `analysis/${randomUUID()}`;
    await sandbox.writeTextFile({
      path: `${directory}/series.json`,
      content: JSON.stringify({ title, points }),
    });
    await sandbox.writeTextFile({
      path: `${directory}/plot.py`,
      content: [
        "import json, matplotlib",
        "matplotlib.use('Agg')",
        "import matplotlib.pyplot as plt",
        "d = json.load(open('series.json'))",
        "plt.figure(figsize=(8, 4), dpi=100)",
        "plt.plot([p['date'] for p in d['points']], [p['value'] for p in d['points']])",
        "plt.title(d['title']); plt.savefig('chart.png')",
      ].join("\n"),
    });
    const root = sandbox.resolvePath(directory);
    const result = await sandbox.run({
      command: `cd ${JSON.stringify(root)} && /workspace/.venv/bin/python plot.py`,
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `Chart generation failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`,
      );
    }
    const chart = `${root}/chart.png`;
    const png = await sandbox.readBinaryFile({ path: chart });
    if (!png || png.byteLength === 0) {
      throw new Error("The chart command did not produce a PNG.");
    }
    if (png.byteLength > 1024 * 1024) {
      throw new Error("The chart exceeds the 1 MiB download limit. Plot fewer points.");
    }
    return { chart, pngBase64: Buffer.from(png).toString("base64") };
  },
  toModelOutput({ chart }) {
    return {
      type: "text",
      value: `Created ${chart}. The PNG is available in the tool result for the client to save.`,
    };
  },
});
```

工具使用 bootstrap 安装的 Python 环境。`matplotlib.use('Agg')` 选择无需桌面显示即可写 PNG 的渲染器。

`sandbox.run()` 即使命令失败也会返回退出码。返回图表路径前先检查 `exitCode`。从工具抛错会把失败命令输出（含缺失 Python 或 matplotlib import）交给模型，让它报告失败而不是声称图表已存在。

用第 3 步的示例数据要一张图：

```txt
Plot daily order revenue in dollars for May 2026.
```

模型用 `run_sql` 查每日合计，把 `amount_cents` 除以 100，并把 date/value 点传给 `chart_series`。示例数据有四个日期，收入分别为 $42、$15、$99、$8。图表与第 3 步查询的是同一份数据。

## 把图表保存到你的电脑

Sandbox 路径不是下载 URL，也不是你笔记本上的文件。`readBinaryFile` 把生成的 PNG 从 sandbox 拷进工具结果，供客户端使用。`toModelOutput` 只给模型一段短描述，避免 base64 填满上下文。TUI 把工具结果当文本显示，不会自动保存或预览这张 PNG。

在项目根创建下面的脚本。它通过与 TUI 相同的本地 HTTP API 请求图表，并把成功的工具结果存为运行目录下的 `chart.png`：

```ts title="save-chart.ts"
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "eve/client";
import { z } from "zod";

const host = process.argv[2];
if (!host) throw new Error("Usage: node save-chart.ts <dev-server-url>");

const client = new Client({ host });
const { response } = await client.sessions.create({
  message: "Use run_sql and chart_series to plot daily order revenue in May 2026.",
});
const turn = await response.result();
if (turn.status === "failed") throw new Error("The agent turn failed. Check the dev server logs.");
if (turn.inputRequests.length > 0) {
  const prompts = turn.inputRequests.map((request) => request.prompt).join("\n");
  throw new Error(
    `Session ${turn.sessionId} needs your input before it can create the chart:\n${prompts}`,
  );
}

const chartOutput = z.object({ pngBase64: z.string().min(1).max(1_398_104) });
let saved = false;
for (const event of turn.events) {
  if (event.type !== "action.result") continue;
  const result = event.data.result;
  if (result.kind !== "tool-result" || result.toolName !== "chart_series" || result.isError)
    continue;

  const { pngBase64 } = chartOutput.parse(result.output);
  const png = Buffer.from(pngBase64, "base64");
  if (
    png.byteLength > 1024 * 1024 ||
    !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    throw new Error("The tool result is not a PNG within the 1 MiB download limit.");
  }
  await writeFile("chart.png", png);
  saved = true;
}
if (!saved) {
  console.error(turn.message ?? "The agent returned no explanation.");
  throw new Error("No chart was returned. Check the agent's response above and sandbox setup.");
}
console.log(`Saved ${resolve("chart.png")}`);
```

保持 `npm run dev` 运行。在第二个终端用 dev server 打印的实际 URL 跑脚本，例如：

```sh
node save-chart.ts http://localhost:2000
```

用看图软件打开保存的 `chart.png`。这会创建与 TUI 对话不同的 session，并覆盖已有 `chart.png`。失败的工具调用或没有图表的 turn 会让脚本失败，而不是声称文件已保存。

本步不需要审批。若你在加完 [守护支出](./guard-the-spend) 的审批门禁后再回来，脚本会报告任何 pending 请求及其 session ID。先[通过 client 响应](../guides/client/messages#answer-human-input-requests)，再收集该 session 的图表结果。

同一 client 也可从托管 Agent 保存图表：传入部署 URL，并为该部署配置 [client 认证](../guides/client/overview#authentication)。文件保存在跑脚本的那台电脑上。在 Web UI 里消费同样的 `action.result` 输出即可做预览或下载控件。工具返回字节并不会自动加上那套 UI。

本例把图表限制在 1 MiB，因为工具输出会随 session 事件持久化。更大文件请拷到应用自己的文件存储，并返回经授权的下载 URL。Sandbox 文件本身不是永久产物存储。

## Secrets 不进入 sandbox

Sandbox 没有 `process.env`，也碰不到你应用的 secrets。`run_sql` 与示例库跑在应用里。你只把查询结果传给图表工具；sandbox 不需要数据库凭证。

本地后端在 `eve dev` 期间把 sandbox 跑在你的笔记本上；在 Vercel 上跑在 Vercel Sandbox。生命周期、后端和网络策略见 [Sandbox](../sandbox)。

→ 下一步：[记住定义（Remember definitions）](./remember-definitions)

了解更多：[Sandbox](../sandbox)
