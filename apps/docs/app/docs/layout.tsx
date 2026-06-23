import type { ReactNode } from 'react';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      nav={{
        title: 'Eve 中文文档',
      }}
      githubUrl="https://github.com/wfvue/eve-docs-zh"
    >
      {children}
    </DocsLayout>
  );
}
