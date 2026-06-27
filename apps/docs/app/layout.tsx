import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Provider } from './provider';
import './global.css';

export const metadata: Metadata = {
  title: {
    default: 'Eve 中文文档',
    template: '%s | Eve 中文文档',
  },
  description: 'Eve 中文文档与工程实践指南',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
