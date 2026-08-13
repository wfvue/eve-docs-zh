---
title: "守护支出（Guard the Spend）"
description: "Build an Agent 教程第 8 步：用基于成本的审批门禁昂贵查询。Agent 暂停、询问、恢复。"
---

# 守护支出（Guard the Spend）

一次仓库查询可以扫描数 TB 并推高账单。所以在分析助手发出昂贵扫描之前，让它停下来问你。Agent 暂停、问你，然后用你的回答恢复。这就是 human-in-the-loop，你在工具上加一个字段就能接上。

`approval` 在 `execute` 之前运行。返回 `"user-approval"`，turn 就在审批请求上 park；你回答后，run 从那个确切 step 继续。函数拿到工具输入，所以你可以做基于成本的决策。

## 估算，然后门禁

这一步把 `run_sql` 保留在第 3 步的示例数据集上，让你能在本地演示门禁。有真仓库时，你按同样的方式门禁第 4 步的仓库 connection 工具，基于 dry-run 字节估算而不是下面的玩具启发式。

添加一个廉价估算器，并用它门禁 `run_sql`：

```ts title="agent/lib/cost.ts"
// Illustrative: a real warehouse exposes a dry-run byte estimate.
export function estimateScanGb(sql: string): number {
  return /\bwhere\b/i.test(sql) ? 1 : 200; // unfiltered scans are the expensive ones
}
```

```ts title="agent/tools/run_sql.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";
import { runReadOnlySql } from "../lib/sample-db";
import { estimateScanGb } from "../lib/cost";

const THRESHOLD_GB = 50;

export default defineTool({
  description: "Run a read-only SQL query against the analytics tables.",
  inputSchema: z.object({ sql: z.string() }),
  // Cost-based gate: only the expensive queries need a human yes.
  approval: ({ toolInput }) =>
    estimateScanGb(toolInput?.sql ?? "") > THRESHOLD_GB ? "user-approval" : "not-applicable",
  async execute({ sql }) {
    const { columns, rows } = await runReadOnlySql(sql);
    return { columns, rows: rows.slice(0, 500), truncated: rows.length > 500 };
  },
});
```

廉价查询直接通过。估算超过阈值的查询触发门禁。

## 暂停、询问、恢复

问一个强制大范围无过滤扫描的问题：

```txt
Total revenue across all customers, all time, broken out by day.
```

模型提出查询，`approval` 返回 `"user-approval"`，turn park。流发出 `input.requested`，然后 `session.waiting`。提示长什么样取决于渠道，无论是 TUI 里的按钮、Slack 里的 Block Kit，还是 Web 上的 UI 控件。批准它，run 从那个确切 step 恢复，然后查询运行。拒绝它，工具被跳过，并告诉模型原因。

每个 session 恰好有一个活跃 continuation。用过期 handle 回答审批会被拒绝，所以没有办法双重恢复同一个 parked turn。

同样的机制支撑内置 `ask_question` 工具（模型在 turn 中途问你）和 per-connection 审批（`approval: once()`）。见 [工具与 human-in-the-loop（Tools and human-in-the-loop）](../tools)。

→ 下一步：[上线（Ship it）](./ship-it)
了解更多：[工具与 human-in-the-loop（Tools and human-in-the-loop）](../tools)
