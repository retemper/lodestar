---
layout: home

hero:
  name: Lodestar
  text: One config to govern your project.
  tagline: Architecture rules, tool configs, and setup verification — all declared in one place.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/retemper/lodestar

features:
  - title: Scattered configs? Declare once.
    details: ESLint, Prettier, Biome, Git hooks — one lodestar.config.ts generates them all. Your team agrees on rules once, not per-tool.
  - title: Config drift? Auto-fixed.
    details: Someone edited .prettierrc directly? Lodestar detects the drift and restores it with --fix. The config file is the authority — always.
  - title: Architecture rules that ESLint can't do
    details: Layer boundaries, module encapsulation, circular dependency detection. Declare your architecture in code and enforce it in CI.
  - title: Monorepo-native
    details: One command checks every package. Shared config inheritance, per-package results, automatic workspace discovery.
  - title: Know your blast radius
    details: '`lodestar impact <file>` traces every file affected by a change. Review with confidence.'
  - title: Your rules, your plugins
    details: Write custom rules in TypeScript with full access to AST, dependency graph, and file system. Share as npm packages.
---
