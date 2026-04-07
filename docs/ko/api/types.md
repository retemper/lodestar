# @retemper/types

모든 Lodestar 패키지에서 공유되는 런타임 비용 없는 타입 정의입니다.

```sh
pnpm add -D @retemper/types
```

이 패키지는 플러그인(Plugin) 작성자를 위한 피어 의존성(peer dependency)입니다. 플러그인이 구현하는 핵심 인터페이스를 제공합니다.

## 주요 내보내기(Exports)

```ts
// 규칙 작성
export type { RuleDefinition, RuleContext, RuleProviders };

// 프로바이더
export type { FileSystemProvider, DependencyGraphProvider, ASTProvider, ConfigFileProvider };

// 위반 사항
export type { Violation, SourceLocation, Severity, Fix };

// 플러그인
export type { PluginDefinition };

// 설정
export type { WrittenConfig, ResolvedConfig, WrittenRuleConfig, ResolvedRuleConfig };

// 그래프
export type { ModuleGraph, ModuleNode, ImportInfo, ExportInfo };

// 리포터
export type { Reporter, RunSummary };

// 헬퍼
export { defineRule, definePlugin };
```
