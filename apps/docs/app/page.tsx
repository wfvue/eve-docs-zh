import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
      <p className="mb-4 text-sm font-medium text-fd-muted-foreground">Eve Docs 中文项目</p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Eve 中文文档与工程实践指南</h1>
      <p className="mt-6 max-w-2xl text-lg text-fd-muted-foreground">
        用中文解释 Vercel Eve 的核心概念、部署方式和工程接入经验。文档内容保留在根目录
        <code className="mx-1 rounded bg-fd-muted px-1.5 py-0.5">docs/</code>
        ，前端站点由 Next.js 与 Fumadocs 构建。
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          className="rounded-full bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground"
          href="/docs"
        >
          进入文档
        </Link>
        <Link className="rounded-full border px-5 py-2.5 text-sm font-medium" href="https://github.com/wfvue/eve-docs-zh">
          GitHub
        </Link>
      </div>
    </main>
  );
}
