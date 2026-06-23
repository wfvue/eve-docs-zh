# Tools

## 一句话解释

Tool 是 Agent 可以调用的结构化动作。

在 Eve 里，工具通常放在：

```txt
agent/tools/<tool-name>.ts
```

文件名会成为模型看到的工具名。

例如：

```txt
agent/tools/search_workspace_pages.ts
```

会暴露成工具：

```txt
search_workspace_pages
```

## Tool 解决什么问题

模型自己不能直接查数据库、读业务文件、保存报告或调用内部 API。

你需要把这些能力包装成 tool：

```txt
query_database
parse_import_preview
create_clues
save_report
search_workspace_pages
get_workspace_page
```

这样模型才能在规则允许的情况下调用。

## 最小示例

```ts
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "搜索当前工作空间的知识页。",
  inputSchema: z.object({
    workspaceId: z.string().uuid(),
    query: z.string().min(1),
    limit: z.number().int().min(1).max(10).default(5),
  }),
  async execute({ workspaceId, query, limit }) {
    return {
      results: [],
      workspaceId,
      query,
      limit,
    };
  },
});
```

## description 应该怎么写

Tool 的 description 不是业务流程手册。

它应该说明：

```txt
这个工具能做什么
什么时候应该调用
什么时候不应该调用
重要前置条件
返回结果的大致含义
```

不应该在 description 里塞大量业务步骤。复杂流程应该放 Skill。

## inputSchema 的作用

`inputSchema` 是工具输入契约。

它决定：

```txt
模型可以传哪些参数
参数类型是什么
哪些字段必填
哪些字段有范围限制
```

这比单纯靠 prompt 更可靠。

## 业务工具应该薄封装

推荐做法：

```txt
agent/tools/*.ts
  只暴露模型可调用接口

src/services 或 packages/*
  真正业务逻辑、权限、数据库事务、审计、幂等
```

例如 `save_report` tool 不应该自己拼 SQL 保存报告，而应该调用后端 service：

```ts
async execute(input, ctx) {
  return reportService.saveFinalReport({
    ...input,
    userId: ctx.session.auth.current?.principalId,
  });
}
```

## 内置工具

Eve 默认带一些通用工具，例如：

```txt
bash
read_file
write_file
glob
grep
web_fetch
web_search
todo
ask_question
agent
load_skill
```

敏感系统建议审查这些默认工具。

例如不希望 Agent 任意抓网页，可以覆盖或禁用：

```ts
// agent/tools/web_fetch.ts
import { disableTool } from "eve/tools";

export default disableTool();
```

## 覆盖内置工具

如果你在 `agent/tools/` 里创建同名工具，会覆盖内置工具。

例如：

```txt
agent/tools/web_fetch.ts
```

会覆盖默认 `web_fetch`。

可以用这个机制加白名单、审计、大小限制或完全禁用。

## 常见误区

### 误区一：用 bash 做正式业务写入

不建议。正式写入应该做成结构化工具，由后端控制权限、审批和幂等。

### 误区二：工具越多越好

不是。工具越多，模型选择越难，误调用风险越高。

### 误区三：把流程写进工具描述

不建议。工具描述说明能力，流程应放 Skill。

## 官方链接

- https://eve.dev/docs/tools
