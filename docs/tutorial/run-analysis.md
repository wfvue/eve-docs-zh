---
title: "运行分析（Run Analysis）"
description: "Build an Agent 教程第 5 步：把仓库 schema 播种进 sandbox workspace，然后在 SQL 之外计算和绘图。"
---

# 运行分析（Run Analysis）

SQL 告诉分析助手数字，但队列曲线、预测或图表需要真正的计算。这就是 sandbox 的用途。它是一个带 `/workspace` 文件系统的隔离 bash 环境，每个 Agent 恰好有一个。

这需要两块。先把模型可以读的参考文件播种进去，然后在它们之上计算。

## 把 schema 播种进 workspace

把仓库 schema 挂载进 sandbox，让模型不用猜测表结构。播种使用文件夹 sandbox 布局，其中 `agent/sandbox/workspace/` 下的任何东西在 session bootstrap 时落到活跃 `/workspace` cwd。

```txt
agent/sandbox/
  workspace/
    schema.sql        ← lands at /workspace/schema.sql
    notes/grain.md    ← lands at /workspace/notes/grain.md
```

```sql title="agent/sandbox/workspace/schema.sql"
-- Reference only: table shapes the analyst can read before writing queries.
CREATE TABLE orders (id INT, customer_id INT, amount_cents INT, created_at DATE);
CREATE TABLE customers (id INT, name TEXT, plan TEXT, signed_up_at DATE);
```

顶层 workspace 条目会自动宣传给模型，所以它知道 `schema.sql` 在那里可以读。不需要 `agent/sandbox/sandbox.ts`。`workspace/` 文件夹保留默认 sandbox 并把你的文件播种进去。

## 在 sandbox 中计算和绘图

内置 `bash`、`read_file` 和 `write_file` 工具已经瞄准 sandbox。写自己的分析步骤时，用 `ctx.getSandbox()` 拿一个活跃 handle：

```ts title="agent/tools/chart_series.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Plot a time series to a PNG in the workspace. Pass {date, value} points; " +
    "returns the chart path.",
  inputSchema: z.object({
    title: z.string(),
    points: z.array(z.object({ date: z.string(), value: z.number() })),
  }),
  async execute({ title, points }, ctx) {
    const sandbox = await ctx.getSandbox();
    await sandbox.writeTextFile({
      path: "analysis/series.json",
      content: JSON.stringify({ title, points }),
    });
    await sandbox.writeTextFile({
      path: "analysis/plot.py",
      content: [
        "import json, matplotlib",
        "matplotlib.use('Agg')",
        "import matplotlib.pyplot as plt",
        "d = json.load(open('series.json'))",
        "plt.plot([p['date'] for p in d['points']], [p['value'] for p in d['points']])",
        "plt.title(d['title']); plt.savefig('chart.png')",
      ].join("\n"),
    });
    const root = sandbox.resolvePath("analysis");
    await sandbox.run({ command: `cd ${JSON.stringify(root)} && python plot.py` });
    return { chart: `${root}/chart.png` };
  },
});
```

这个工具 shell out 到带 matplotlib 的 `python`，sandbox 基础镜像没有预装。在 sandbox bootstrap 中安装该 runtime（或烘焙进自定义镜像），让 `python plot.py` 能解析。bootstrap 在哪里运行见 [Sandbox](../sandbox)。

现在要求一些超出纯 SQL 的东西。如果你跳过了第 4 步，这仍然能在第 3 步的示例数据集上工作：

```txt
Plot total order revenue per customer.
```

模型查询数字（第 4 步的仓库，或跳过后用示例数据集）、检查 `schema.sql` 把 grain 弄对，然后调用 `chart_series` 在 `/workspace` 渲染 PNG。

## Secrets 不进入 sandbox

Sandbox 没有 `process.env`，也碰不到你应用的 secrets。你的仓库 token 活在 app runtime，防火墙代理是它到达仓库 host 的唯一路径。它从不进入 sandbox 进程。

本地后端在 `eve dev` 期间把你的笔记本作为 sandbox 运行；在 Vercel 上它运行在 Vercel Sandbox。生命周期、后端和网络策略在 [Sandbox](../sandbox)。

→ 下一步：[记住定义（Remember definitions）](./remember-definitions)
了解更多：[Sandbox](../sandbox)
