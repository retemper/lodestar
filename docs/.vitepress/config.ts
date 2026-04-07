import { defineConfig } from 'vitepress';

const sharedHead = [
  ['meta', { property: 'og:type', content: 'website' }],
  ['meta', { property: 'og:url', content: 'https://retemper.github.io/lodestar/' }],
  ['meta', { name: 'twitter:card', content: 'summary' }],
  ['link', { rel: 'canonical', href: 'https://retemper.github.io/lodestar/' }],
  ['link', { rel: 'author', type: 'text/plain', href: '/lodestar/llm.txt' }],
] as const;

export default defineConfig({
  title: 'Lodestar',
  base: '/lodestar/',
  cleanUrls: true,
  sitemap: {
    hostname: 'https://retemper.github.io/lodestar',
  },
  head: [
    ...sharedHead,
    ['meta', { property: 'og:title', content: 'Lodestar' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'One config to govern your project — architecture rules, tool configs, and setup verification.',
      },
    ],
    ['meta', { name: 'twitter:title', content: 'Lodestar' }],
    [
      'meta',
      {
        name: 'twitter:description',
        content:
          'One config to govern your project — architecture rules, tool configs, and setup verification.',
      },
    ],
  ],
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      description:
        'One config to govern your project — architecture rules, tool configs, and setup verification.',
    },
    ko: {
      label: '한국어',
      lang: 'ko-KR',
      description: '하나의 설정으로 프로젝트를 통치합니다 — 아키텍처 규칙, 도구 설정, 셋업 검증.',
      themeConfig: {
        nav: [
          { text: '가이드', link: '/ko/guide/getting-started' },
          { text: '플러그인', link: '/ko/plugins/architecture' },
          { text: '어댑터', link: '/ko/adapters/eslint' },
          { text: 'API', link: '/ko/api/config' },
          {
            text: '링크',
            items: [
              {
                text: '체인지로그',
                link: 'https://github.com/retemper/lodestar/releases',
              },
              {
                text: '기여하기',
                link: 'https://github.com/retemper/lodestar/blob/main/CONTRIBUTING.md',
              },
            ],
          },
        ],
        sidebar: {
          '/ko/guide/': [
            {
              text: '소개',
              items: [
                { text: 'Lodestar란?', link: '/ko/guide/what-is-lodestar' },
                { text: '시작하기', link: '/ko/guide/getting-started' },
              ],
            },
            {
              text: '핵심 개념',
              items: [
                { text: '규칙(Rules)', link: '/ko/guide/rules' },
                { text: '플러그인(Plugins)', link: '/ko/guide/plugins' },
                { text: '설정(Configuration)', link: '/ko/guide/configuration' },
              ],
            },
            {
              text: '모노레포',
              items: [{ text: '워크스페이스 모드', link: '/ko/guide/workspace' }],
            },
            {
              text: '확장',
              items: [
                { text: '커스텀 규칙', link: '/ko/guide/custom-rules' },
                { text: '커스텀 플러그인', link: '/ko/guide/custom-plugins' },
              ],
            },
          ],
          '/ko/plugins/': [
            {
              text: '공식 플러그인',
              items: [
                { text: 'plugin-architecture', link: '/ko/plugins/architecture' },
                { text: 'plugin-structure', link: '/ko/plugins/structure' },
              ],
            },
          ],
          '/ko/adapters/': [
            {
              text: '공식 어댑터',
              items: [
                { text: 'adapter-eslint', link: '/ko/adapters/eslint' },
                { text: 'adapter-prettier', link: '/ko/adapters/prettier' },
                { text: 'adapter-biome', link: '/ko/adapters/biome' },
                { text: 'adapter-husky', link: '/ko/adapters/husky' },
                { text: 'adapter-lint-staged', link: '/ko/adapters/lint-staged' },
                { text: 'adapter-commitlint', link: '/ko/adapters/commitlint' },
                { text: 'adapter-knip', link: '/ko/adapters/knip' },
                { text: 'adapter-stylelint', link: '/ko/adapters/stylelint' },
              ],
            },
          ],
          '/ko/api/': [
            {
              text: '설정',
              items: [
                { text: '설정 파일', link: '/ko/api/config' },
                { text: 'CLI', link: '/ko/api/cli' },
              ],
            },
            {
              text: '규칙 작성',
              items: [
                { text: 'defineRule', link: '/ko/api/define-rule' },
                { text: 'definePlugin', link: '/ko/api/define-plugin' },
                { text: 'Providers', link: '/ko/api/providers' },
              ],
            },
            {
              text: '패키지',
              items: [
                { text: '@retemper/types', link: '/ko/api/types' },
                { text: '@retemper/config', link: '/ko/api/config-api' },
                { text: '@retemper/core', link: '/ko/api/core' },
                { text: '@retemper/test-utils', link: '/ko/api/test-utils' },
              ],
            },
          ],
        },
      },
    },
  },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Plugins', link: '/plugins/architecture' },
      { text: 'Adapters', link: '/adapters/eslint' },
      { text: 'API', link: '/api/config' },
      {
        text: 'Links',
        items: [
          {
            text: 'Changelog',
            link: 'https://github.com/retemper/lodestar/releases',
          },
          {
            text: 'Contributing',
            link: 'https://github.com/retemper/lodestar/blob/main/CONTRIBUTING.md',
          },
        ],
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Lodestar?', link: '/guide/what-is-lodestar' },
            { text: 'Getting Started', link: '/guide/getting-started' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Rules', link: '/guide/rules' },
            { text: 'Plugins', link: '/guide/plugins' },
            { text: 'Configuration', link: '/guide/configuration' },
          ],
        },
        {
          text: 'Monorepo',
          items: [{ text: 'Workspace Mode', link: '/guide/workspace' }],
        },
        {
          text: 'Extending',
          items: [
            { text: 'Custom Rules', link: '/guide/custom-rules' },
            { text: 'Custom Plugins', link: '/guide/custom-plugins' },
          ],
        },
      ],
      '/plugins/': [
        {
          text: 'Official Plugins',
          items: [
            { text: 'plugin-architecture', link: '/plugins/architecture' },
            { text: 'plugin-structure', link: '/plugins/structure' },
          ],
        },
      ],
      '/adapters/': [
        {
          text: 'Official Adapters',
          items: [
            { text: 'adapter-eslint', link: '/adapters/eslint' },
            { text: 'adapter-prettier', link: '/adapters/prettier' },
            { text: 'adapter-biome', link: '/adapters/biome' },
            { text: 'adapter-husky', link: '/adapters/husky' },
            { text: 'adapter-lint-staged', link: '/adapters/lint-staged' },
            { text: 'adapter-commitlint', link: '/adapters/commitlint' },
            { text: 'adapter-knip', link: '/adapters/knip' },
            { text: 'adapter-stylelint', link: '/adapters/stylelint' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'Configuration',
          items: [
            { text: 'Config File', link: '/api/config' },
            { text: 'CLI', link: '/api/cli' },
          ],
        },
        {
          text: 'Rule Authoring',
          items: [
            { text: 'defineRule', link: '/api/define-rule' },
            { text: 'definePlugin', link: '/api/define-plugin' },
            { text: 'Providers', link: '/api/providers' },
          ],
        },
        {
          text: 'Packages',
          items: [
            { text: '@retemper/types', link: '/api/types' },
            { text: '@retemper/config', link: '/api/config-api' },
            { text: '@retemper/core', link: '/api/core' },
            { text: '@retemper/test-utils', link: '/api/test-utils' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/retemper/lodestar' }],
    search: {
      provider: 'local',
    },
    editLink: {
      pattern: 'https://github.com/retemper/lodestar/edit/main/docs/:path',
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026-present Lodestar contributors',
    },
  },
});
