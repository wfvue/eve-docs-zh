---
title: "查询示例数据（Query Sample Data）"
description: "Build an Agent 教程第 3 步：在打包的示例数据集上加一个 run_sql 工具，观察工具循环。"
---

# 查询示例数据（Query Sample Data）

分析助手能对话，但看不到一行数据。给它一个工具。工具是动作原语。类型化输入进去、你的代码运行、结构化输出回来。模型看到的名字就是文件名，所以 `agent/tools/run_sql.ts` 成为工具 `run_sql`。

## 一个微型示例数据集

为了让第一次查询无需设置就能工作，在 `agent/lib/` 下打包一个小的内存数据集。保持微小。这是临时脚手架，不是真正的仓库（第 4 步才有）。

```ts title="agent/lib/sample-db.ts"
// A toy SQLite-in-memory stand-in. Swap for your real warehouse in Step 4.
import initSqlJs from "sql.js";

const SEED = `
CREATE TABLE orders (id INTEGER, customer_id INTEGER, amount_cents INTEGER, created_at TEXT);
INSERT INTO orders VALUES
(1, 10, 4200, '2026-05-01'), (2, 10, 1500, '2026-05-03'),
(3, 11, 9900, '2026-05-04'), (4, 12, 800, '2026-05-06');
CREATE TABLE customers (id INTEGER, name TEXT, plan TEXT);
INSERT INTO customers VALUES
(10, 'Acme', 'pro'), (11, 'Globex', 'enterprise'), (12, 'Initech', 'free');
`;

let dbPromise: Promise<import("sql.js").Database> | null = null;

async function db() {
  dbPromise ??= initSqlJs().then((SQL) => {
    const database = new SQL.Database();
    database.run(SEED);
    return database;
  });
  return dbPromise;
}

export async function runReadOnlySql(sql: string) {
  const database = await db();
  const [result] = database.exec(sql);
  if (!result) return { columns: [], rows: [] as unknown[][] };
  return { columns: result.columns, rows: result.values };
}
```

## 定义 run_sql 工具

```ts title="agent/tools/run_sql.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";
import { runReadOnlySql } from "../lib/sample-db";

export default defineTool({
  description:
    "Run a read-only SQL query against the analytics tables (orders, customers) " +
    "and return the columns and rows.",
  inputSchema: z.object({
    sql: z.string().describe("A single read-only SELECT statement."),
  }),
  async execute({ sql }) {
    const { columns, rows } = await runReadOnlySql(sql);
    // Bound the output so a wide query can't flood the model's context.
    return { columns, rows: rows.slice(0, 500), truncated: rows.length > 500 };
  },
});
```

工具在你的应用 runtime 里运行，有完整 `process.env`，不在 sandbox 里。`inputSchema` 既校验调用，也给你在 `execute` 里拿到的 `input` 定型。输出边界、`toModelOutput` 和授权见 [工具（Tools）](../tools)。

## 观察工具循环

用 `npm run dev` 重启 dev server 并问：

```txt
Which customer has spent the most, and how much?
```

在 TUI 中观察循环展开。模型发出 `run_sql` 调用，eve 运行你的 `execute`，行以工具结果返回。模型读取它们，用真实数字回答。eve 驱动了整个循环。你只提供了工具。

→ 下一步：[连接仓库（Connect a warehouse）](./connect-a-warehouse)
了解更多：[工具（Tools）](../tools)
