---
title: "Tools"
description: "定义 Agent 可以调用的类型化动作，并用人工审批保护敏感动作。"
---

# Tools：工具

Tool 是 Agent 可以调用的类型化动作，例如调用 API、查询数据库或写入文件。动作保留在你控制的代码里，模型只看到名称、说明和输入 schema。

## 基本结构

`agent/tools/get_weather.ts` 会暴露为 `get_weather`。一个 tool 需要：

- 文件名：决定模型可见名称。
- `description`：告诉模型什么时候该用它。
- `inputSchema`：定义输入参数。
- `execute`：真正执行动作的函数。

```ts
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string().min(1) }),
  async execute({ city }) {
    return { city, condition: "Sunny" };
  },
});
```

## 审批和输出

敏感动作可以配置 `approval`，让 run 暂停并等待人工确认。返回给模型的内容可以通过 `toModelOutput` 缩减，只给模型必要摘要，同时保留完整结果给 channel 或 hooks 使用。

## 工程建议

不要把正式业务逻辑全写在 tool 文件里。推荐让 tool 做薄封装，把权限、幂等、审计、事务和错误处理放在后端 service 中。
