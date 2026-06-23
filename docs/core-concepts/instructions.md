# Instructions

## 一句话解释

`instructions` 是 Eve Agent 永远携带的常驻系统提示词。

最常见文件是：

```txt
agent/instructions.md
```

它定义 Agent 的身份、长期规则、安全边界和输出风格。

## 适合写什么

适合写每一轮都应该遵守的稳定规则：

```txt
Agent 是谁
服务什么业务场景
回答语言和风格
什么时候必须用工具
不能编造哪些内容
哪些动作需要人工确认
敏感数据如何处理
```

例如：

```md
# 主控 Agent

你是企业知识库与业务研判助手。

你必须遵守：

1. 回答必须基于用户提供的信息、工具结果或可信系统状态。
2. 不得编造数据库记录、文件内容、审批状态和保存结果。
3. 涉及写入、删除、审批和正式保存时，必须使用对应工具。
4. 默认使用中文，结论先行。
```

## 不适合写什么

不要把所有业务流程都塞进 `instructions.md`。

不适合写：

```txt
完整线索导入流程
几百行报告模板
废标项研判细则全集
某个临时项目规则
所有工具参数说明
所有错误码解释
```

这些应该拆到：

```txt
skills/      复杂流程
tools/       工具描述和 schema
references/ 参考资料
后端状态机   权限、审批、幂等、保存判定
```

## 和 Skills 的区别

```txt
instructions.md
  永远加载，每一轮都生效

skills/*/SKILL.md
  按需加载，只有任务匹配时才进入上下文
```

简单类比：

```txt
instructions = 宪法
skills       = 专项操作手册
tools        = 真正执行动作的能力
```

## Markdown 和 TypeScript 两种写法

固定内容用：

```txt
agent/instructions.md
```

如果需要构建时拼装，可以用：

```txt
agent/instructions.ts
```

但通常第一版用 Markdown 就够。

## 推荐写法

保持短、稳定、明确。

建议结构：

```md
# Agent 名称

## 身份

## 总体原则

## 工具使用原则

## 安全边界

## 输出风格

## 停止条件
```

## 常见误区

### 误区一：instructions 越长越好

不是。它每轮都会进入上下文，太长会浪费 token，也容易干扰模型。

### 误区二：只写 instructions 就能执行动作

不是。instructions 只是规则。真正执行查询、保存、审批、入库，需要 tools。

### 误区三：把工具参数写进 instructions

不建议。工具参数和前置条件应放在工具 schema、description 和后端状态机里。

## 官方链接

- https://eve.dev/docs/instructions
