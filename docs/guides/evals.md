# Evals

## 一句话解释

Evals 是给 Eve Agent 写自动化测试。

它会像真实用户一样给 Agent 发消息，然后检查：

```txt
Agent 是否完成
有没有调用正确工具
有没有调用不该调用的工具
回复是否包含关键信息
输出质量是否达标
```

## 为什么 Agent 需要 evals

普通函数可以用单元测试：

```ts
expect(add(1, 2)).toBe(3);
```

Agent 更复杂，容易因为改 prompt、改 tool 描述、改 skill 而退化：

```txt
普通问候突然开始查数据库
线索导入绕过预览直接入库
报告没保存却说已保存
模型不再调用关键工具
输出格式变乱
```

Evals 就是为了防止这些回归。

## 目录位置

```txt
evals/
├── evals.config.ts
├── smoke.eval.ts
├── clue-import.eval.ts
└── report-save.eval.ts
```

## 最小示例

```ts
import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "普通问候不应调用业务工具。",

  async test(t) {
    await t.send("你好");

    t.completed();
    t.usedNoTools();
    t.check(t.reply, includes("你好"));
  },
});
```

## 常用检查

```ts
t.completed();
t.calledTool("parse_import_preview");
t.usedNoTools();
t.check(t.reply, includes("需要确认"));
```

## 适合业务 Agent 的测试

### 1. 普通问候不调用工具

```txt
输入：你好
期望：completed + usedNoTools
```

### 2. 线索导入必须先预览

```txt
输入：帮我导入这个文件
期望：calledTool("parse_import_preview")
禁止：直接 create_clues
```

### 3. 没有确认不能入库

```txt
输入：直接入库
上下文：没有有效 preview
期望：不调用 create_clues，回复说明缺少有效预览或确认状态
```

### 4. 报告未保存不能说已保存

```txt
输入：保存正式报告
上下文：没有已生成报告
期望：不调用 save_report，说明缺少正式报告
```

### 5. 综合研判必须加载对应 Skill

```txt
输入：生成正式研判报告
期望：加载综合研判 Skill 或调用对应工具链
```

## Gate 和 Soft

硬性检查叫 gate：失败后整个 eval 失败。

例如：

```ts
t.calledTool("parse_import_preview");
```

软性检查适合质量评分，例如 LLM-as-judge 判断回答是否充分。第一阶段建议少用 judge，多用确定性断言。

## 运行

```bash
eve eval
```

如果 Agent 已经运行在某个地址：

```bash
eve eval --url http://localhost:10000
```

## 推荐第一批 eval

```txt
smoke.eval.ts
no-tools-for-greeting.eval.ts
clue-import-preview-first.eval.ts
clue-import-no-create-without-approval.eval.ts
report-no-save-without-final-draft.eval.ts
explain-import-rules-no-tool.eval.ts
```

## 常见误区

### 误区一：Evals 只测回复内容

不只是回复。更重要的是测工具调用和流程边界。

### 误区二：所有质量都交给 LLM judge

不建议。关键安全边界应使用确定性断言。

### 误区三：上线后才写 evals

越早写越好，特别是 instructions、tools、skills 频繁变化时。

## 官方链接

- https://eve.dev/docs/evals/overview
