---
title: "沙盒（Sandbox）是什么"
description: "解释 Eve 沙盒（Sandbox）的隔离工作区、常见后端和自部署建议。"
---

# 沙盒（Sandbox）是什么

## 一句话解释

Eve 沙盒（Sandbox）是给 Agent 准备的隔离工作区。

当 Agent 需要执行 `bash`、读写文件、跑脚本、生成临时文件时，不应该直接操作你的主应用进程或真实服务器文件系统，而应该在 sandbox 的 `/workspace` 里完成。

## 为什么需要沙盒

Agent 可能会调用这些工具：

```txt
bash
read_file
write_file
glob
grep
```

如果这些能力直接运行在主应用服务器上，风险会很高。

沙盒的价值是：

```txt
把 Agent 的执行空间和主应用运行空间隔离开。
```

## 可以把沙盒理解成什么

可以把 Eve 沙盒理解成：

```txt
Agent 专属的临时工作电脑
```

Agent 可以在里面：

```txt
写文件
读文件
跑脚本
生成报告草稿
执行分析命令
保存中间产物
```

但它不应该直接操作你的真实生产目录、数据库文件或服务器配置。

## /workspace 是什么

沙盒里的工作目录通常是：

```txt
/workspace
```

内置文件工具默认围绕这个目录工作。

例如：

```txt
/workspace/report.md
/workspace/data/input.csv
/workspace/scripts/analyze.py
```

## 常见后端

Eve 沙盒可以运行在不同 backend 上，例如：

```txt
Vercel Sandbox
Docker
microsandbox
just-bash
```

简单理解：

| Backend | 适合场景 |
| --- | --- |
| Vercel Sandbox | Vercel 托管环境 |
| Docker | 本地或自托管服务器 |
| microsandbox | 更接近隔离 VM 的本地环境 |
| just-bash | 最轻量兜底，能力有限 |

## 在自托管场景怎么选

如果你是内网、自托管、私有化部署，一般优先考虑：

```txt
Docker backend
```

原因：

```txt
隔离边界更清晰
依赖更可控
便于内网部署
便于限制网络
便于持久化或清理工作目录
```

但要注意：Docker 本身不是万能安全边界，仍然需要限制网络、文件挂载、权限和资源。

## 网络策略

沙盒默认不等于“绝对安全”。

正式系统里需要考虑：

```txt
是否允许访问公网
是否允许访问内网
是否允许访问数据库
是否允许访问对象存储
是否允许下载安装依赖
```

敏感系统建议默认：

```txt
deny-all
```

然后按需放行白名单。

## 和 tools 的关系

很多内置 tools 操作的是沙盒：

```txt
bash
read_file
write_file
glob
grep
```

但你自己写的业务 tool 不一定在沙盒中运行。

例如：

```txt
agent/tools/query_database.ts
```

这种 tool 通常运行在应用 runtime 中，而不是沙盒中。

所以要区分：

```txt
工具执行在哪里
工具能访问什么
工具是否会调用沙盒
工具是否会访问真实业务系统
```

## 常见误区

### 误区一：有沙盒就可以随便让 Agent 跑命令

不是。沙盒降低风险，但不消除风险。

### 误区二：业务写入放在沙盒里就安全

不是。正式业务写入仍然应该通过受控 tool 和后端 service 完成。

### 误区三：沙盒可以替代权限系统

不能。权限、审批、审计、幂等仍然应该在业务系统中实现。

## 官方链接

- https://eve.dev/docs/sandbox
