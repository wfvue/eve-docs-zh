import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { DocsBody, DocsPage } from 'fumadocs-ui/layouts/docs/page';
import { source } from '@/lib/source';

type PageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

function getPageTitle(page: ReturnType<typeof source.getPage>) {
  if (!page) return '文档';

  const data = page.data as typeof page.data & { title?: string };
  return data.title ?? page.slugs.at(-1) ?? '文档';
}

export default async function Page({ params }: PageProps) {
  const { slug = [] } = await params;
  const page = source.getPage(slug);

  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsBody>
        <MDX components={defaultMdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug = [] } = await params;
  const page = source.getPage(slug);

  if (!page) notFound();

  const data = page.data as typeof page.data & {
    title?: string;
    description?: string;
  };

  return {
    title: getPageTitle(page),
    description: data.description,
  };
}
