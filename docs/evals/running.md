---
title: "运行评测（Running Evals）"
description: "eve eval CLI：参数、过滤器、退出码、artifacts，以及如何把 evals 接入 CI。"
---

# 运行评测（Running Evals）

`eve eval` 会发现 `evals/` 下的所有 `.eval.ts` 文件，启动一个本地 dev server，或指向远程目标，并发运行 evals，然后打印每个 eval 的 summary。

```bash
eve eval                         # 本地运行所有发现的 eval
eve eval weather smoke           # 运行选中的 eval：可以是 id，也可以是目录前缀
eve eval --url https://<app>     # 指向远程 app，而不是本地主机
eve eval --tag fast              # 只运行带某个 tag 的 eval
eve eval --strict                # soft below-threshold assertions 也会导致非零退出码
eve eval --timeout 60000         # 每个 eval 的 timeout，单位毫秒
eve eval --max-concurrency 4     # 限制并发 eval 数量，默认 8
eve eval --junit .eve/junit.xml  # 写出 JUnit XML
eve eval --list                  # 只打印发现的 eval，不运行
eve eval --verbose               # 把每个 eval 的 t.log 行流式输出到 stdout
eve eval --json                  # 机器可读输出
eve eval --skip-report           # 跳过 config 和 eval-defined reporters，例如 Braintrust
```

位置参数 ids 可以精确匹配，也可以按目录前缀匹配：`eve eval weather` 会运行 `evals/weather.eval.ts`、`evals/weather/` 下的所有 eval，以及数组导出的 `weather.eval.ts` 中的每一项。

## 退出码

| Code | 含义 |
| --- | --- |
| `0` | 所有非 skipped eval 都通过了 gates；在 `--strict` 下，也表示 soft thresholds 通过 |
| `1` | 任意 eval 失败：failed gate、execution error，或 strict threshold miss |
| `2` | 配置错误 |

调用 `t.skip(reason)` 的 eval 会被报告为 skipped，不算 passed 或 failed，也不会改变退出码。

## Artifacts

每次 run 都会在 `.eve/evals/<timestamp>/` 下写入 artifacts：run `summary.json`、`results.jsonl` 索引，以及每个 eval 的 assertion results、verdicts、捕获到的 event streams 和 `t.log` 行，这些都放在 `evals/` 下。Console output 故意保持简短；当 eval 失败时，artifact 里会有完整故事。

## CI

一个稳妥的 CI 调用应该是 strict 且 machine-reportable：

```bash
eve eval --strict --junit .eve/junit.xml
```

- `--strict` 会把 soft threshold miss 转成失败，因此评分回归会阻止合并。
- `--junit` 给 CI provider 提供 per-eval annotations；如果失败，可以把 `.eve/evals/` 目录作为 failure artifact 上传，以便查看完整 event streams。

Evals 会针对真实模型运行，因此 CI 环境必须提供模型 provider credentials。如果要针对已部署 app 运行，加上 `--url`：

```bash
eve eval --strict --url "$DEPLOY_URL" --junit .eve/junit.xml
```

## 接下来读什么

- [Targets](./targets)：`--url` 会和什么交互
- [Reporters](./reporters)：Braintrust 和 JUnit 输出
- [CLI reference](../reference/cli)：`eve` CLI 的其它内容
