# Sandbox 是什么

## 一句话解释

Eve Sandbox 是给 Agent 准备的隔离工作区。

当 Agent 需要执行 `bash`、读写文件、跑脚本、生成临时文件时，不应该直接操作你的主应用进程或真实服务器文件系统，而应该在 sandbox 的 `/workspace` 里完成。

## 为什么需要 Sandbox

Agent 可能会调用这些工具：

```txt
bash
read_file
write_file
glob
grep
```

如果没有隔离，模型可能直接碰到：

- 服务器真实文件；
- 环境变量；
- 数据库凭据；
- 后端源码；
- 内网服务；
- 临时敏感文件。

Sandbox 的目标是降低这类风险。

## `/workspace` 是什么

Eve 内置文件和 shell 工具默认在 `/workspace` 下工作。

例如：

```txt
read_file("report.md")
```

实际读取的是：

```txt
/workspace/report.md
```

同一个 durable session 内，sandbox 的文件状态可以跨 turn 保留。

## 常见后端

Eve 支持不同 sandbox backend：

```txt
vercel()       Vercel 云端 Sandbox
docker()       本地 Docker 容器
microsandbox() 本地轻量 VM
justbash()     纯 JS 模拟 bash，兜底用
```

## Docker vs microsandbox

| 方案 | 特点 | 建议 |
|---|---|---|
| Docker | 成熟、容易部署、排查简单 | 自部署第一阶段优先选择 |
| microsandbox | 更接近 VM 隔离，支持更细网络策略 | 安全要求更高后再评估 |
| justbash | 只是开发兜底 | 不建议生产使用 |

## 对业务系统的建议

敏感业务动作不要靠 sandbox 的 bash 完成。

例如这些动作应该做成 app runtime 工具，并由后端 service 控制权限、审批和事务：

```txt
parse_import_preview
create_clues
save_report
query_database
query_clue_detail
```

Sandbox 更适合：

- 处理临时文件；
- 运行受控脚本；
- 生成中间产物；
- 执行非敏感分析；
- 测试代码或模板。

## 推荐自部署配置

第一阶段建议 Docker + 禁止网络：

```ts
// agent/sandbox/sandbox.ts
import { defineSandbox } from "eve/sandbox";
import { docker } from "eve/sandbox/docker";

export default defineSandbox({
  backend: docker({
    image: "ghcr.io/vercel/eve:latest",
    networkPolicy: "deny-all",
  }),
});
```

如果需要访问某些内网服务，先确认 Docker backend 是否支持目标网络策略；对更细粒度的域名级策略，可以评估 microsandbox 或 Vercel Sandbox。

## 常见误区

### 误区一：Sandbox 等于业务数据库

不是。Sandbox 只是临时工作区，不应该保存正式业务状态。

### 误区二：Agent 可以在 sandbox 里随便连数据库

不建议。数据库查询和写入应该走结构化工具，由后端做权限、schema、审计和幂等控制。

### 误区三：禁用了 sandbox 就不能做 Agent

不是。很多业务 Agent 只需要调用后端工具和模型，不一定需要 shell 或文件系统。

## 官方链接

- https://eve.dev/docs/sandbox
