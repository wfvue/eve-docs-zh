---
title: "Human-in-the-loop"
description: "让运行过程暂停等待人工参与：审批工具调用，或让 Agent 中途提问，并在回答后持久恢复。"
---

# Human-in-the-loop：人在环中

Human-in-the-loop，简称 HITL，指 Agent 在运行中持久暂停并等待人的输入。eve 主要有两类触发方式：

- **Approvals**：某个工具执行前需要人确认。
- **Questions**：Agent 需要向用户提一个澄清问题或选择题。

无论哪一种，run 都会进入 `session.waiting`，可以等待几秒，也可以等待几天。回答到达后，eve 会从暂停点继续运行。

## Approvals

审批是 tool 的一个属性。可以用 `eve/tools/approval` 里的 helper：

```ts
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

export default defineTool({
  description: "Refund a charge.",
  inputSchema: z.object({ chargeId: z.string(), amount: z.number() }),
  approval: always(),
  async execute(input) {
    return refund(input);
  },
});
```

常见策略：

| Helper | 行为 |
| --- | --- |
| `never()` | 不要求审批，省略时默认如此。 |
| `once()` | 每个 session 第一次调用时审批，之后自动允许。 |
| `always()` | 每次调用前都审批。 |

对于退款、发邮件、删除数据、跨租户访问、外部副作用等动作，建议结合审批、权限校验和幂等键。

## Questions

内置 `ask_question` 工具允许模型中途向用户提问，而不是猜测。它接收 `prompt`、`options` 和 `allowFreeform`。Channel 会把这些请求渲染成按钮、选择框或其它原生 UI。

## 暂停和恢复协议

审批和提问共用同一套协议：

1. 模型请求输入。
2. eve 发出 `input.requested` stream event。
3. turn 持久停在 `session.waiting`。
4. 客户端用 `inputResponses` 或普通 follow-up message 回答。
5. run 从暂停点继续。

这套机制不依赖进程内存；即使进程重启，等待中的 turn 也可以恢复。
