---
title: "查询示例数据（Query Sample Data）"
description: "Build an Agent 教程第 3 步：在本地示例数据集上加一个 run_sql 工具，观察工具循环。"
---

# 查询示例数据（Query Sample Data）

分析助手能对话，但看不到一行数据。给它一个工具。工具是动作原语。类型化输入进去、你的代码运行、结构化输出回来。模型看到的名字就是文件名，所以 `agent/tools/run_sql.ts` 成为工具 `run_sql`。

## 安装 sql.js

```sh
npm install sql.js
npm install --save-dev @types/sql.js
```

`sql.js` 运行时从已安装包加载 WebAssembly 二进制。把它标为 external，让二进制仍挨着 JS。在现有 `agent/agent.ts` 的 `defineAgent({ ... })` 里加 `build`，并保留已配置的 `model` 与 imports：

```ts
build: {
  externalDependencies: ["sql.js"],
},
```

改 `externalDependencies` 后要重启 dev server；eve 在 server 启动时读这个设置。

## 一个微型示例数据集

创建 `agent/lib/sample-db.ts`，用下面的数据集。四笔订单、三个客户，供后续每一步使用。不需要数据库服务器、账户或连接串；应用重启时数据集会重建。

```ts title="agent/lib/sample-db.ts"
import initSqlJs from "sql.js";

const SEED = `
  CREATE TABLE orders (id INTEGER, customer_id INTEGER, amount_cents INTEGER, created_at TEXT);
  INSERT INTO orders VALUES
    (1, 10, 4200, '2026-05-01'), (2, 10, 1500, '2026-05-03'),
    (3, 11, 9900, '2026-05-04'), (4, 12,  800, '2026-05-06');
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
  const query = `SELECT * FROM (\n${sql.trim().replace(/;$/, "")}\n) LIMIT 501`;
  const statement = database.prepare(query);
  try {
    // prepare() accepts the first statement; reject any unparsed trailing SQL.
    if (statement.getSQL() !== query) {
      throw new Error("Provide a single SELECT query.");
    }
    const columns = statement.getColumnNames();
    const rows: unknown[][] = [];
    while (rows.length < 501 && statement.step()) rows.push(statement.get());
    return { columns, rows };
  } finally {
    statement.free();
  }
}
```

外层 `SELECT` 让 SQLite 能接受含 `WITH` 的查询，同时拒绝写入与配置语句。helper 只 prepare 一条语句、拒绝尾随 SQL，并最多读 501 行；多出的一行用来报告 500 行输出被截断。即使查询失败也会 free statement。

这是内存教程库。行数上限并不限制计算代价；接到生产库时要用库侧只读权限与查询超时。

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
    sql: z.string().max(10_000).describe("A single read-only SELECT statement."),
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

在 TUI 中观察循环展开。模型发出 `run_sql` 调用，eve 运行你的 `execute`，行以工具结果返回。模型读取它们，用真实数字回答。结果是 Globex，9900 分（$99.00）。金额以分为单位存储，报美元时除以 100。eve 驱动了整个循环；你只提供了工具。

后续步骤继续保留 `run_sql` 与示例库。当你有自己的数据服务时，[连接仓库](./connect-a-warehouse) 说明可选集成。

→ 下一步：[运行分析（Run analysis）](./run-analysis)

了解更多：[工具（Tools）](../tools)
