---
title: "filesystem-first 是什么"
description: "解释 Eve 为什么以文件系统作为 Agent 能力组织入口。"
---

# filesystem-first 是什么

## 一句话解释

filesystem-first 可以翻译成“以文件系统为第一入口”。

在 Eve 里，它的意思是：你不是先写一大堆注册代码来声明 Agent 有哪些工具、技能和子 Agent，而是把文件放到约定目录里，Eve 根据文件路径自动发现和加载它们。

## 典型目录

```txt
agent/
├── agent.ts
├── instructions.md
├── tools/
│   ├── search_workspace_pages.ts
│   └── save_report.ts
├── skills/
│   ├── clue-import/
│   │   └── SKILL.md
│   └── clue-comprehensive-analysis/
│       └── SKILL.md
└── subagents/
    └── risk_reviewer/
        ├── agent.ts
        └── instructions.md
```

Eve 会理解：

- `agent/instructions.md` 是主 Agent 的常驻系统提示词；
- `agent/tools/search_workspace_pages.ts` 是模型可调用的工具；
- `agent/skills/clue-import/SKILL.md` 是按需加载的导入流程 Skill；
- `agent/subagents/risk_reviewer/` 是一个子 Agent。

## 和普通代码注册的区别

传统方式可能是：

```ts
const agent = createAgent({
  instructions,
  tools: {
    search_workspace_pages,
    save_report,
  },
});
```

filesystem-first 方式是：

```txt
把工具放到 agent/tools/
把 Skill 放到 agent/skills/
把子 Agent 放到 agent/subagents/
```

目录结构本身就是配置。

## 好处

1. 结构清楚：一看目录就知道 Agent 有哪些能力。
2. 适合协作：新增工具或 Skill 不需要改一个巨大的注册表。
3. 适合 AI/Codex 维护：让代码助手更容易定位要改的文件。
4. 和 Next.js 文件路由类似：文件路径决定身份。

## 注意事项

filesystem-first 不代表所有业务逻辑都应该写进 `agent/` 目录。

推荐做法是：

```txt
agent/tools/*.ts
  给模型暴露的薄工具封装

src/services 或 packages/*
  真正的业务逻辑、数据库事务、权限校验
```

例如 `agent/tools/save_report.ts` 只负责暴露模型可调用接口，真正保存报告应交给后端 service 和数据库事务。

## 官方链接

- https://eve.dev/docs
- https://github.com/vercel/eve
