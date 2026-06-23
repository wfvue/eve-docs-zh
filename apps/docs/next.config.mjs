import { createMDX } from 'fumadocs-mdx/next';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const repoBasePath = '/eve-docs-zh';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  ...(isGitHubPages
    ? {
        basePath: repoBasePath,
        assetPrefix: `${repoBasePath}/`,
      }
    : {}),
  images: {
    unoptimized: true,
  },
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
};

const withMDX = createMDX();

export default withMDX(config);
