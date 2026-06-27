import Link from 'next/link';

const highlights = [
  {
    title: '文件即接口',
    eyebrow: 'Filesystem-first',
    description: '用 agent/ 目录组织 instructions、tools、skills（技能）、channels，把 Agent 能力变成可阅读、可维护的工程结构。',
  },
  {
    title: '持久会话',
    eyebrow: 'Durable sessions',
    description: '理解 session、stream、HITL、恢复机制和 Workflow SDK，让 Agent 不再只是一次请求一次响应。',
  },
  {
    title: '工程实践',
    eyebrow: 'Build & Deploy',
    description: '补充自托管、GitHub Pages、Hono、前端接入、权限和观测等中文工程经验。',
  },
];

const quickLinks = [
  { href: '/docs/getting-started', label: '快速开始', description: '安装、脚手架、首个工具与本地运行。' },
  { href: '/docs/tools/overview', label: '工具系统', description: '定义模型可调用的类型化动作。' },
  { href: '/docs/skills', label: '技能', description: '按需加载长流程和专项操作手册。' },
  { href: '/docs/guides/deployment', label: '部署指南', description: '构建、发布与生产环境注意事项。' },
];

const llmLinks = [
  {
    href: 'https://wfvue.github.io/eve-docs-zh/llms.txt',
    title: 'llms.txt',
    badge: '精简索引',
    description: '站点说明、推荐阅读顺序和完整文档链接，适合快速交给模型理解文档结构。',
  },
  {
    href: 'https://wfvue.github.io/eve-docs-zh/llms-full.txt',
    title: 'llms-full.txt',
    badge: '全量聚合',
    description: '构建时从 docs/ 自动聚合正文，适合大上下文模型、离线索引和 RAG。',
  },
];

const stats = [
  { value: '17+', label: '官方目录同步' },
  { value: 'Next.js', label: '静态文档站' },
  { value: 'Fumadocs', label: '文档体验' },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.20),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.18),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-6 py-10 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.18),transparent_30%),linear-gradient(180deg,rgba(2,6,23,1),rgba(15,23,42,0.96))]">
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-0 h-96 w-96 rounded-full bg-fuchsia-400/10 blur-3xl" />

      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-center">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-fd-border/70 bg-white/70 px-3 py-1 text-xs font-medium text-fd-muted-foreground shadow-sm backdrop-blur dark:bg-white/5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.9)]" />
              Eve Docs 中文项目 · 持续同步官方目录
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-fd-foreground sm:text-6xl lg:text-7xl">
              Eve 中文文档
              <span className="block bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-blue-300 dark:via-violet-300 dark:to-fuchsia-300">
                与工程实践指南
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-fd-muted-foreground sm:text-xl">
              用中文解释 Vercel Eve 的核心概念、目录结构、Agent Runtime、工具调用、技能、Channels、部署和自托管经验。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="group inline-flex items-center justify-center rounded-full bg-fd-primary px-6 py-3 text-sm font-semibold text-fd-primary-foreground shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/25"
                href="/docs/getting-started"
              >
                开始阅读
                <span className="ml-2 transition group-hover:translate-x-1">→</span>
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-full border border-fd-border/80 bg-white/70 px-6 py-3 text-sm font-semibold text-fd-foreground shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
                href="https://github.com/wfvue/eve-docs-zh"
              >
                查看 GitHub
              </Link>
            </div>

            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
              {stats.map((item) => (
                <div key={item.label} className="rounded-2xl border border-fd-border/70 bg-white/60 p-4 shadow-sm backdrop-blur dark:bg-white/5">
                  <div className="text-lg font-semibold text-fd-foreground">{item.value}</div>
                  <div className="mt-1 text-xs text-fd-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-blue-500/20 via-violet-500/20 to-fuchsia-500/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-fd-border/70 bg-white/75 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:bg-slate-950/70 dark:shadow-black/30">
              <div className="mb-5 flex items-center gap-2 border-b border-fd-border/70 pb-4">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-yellow-400" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
                <span className="ml-3 text-xs font-medium text-fd-muted-foreground">LLM-ready docs</span>
              </div>

              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">AI Context</p>
                <h2 className="mt-2 text-2xl font-semibold text-fd-foreground">给大模型读取的文档入口</h2>
                <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
                  构建时自动生成标准文本入口，让 Codex、Cursor、RAG 和大上下文模型直接读取完整文档。
                </p>
              </div>

              <div className="space-y-3">
                {llmLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group block rounded-2xl border border-fd-border/70 bg-fd-muted/35 p-4 transition hover:-translate-y-0.5 hover:border-blue-400/60 hover:bg-fd-muted/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-mono text-base font-semibold text-fd-foreground">{item.title}</div>
                      <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-300">
                        {item.badge}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">{item.description}</p>
                    <div className="mt-3 text-xs font-medium text-fd-muted-foreground transition group-hover:text-blue-500">
                      打开文件 →
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-fd-border/70 bg-white/50 p-4 text-sm shadow-sm dark:bg-white/5">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-fd-muted-foreground">Build pipeline</div>
                <div className="font-mono text-xs leading-6 text-fd-muted-foreground">
                  docs/ → generate-llms.mjs → public/llms*.txt
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {highlights.map((item) => (
            <article key={item.title} className="rounded-3xl border border-fd-border/70 bg-white/65 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-xl dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">{item.eyebrow}</p>
              <h2 className="mt-3 text-xl font-semibold text-fd-foreground">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-fd-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-3xl border border-fd-border/70 bg-white/55 p-5 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-blue-400/60 hover:shadow-xl dark:bg-white/5"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-fd-foreground">{item.label}</h3>
                <span className="text-fd-muted-foreground transition group-hover:translate-x-1 group-hover:text-blue-500">→</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
