import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteUrl = 'https://wfvue.github.io/eve-docs-zh';
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');
const docsDir = join(repoRoot, 'docs');
const publicDir = resolve(scriptDir, '..', 'public');

const markdownExts = new Set(['.md', '.mdx']);
const ignoredFiles = new Set(['meta.json']);

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  if (!(await exists(path))) return null;
  return JSON.parse(await readFile(path, 'utf8'));
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---\n')) return { data: {}, body: raw };
  const end = raw.indexOf('\n---', 4);
  if (end === -1) return { data: {}, body: raw };

  const block = raw.slice(4, end).trim();
  const data = {};
  for (const line of block.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    data[key] = value.replace(/^['"]|['"]$/g, '').trim();
  }

  return { data, body: raw.slice(end + 4).trimStart() };
}

function titleFromBody(body, fallback) {
  const heading = body.match(/^#\s+(.+)$/m);
  return heading ? heading[1].replace(/[#`*_]/g, '').trim() : fallback;
}

function slugFromFile(path) {
  const rel = relative(docsDir, path).split(sep).join('/');
  const withoutExt = rel.replace(/\.(mdx|md)$/i, '');
  if (withoutExt === 'index') return '';
  if (withoutExt.endsWith('/index')) return withoutExt.slice(0, -'/index'.length);
  return withoutExt;
}

function urlFromSlug(slug) {
  return slug ? `${siteUrl}/docs/${slug}/` : `${siteUrl}/docs/`;
}

async function collectMarkdownFiles(dir) {
  const meta = await readJson(join(dir, 'meta.json'));
  const entries = await readdir(dir, { withFileTypes: true });
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const ordered = [];
  const seen = new Set();

  for (const page of meta?.pages ?? []) {
    if (page === '---') continue;
    const md = `${page}.md`;
    const mdx = `${page}.mdx`;
    if (byName.has(md)) {
      ordered.push(join(dir, md));
      seen.add(md);
      continue;
    }
    if (byName.has(mdx)) {
      ordered.push(join(dir, mdx));
      seen.add(mdx);
      continue;
    }
    if (byName.has(page) && byName.get(page).isDirectory()) {
      ordered.push(...(await collectMarkdownFiles(join(dir, page))));
      seen.add(page);
    }
  }

  for (const entry of entries) {
    if (seen.has(entry.name) || ignoredFiles.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      ordered.push(...(await collectMarkdownFiles(path)));
      continue;
    }
    if (markdownExts.has(extname(entry.name))) ordered.push(path);
  }

  return ordered;
}

function cleanForSummary(body) {
  return body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[[^\]]+\]\([^)]+\)/g, (match) => match.replace(/^\[/, '').replace(/\]\([^)]+\)$/, ''))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => !line.startsWith('#') && !line.startsWith('|'));
}

async function buildPages() {
  const files = await collectMarkdownFiles(docsDir);
  const pages = [];

  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    const { data, body } = parseFrontmatter(raw);
    const slug = slugFromFile(file);
    const sourcePath = relative(repoRoot, file).split(sep).join('/');
    const fallback = slug.split('/').filter(Boolean).pop() ?? '文档首页';
    const title = data.title || titleFromBody(body, fallback);
    const description = data.description || cleanForSummary(body) || '';

    pages.push({
      title,
      description,
      url: urlFromSlug(slug),
      sourcePath,
      body: body.trim(),
    });
  }

  return pages;
}

function renderLlmsTxt(pages) {
  const priority = new Set([
    'docs/index.md',
    'docs/introduction.md',
    'docs/getting-started.md',
    'docs/agent-config.md',
    'docs/instructions.md',
    'docs/tools/overview.md',
    'docs/skills.md',
    'docs/channels/overview.md',
    'docs/connections/overview.md',
    'docs/sandbox.md',
    'docs/subagents.md',
  ]);
  const important = pages.filter((page) => priority.has(page.sourcePath));

  return [
    '# Eve 中文文档与工程实践指南',
    '',
    '> 面向大语言模型和开发者的 Eve 中文文档入口。本文档站解释 Vercel Eve 的 filesystem-first Agent 结构、工具、技能、渠道、连接、沙盒、子智能体、定时任务、评测和部署实践。',
    '',
    `- 站点地址：${siteUrl}`,
    `- 文档首页：${siteUrl}/docs/`,
    `- 全量 LLM 文档：${siteUrl}/llms-full.txt`,
    '',
    '## 推荐优先阅读',
    '',
    ...important.map((page) => `- [${page.title}](${page.url})${page.description ? `：${page.description}` : ''}`),
    '',
    '## 完整文档索引',
    '',
    ...pages.map((page) => `- [${page.title}](${page.url})${page.description ? `：${page.description}` : ''}`),
    '',
  ].join('\n');
}

function renderLlmsFullTxt(pages) {
  return [
    '# Eve 中文文档与工程实践指南 - 全量文档',
    '',
    `站点地址：${siteUrl}`,
    `生成来源：仓库 docs/ 目录`,'',
    '---',
    '',
    ...pages.flatMap((page) => [
      `# ${page.title}`,
      '',
      `URL: ${page.url}`,
      `Source: ${page.sourcePath}`,
      page.description ? `Description: ${page.description}` : '',
      '',
      page.body,
      '',
      '---',
      '',
    ]),
  ].join('\n');
}

const pages = await buildPages();
await mkdir(publicDir, { recursive: true });
await writeFile(join(publicDir, 'llms.txt'), renderLlmsTxt(pages), 'utf8');
await writeFile(join(publicDir, 'llms-full.txt'), renderLlmsFullTxt(pages), 'utf8');
console.log(`Generated llms.txt and llms-full.txt for ${pages.length} pages.`);
