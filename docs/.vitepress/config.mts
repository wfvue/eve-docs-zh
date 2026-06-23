import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Eve 中文文档',
  description: 'Eve 中文文档与工程实践指南',
  base: '/eve-docs-zh/',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    siteTitle: 'Eve 中文文档',
    nav: [
      { text: '首页', link: '/' },
      { text: '核心概念', link: '/core-concepts/filesystem-first' },
      { text: '部署', link: '/deployment/self-hosting' },
      { text: 'GitHub', link: 'https://github.com/wfvue/eve-docs-zh' },
      { text: '官方文档', link: 'https://eve.dev/docs' }
    ],
    sidebar: [
      {
        text: '开始',
        items: [
          { text: '文档首页', link: '/' },
          { text: '路线图', link: '/roadmap' },
          { text: '术语表', link: '/glossary' }
        ]
      },
      {
        text: '核心概念',
        items: [
          { text: 'filesystem-first', link: '/core-concepts/filesystem-first' },
          { text: 'instructions', link: '/core-concepts/instructions' },
          { text: 'tools', link: '/core-concepts/tools' },
          { text: 'skills', link: '/core-concepts/skills' },
          { text: 'sessions / runs / streaming', link: '/core-concepts/sessions-runs-streaming' },
          { text: 'Workflow SDK', link: '/core-concepts/workflow-sdk' },
          { text: 'Sandbox', link: '/core-concepts/sandbox' }
        ]
      },
      {
        text: '部署与运行',
        items: [
          { text: '自部署指南', link: '/deployment/self-hosting' }
        ]
      },
      {
        text: 'Guides',
        items: [
          { text: '鉴权与路由保护', link: '/guides/auth-and-route-protection' },
          { text: 'Instrumentation', link: '/guides/instrumentation' },
          { text: 'Evals', link: '/guides/evals' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/wfvue/eve-docs-zh' }
    ],
    editLink: {
      pattern: 'https://github.com/wfvue/eve-docs-zh/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },
    footer: {
      message: '非官方中文文档。准确 API 行为请以 eve.dev 和 vercel/eve 为准。',
      copyright: 'Released under Apache-2.0.'
    },
    search: {
      provider: 'local'
    }
  }
})
