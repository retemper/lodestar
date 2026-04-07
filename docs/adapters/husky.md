# adapter-husky

Manages git hooks via Husky. Unlike other adapters, husky has no `check` or `fix` methods -- it only provides `verifySetup` and `setup`.

**Package:** `@retemper/adapter-husky`

**Managed files:** `.husky/<hook-name>` (e.g., `.husky/pre-commit`)

## Config Options

| Option  | Type                                         | Description                                |
| ------- | -------------------------------------------- | ------------------------------------------ |
| `hooks` | `Record<string, HookDefinition \| string[]>` | Git hooks to configure -- key is hook name |

A `HookDefinition` has a `commands` array. You can also pass an array of strings directly as a shorthand.

## Example

```ts
import { huskyAdapter } from '@retemper/adapter-husky';

huskyAdapter({
  hooks: {
    'pre-commit': ['npx lodestar check'],
    'commit-msg': {
      commands: ['npx commitlint --edit "$1"'],
    },
  },
});
```

Each hook generates an executable shell script in `.husky/`:

```sh
#!/usr/bin/env sh

npx lodestar check
```

## How verifySetup Works

1. For each hook defined in the config, checks that `.husky/<hook-name>` exists in `rootDir`.
2. Reads the file content and compares it against the expected shell script.
3. Returns a **missing** violation if the hook file does not exist.
4. Returns a **drift** violation if the hook file content does not match the expected commands.
5. Returns no violations if all hook files are correct.

Running `lodestar init` or `lodestar check --fix` creates or updates the hook scripts to match the lodestar config.
