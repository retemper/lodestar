# lodestar

Umbrella package for Lodestar — re-exports the core public API.

## Installation

```sh
npm install -D lodestar
```

## Usage

```ts
import { defineConfig, run, loadConfigFile, resolveConfig } from 'lodestar';

const written = await loadConfigFile(process.cwd());
const config = resolveConfig(written, process.cwd());
const summary = await run({ config });
```

## Exports

| Export            | From               | Description             |
| ----------------- | ------------------ | ----------------------- |
| `defineConfig`    | `@retemper/types`  | Config 타입 추론 헬퍼   |
| `definePlugin`    | `@retemper/types`  | 플러그인 정의           |
| `defineRule`      | `@retemper/types`  | 규칙 정의               |
| `loadConfigFile`  | `@retemper/config` | lodestar.config.ts 로딩 |
| `resolveConfig`   | `@retemper/config` | Config 정규화           |
| `mergeConfigs`    | `@retemper/config` | Config 병합             |
| `run`             | `@retemper/core`   | 규칙 실행               |
| `createProviders` | `@retemper/core`   | 프로바이더 생성         |
| `runWorkspace`    | `@retemper/core`   | 모노레포 모드 실행      |

All types from `@retemper/types` and `@retemper/core` are re-exported.
