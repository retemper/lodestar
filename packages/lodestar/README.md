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
| `defineConfig`    | `@lodestar/types`  | Config 타입 추론 헬퍼   |
| `definePlugin`    | `@lodestar/types`  | 플러그인 정의           |
| `defineRule`      | `@lodestar/types`  | 규칙 정의               |
| `loadConfigFile`  | `@lodestar/config` | lodestar.config.ts 로딩 |
| `resolveConfig`   | `@lodestar/config` | Config 정규화           |
| `mergeConfigs`    | `@lodestar/config` | Config 병합             |
| `run`             | `@lodestar/core`   | 규칙 실행               |
| `createProviders` | `@lodestar/core`   | 프로바이더 생성         |
| `runWorkspace`    | `@lodestar/core`   | 모노레포 모드 실행      |

All types from `@lodestar/types` and `@lodestar/core` are re-exported.
