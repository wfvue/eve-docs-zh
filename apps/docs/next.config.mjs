import { createMDX } from 'fumadocs-mdx/next';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const repoBasePath = '/eve-docs-zh';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  basePath: isGitHubPages ? repoBasePath : undefined,
  assetPrefix: isGitHubPages ? `${repoBasePath}/` : undefined,
  images: {
    unoptimized: true,
  },
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
};

const withMDX = createMDX();

export default withMDX(config);
