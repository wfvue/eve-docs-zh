---
title: "动态调度（Dynamic scheduling）"
description: "把一个分钟级 eve schedule、主动渠道交接和 CRUD 工具组合成应用托管的 schedules。"
---

# 动态调度（Dynamic scheduling）

Authored eve schedules 是构建时发现的静态文件。你可以今天就构建动态调度：把 schedule 行放进应用存储，并用一个 authored schedule 作为 dispatcher：

1. CRUD 工具让 Agent 为当前租户创建和管理行；
2. `defineSchedule({ cron: "* * * * *" })` 每分钟醒来一次；
3. handler 原子地认领到期的行；
4. `receive(...)` 为每行启动一个普通 durable agent session。

PostgreSQL 或 durable KV store 可以为 adapter 提供支撑。关键的存储能力是原子租约（atomic lease），而不是特定 schema。

```txt
agent/
  channels/
    slack.ts
  lib/
    schedule-store.ts  # your storage adapter
    tenant.ts
  schedules/
    dynamic.ts
  tools/
    create_schedule.ts
    delete_schedule.ts
    list_schedules.ts
    update_schedule.ts
```

## 每分钟 dispatch 到期 schedules

这是唯一 authored schedule。它查找到期的应用托管行，并把每一行作为主动 session 交给 Slack：

```ts title="agent/schedules/dynamic.ts"
import { defineSchedule } from "eve/schedules";
import slack from "../channels/slack";
import { scheduleStore } from "../lib/schedule-store";

export default defineSchedule({
  cron: "* * * * *",
  run({ to, waitUntil }) {
    waitUntil(
      (async () => {
        const jobs = await scheduleStore.claimDue({
          now: new Date(),
          limit: 25,
          leaseForMs: 5 * 60_000,
        });
        await Promise.all(
          jobs.map(async (job) => {
            try {
              await to(slack, { channelId: job.channelId }).send(
                [
                  `Run dynamic schedule ${job.id}.`,
                  "Complete this tenant-owned task:",
                  job.prompt,
                ].join("\n\n"),
                {
                  auth: {
                    attributes: {
                      tenantId: job.tenantId,
                      role: job.ownerRole,
                      scheduleId: job.id,
                    },
                    authenticator: job.authenticator,
                    ...(job.issuer ? { issuer: job.issuer } : {}),
                    principalId: job.ownerId,
                    principalType: "user",
                  },
                },
              );
              await scheduleStore.complete(job);
            } catch (error) {
              await scheduleStore.release(job, { error, retryAt: new Date(Date.now() + 300_000) });
            }
          }),
        );
      })(),
    );
  },
});
```

`waitUntil` 让 cron 调用保持存活，直到认领和交接 settle。`to(...).send(...)` 启动与入站 channel 消息相同的 durable runtime。

这个示例用 Slack，因为它有 `{ channelId }` 的主动 target。任何实现 `receive` 的渠道都可以替换它。

正常配置 Slack：

```ts title="agent/channels/slack.ts"
import { connectSlackCredentials } from "@vercel/connect/eve";
import { slackChannel } from "eve/channels/slack";

export default slackChannel({
  credentials: connectSlackCredentials("slack/my-agent"),
});
```

## 给 Agent CRUD 工具

租户和拥有者身份来自 `ctx.session`，绝不来自模型：

```ts title="agent/lib/tenant.ts"
import type { SessionAuthContext, SessionContext } from "eve/context";

export function requireScheduleOwner(ctx: SessionContext): {
  tenantId: string;
  userId: string;
  auth: SessionAuthContext;
} {
  const auth = ctx.session.auth.current;
  const tenantId = auth?.attributes.tenantId;
  if (auth?.principalType !== "user" || typeof tenantId !== "string") {
    throw new Error("An authenticated tenant user is required.");
  }
  return { tenantId, userId: auth.principalId, auth };
}
```

用 `everyMinutes: null` 创建一次性 schedule，或用间隔创建循环 schedule：

```ts title="agent/tools/create_schedule.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";
import { scheduleStore } from "../lib/schedule-store";
import { requireScheduleOwner } from "../lib/tenant";

export default defineTool({
  description: "Create a one-time or repeating scheduled agent run for this tenant.",
  inputSchema: z.object({
    prompt: z.string().min(1).max(8000),
    channelId: z.string().min(1),
    firstRunAt: z.string().datetime({ offset: true }),
    everyMinutes: z.number().int().min(1).max(525600).nullable().default(null),
  }),
  async execute(input, ctx) {
    return await scheduleStore.create(requireScheduleOwner(ctx), {
      ...input,
      firstRunAt: new Date(input.firstRunAt),
    });
  },
});
```

```ts title="agent/tools/list_schedules.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";
import { scheduleStore } from "../lib/schedule-store";
import { requireScheduleOwner } from "../lib/tenant";

export default defineTool({
  description: "List this tenant's dynamic schedules and their latest status.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    return await scheduleStore.list(requireScheduleOwner(ctx));
  },
});
```

```ts title="agent/tools/update_schedule.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";
import { scheduleStore } from "../lib/schedule-store";
import { requireScheduleOwner } from "../lib/tenant";

export default defineTool({
  description: "Change, pause, or resume one of this tenant's schedules.",
  inputSchema: z.object({
    id: z.string().uuid(),
    prompt: z.string().min(1).max(8000).optional(),
    channelId: z.string().min(1).optional(),
    nextRunAt: z.string().datetime({ offset: true }).optional(),
    everyMinutes: z.number().int().min(1).max(525600).nullable().optional(),
    enabled: z.boolean().optional(),
  }),
  async execute({ id, nextRunAt, ...patch }, ctx) {
    return await scheduleStore.update(requireScheduleOwner(ctx), id, {
      ...patch,
      ...(nextRunAt ? { nextRunAt: new Date(nextRunAt) } : {}),
    });
  },
});
```

```ts title="agent/tools/delete_schedule.ts"
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { scheduleStore } from "../lib/schedule-store";
import { requireScheduleOwner } from "../lib/tenant";

export default defineTool({
  description: "Permanently delete one of this tenant's schedules.",
  inputSchema: z.object({ id: z.string().uuid() }),
  approval: always(),
  async execute({ id }, ctx) {
    return { deleted: await scheduleStore.delete(requireScheduleOwner(ctx), id) };
  },
});
```

## 提供 schedule adapter

eve 面向的实现依赖这个形状，而不是数据库 schema：

```ts title="agent/lib/schedule-store.ts"
import type { SessionAuthContext } from "eve/context";

export interface ScheduleOwner {
  tenantId: string;
  userId: string;
  auth: SessionAuthContext;
}

export interface ClaimedSchedule {
  id: string;
  leaseToken: string;
  tenantId: string;
  ownerId: string;
  ownerRole: string;
  authenticator: string;
  issuer?: string;
  prompt: string;
  channelId: string;
  everyMinutes: number | null;
}

export interface ScheduleStore {
  create(owner: ScheduleOwner, input: unknown): Promise<unknown>;
  list(owner: ScheduleOwner): Promise<unknown[]>;
  update(owner: ScheduleOwner, id: string, patch: unknown): Promise<unknown>;
  delete(owner: ScheduleOwner, id: string): Promise<boolean>;
  claimDue(options: { now: Date; limit: number; leaseForMs: number }): Promise<ClaimedSchedule[]>;
  complete(job: ClaimedSchedule): Promise<void>;
  release(job: ClaimedSchedule, failure: { error: unknown; retryAt: Date }): Promise<void>;
}

export { scheduleStore } from "../../lib/schedule-store";
```

用你的应用已有的任何 durable store 实现那个 adapter。它必须保留几个语义：

- 面向用户的 CRUD 总是租户 scope 的；
- `claimDue` 原子地租约行，让重叠的分钟 tick 不会认领同样的工作；
- dispatch 在返回 job 之前重新校验拥有者和目的地；
- `complete` 禁用一次性行，或计算下一次循环运行；
- 过期的租约可恢复。

投递至少一次。`receive` 成功但 `complete` 之前崩溃可能再次 dispatch，所以有副作用的任务需要应用级幂等。

## 调度 instructions

```md title="agent/instructions.md"
Before creating a schedule, confirm the user's time zone and destination.
Convert the first run to ISO 8601 with an explicit offset. Use everyMinutes only
for repeating work and null for a one-time run. List schedules before changing
an ambiguous one.
```

eve 特有的核心很小：四个工具、一个一分钟 `defineSchedule` 和主动 `receive`。存储和循环策略留在应用的 adapter 后面。
