# Workflow SDK 原理

## 一句话解释

Workflow SDK 是给 TypeScript 异步流程提供“持久化执行”的运行层。

它不是保存 Node.js 进程内存，而是把流程拆成 workflow 和 step，把每一步的输入、输出、错误和状态写进 event log。服务重启后，Workflow SDK 重新运行 workflow 函数，通过 event log 跳过已经完成的 step，继续执行未完成的部分。

## 为什么需要它

普通接口适合短请求：

```txt
登录
查询列表
保存表单
普通 CRUD
```

但不适合长流程：

```txt
上传文件
解析文件
调用模型
调用多个工具
等待人工确认
生成报告
保存结果
```

这些流程可能遇到：

- 请求超时；
- 页面刷新；
- 服务重启；
- 模型调用失败；
- 第三方 API 失败；
- 需要等用户确认；
- 已完成步骤不想重复执行。

Workflow SDK 就是为这类问题准备的。

## 两个核心概念

```txt
workflow function = 编排流程
step function     = 真正干活
```

示例：

```ts
export async function analyzeTenderWorkflow(input: {
  fileIds: string[];
}) {
  "use workflow";

  const text = await extractTenderText(input.fileIds);
  const risks = await analyzeRisks(text);
  const report = await generateReport(risks);

  return report;
}

async function extractTenderText(fileIds: string[]) {
  "use step";
  // 读取文件、解析 PDF/DOCX
}

async function analyzeRisks(text: string) {
  "use step";
  // 调 AI SDK / 规则库 / 检索系统
}

async function generateReport(risks: unknown) {
  "use step";
  // 生成报告并保存
}
```

## 恢复机制

假设流程是：

```txt
A. 解析文件
B. AI 分析
C. 生成报告
D. 保存结果
```

如果 A、B 已完成，C 执行中服务挂了，恢复时不会从 A 重新开始。

恢复过程大概是：

```txt
重新运行 workflow 函数
→ 遇到 A：event log 里已有结果，直接返回
→ 遇到 B：event log 里已有结果，直接返回
→ 遇到 C：未完成，重新执行或继续
```

所以它更像：

```txt
event sourcing + step 结果缓存 + 队列调度 + 重试机制
```

## 数据存在哪里

这取决于 World：

```txt
Local World       本地开发，数据存在本地文件
Postgres World    自部署生产，数据存在 PostgreSQL
Vercel World      Vercel 托管环境
```

如果是自部署，推荐优先考虑 `@workflow/world-postgres`，用 PostgreSQL 保存 workflow runs、events、steps、hooks，并用 graphile-worker 做可靠任务队列。

## 和 AI SDK 的关系

AI SDK 负责模型调用：

```txt
streamText
generateText
tool calling
UIMessage
```

Workflow SDK 负责流程可靠性：

```txt
持久化执行
自动重试
暂停恢复
等待人工确认
刷新后恢复 stream
```

Eve 则把二者组合到更上层的 Agent Runtime 中。

## 什么时候该用

适合：

- Agent 多轮工具调用；
- 长任务；
- 文件解析；
- 报告生成；
- 人工确认；
- 定时任务；
- 需要刷新恢复的输出流。

不适合：

- 普通 CRUD；
- 1 秒内完成的查询；
- 纯前端交互；
- 不需要恢复的短请求。

## 官方链接

- https://workflow-sdk.dev
- https://eve.dev/docs
