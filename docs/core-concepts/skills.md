# Skills

## 一句话解释

Skill 是 Agent 按需加载的流程说明。

它不是工具，不直接执行动作；它只是告诉模型：遇到某类任务时，应该按什么流程、标准和输出格式来做。

常见位置：

```txt
agent/skills/<skill-name>/SKILL.md
```

例如：

```txt
agent/skills/clue-import/SKILL.md
agent/skills/clue-comprehensive-analysis/SKILL.md
```

## 为什么需要 Skill

如果把所有流程都写进 `instructions.md`，每一轮都会变得很重。

Skill 的好处是：

```txt
只有任务匹配时才加载
可以写较长流程
可以拆分不同业务能力
不会污染普通问答
```

## Skill 和 Tool 的区别

```txt
Skill
  说明怎么做
  不增加执行能力

Tool
  真正执行动作
  查询数据库、读文件、保存报告、提交审批
```

比如线索导入：

```txt
clue-import/SKILL.md
  写导入流程：先预览、再校验、再确认、最后入库

parse_import_preview tool
  真正解析文件并生成预览

create_clues tool
  真正把有效预览入库
```

## 一个 Skill 应该写什么

建议包含：

```txt
适用场景
不适用场景
核心原则
必要输入
标准流程
失败处理
用户可见输出模板
完成与停止条件
```

## 示例：线索导入 Skill

```md
---
description: 当用户明确要求导入线索、上传线索文件、根据 fileId 进行线索入库预览、校验、查重、确认和正式入库时使用。
---

# 线索导入 Skill

本 Skill 负责线索导入流程。

## 核心原则

1. 首个业务工具调用必须是 parse_import_preview。
2. 不得绕过导入预览直接调用入库工具。
3. 不得根据用户普通文本伪造审批通过或入库成功。
4. 导入完成后不自动启动综合研判。

## 标准流程

1. 识别用户是否明确要求导入。
2. 调用 parse_import_preview 生成预览。
3. 整理校验、查重和待确认事项。
4. 等待用户确认或审批。
5. 满足条件后调用 create_clues。
6. 输出导入结果摘要并停止。
```

## description 很重要

Skill 的 frontmatter `description` 是路由提示。Eve 会先把 description 暴露给模型，模型判断需要时才加载完整 Skill。

所以 description 应该写清楚：

```txt
什么时候使用这个 Skill
什么时候不要使用这个 Skill
```

不要只写：

```txt
线索导入
```

应该写得更具体。

## 适合拆成多个 Skill 的情况

推荐拆：

```txt
clue-import
clue-comprehensive-analysis
report-writing
knowledge-ingest
risk-review
```

不要把所有业务流程放进一个巨大的 Skill。

## 常见误区

### 误区一：Skill 可以替代 Tool

不可以。Skill 只是说明，不能真正访问数据库或保存报告。

### 误区二：Skill 越长越好

不是。Skill 可以比 instructions 长，但仍然要结构清晰，避免塞入过多无关规则。

### 误区三：把所有安全边界都放 Skill

全局安全边界应放 instructions；具体业务边界放 Skill；强约束放工具 schema 和后端。

## 官方链接

- https://eve.dev/docs/skills
