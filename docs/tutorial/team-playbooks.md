---
title: "团队手册（Team Playbooks）"
description: "Build an Agent 教程第 7 步：用键控 principal 的动态 skill 加载调用者的团队手册。"
---

# 团队手册（Team Playbooks）

第 6 步的术语表是 per-session 的。但你的团队对分析助手有长期分析约定（Growth 用某种方式跑队列留存，Finance 有自己的收入确认规则），这些不应该跨租户泄露。为提问的人加载正确团队的手册。

Skill 是按需流程。模型只在某个 turn 需要时用 `load_skill` 拉入它。让它变成动态的，skill 就在运行时决定，而不是写死。一个 `defineDynamic` resolver 读取 session 并返回一个 `defineSkill`（或不返回）。这里你把决定键控到 `ctx.session.auth` 里调用者的身份上。

## 每个 principal 一个手册

`ctx.session.auth.current` 持有最近的调用者，没有则为 `null`。它的 `attributes` 是你的认证层盖上的 claims，包括团队。读取团队、查找该团队的手册，并为它发出一个 skill：

```ts title="agent/skills/team-playbook.ts"
import { defineDynamic, defineSkill } from "eve/skills";

const PLAYBOOKS: Record<string, { title: string; markdown: string }> = {
  growth: {
    title: "Growth analysis playbook",
    markdown:
      "When analyzing retention, use weekly cohorts anchored on signup week, " +
      "report curves not point estimates, and exclude trial accounts.",
  },
  finance: {
    title: "Finance analysis playbook",
    markdown:
      "Report revenue net of refunds and recognized over the subscription term. " +
      "Always reconcile against the close-of-month snapshot.",
  },
};

export default defineDynamic({
  events: {
    "session.started": async (_event, ctx) => {
      const team = ctx.session.auth.current?.attributes.team;
      const key = Array.isArray(team) ? team[0] : team;
      const playbook = key ? PLAYBOOKS[key] : undefined;
      if (!playbook) return null;
      return defineSkill({
        description:
          `Use when answering analysis questions for the ${key} team. ` +
          `Contains that team's standing conventions.`,
        markdown: `# ${playbook.title}\n\n${playbook.markdown}`,
      });
    },
  },
});
```

`session.started` 每个 session 触发一次。Resolver 读取一次团队，结果 skill 对之后的每个 turn 保持可用。返回 `null` 不产生 skill，所以没有团队的调用者得不到手册。

## 看它路由

团队来自已认证 claims，认证层在第 9 步盖上。在那之前 `ctx.session.auth.current` 没有 `team`，所以 resolver 返回 `null`，不加载手册。要现在验证路由，在本地 dev 里盖一个团队。在 `localDev()` 之前给 `agent/channels/eve.ts` 加一个仅 dev 的条目，并在第 9 步接真实认证前移除它：

```ts title="agent/channels/eve.ts"
import { eveChannel } from "eve/channels/eve";
import { localDev, placeholderAuth, vercelOidc, type AuthFn } from "eve/channels/auth";

// Dev-only: stamp a team so Step 7's playbook resolver has something to read.
// Remove before Step 9.
const devTeam: AuthFn<Request> = () =>
  process.env.NODE_ENV === "production"
    ? null
    : {
        attributes: { team: "growth" },
        authenticator: "dev-team",
        principalId: "dev",
        principalType: "user",
      };

export default eveChannel({
  auth: [devTeam, vercelOidc(), localDev(), placeholderAuth()],
});
```

用 `npm run dev` 重启并问 "what's our 8-week retention?"。模型看到 Growth 手册匹配，调用 `load_skill`，并把 Growth 约定应用到那个 turn（周队列、无试用账户）。把 `team` 换成 `"finance"`，重启，同一个问题路由到 Finance 的手册。

因为团队来自已认证 claims，而不是消息，一个租户无法通过消息内容借用另一个租户的手册。

同一个 `defineDynamic` resolver 也驱动动态工具和 instructions。完整机制见 [动态能力（Dynamic capabilities）](../guides/dynamic-capabilities)。

→ 下一步：[守护支出（Guard the spend）](./guard-the-spend)
了解更多：[技能（Skills）](../skills) · [动态能力（Dynamic capabilities）](../guides/dynamic-capabilities)
