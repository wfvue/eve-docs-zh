# Project layout

这一页对应官方 Project layout reference。它说明 eve 如何根据 `agent/` 目录下的文件位置发现能力。

## 常见位置

- `agent/agent.ts`
- `agent/instructions.md`
- `agent/tools/`
- `agent/skills/`
- `agent/channels/`
- `agent/connections/`
- `agent/sandbox/`
- `agent/subagents/`
- `agent/schedules/`

Eve 的核心设计是 filesystem-first：路径本身就是接口的一部分。
