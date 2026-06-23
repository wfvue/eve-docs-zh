import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';
import { z } from 'zod';

const frontmatterSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

export const docs = defineDocs({
  dir: '../../docs',
  docs: {
    files: ['**/*.{md,mdx}', '!README.md'],
    schema: frontmatterSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMdxMermaid],
  },
});
