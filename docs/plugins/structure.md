# plugin-structure

Enforces file system structure rules -- directory existence, forbidden paths, and paired file validation.

```sh
pnpm add -D @retemper/lodestar-plugin-structure
```

```ts
import { pluginStructure } from '@retemper/lodestar-plugin-structure';

export default defineConfig({
  plugins: [pluginStructure],
  rules: { ... },
});
```

## Rules

### `structure/directory-exists`

Verifies that required directories or files exist. Each entry is a glob pattern -- at least one match must be found.

```ts
'structure/directory-exists': {
  severity: 'error',
  options: {
    required: ['src', 'tests', 'docs'],
  },
}
```

**Options:**

| Option     | Type       | Description                                            |
| ---------- | ---------- | ------------------------------------------------------ |
| `required` | `string[]` | Glob patterns for paths that must exist in the project |

**Providers:** `fs`

**Behavior:**

- Each entry in `required` is treated as a glob pattern
- If no files match a pattern, a violation is reported
- For non-glob literal paths (no `*`), the auto-fix creates the missing directory
- Glob patterns do not produce an auto-fix since the intended path is ambiguous

**Example with globs:**

```ts
'structure/directory-exists': {
  severity: 'error',
  options: {
    required: [
      'src',
      'src/**/*.ts',     // at least one .ts file must exist
      'package.json',
    ],
  },
}
```

---

### `structure/no-forbidden-path`

Verifies that forbidden paths do not exist. Each entry is a glob pattern -- any match is a violation.

```ts
'structure/no-forbidden-path': {
  severity: 'error',
  options: {
    patterns: ['src/**/*.js', 'lib/**', '.env'],
  },
}
```

**Options:**

| Option     | Type       | Description                                                |
| ---------- | ---------- | ---------------------------------------------------------- |
| `patterns` | `string[]` | Glob patterns for paths that must NOT exist in the project |

**Providers:** `fs`

**Behavior:**

- Each pattern is globbed against the project
- Every matching file produces a separate violation with the matched file path
- Useful for banning compiled output in source directories, preventing committed secrets, or enforcing migration away from legacy paths

**Example -- ban legacy directories:**

```ts
'structure/no-forbidden-path': {
  severity: 'error',
  options: {
    patterns: [
      'src/**/*.js',       // no JS files in src
      'src/**/*.jsx',      // no JSX files in src
      '.env',              // no committed .env
      'dist/**',           // dist should be gitignored
    ],
  },
}
```

---

### `structure/paired-files`

Verifies that source files matching a glob have required companion files. Use `{dir}` and `{name}` placeholders in the required template to build the companion path from each source file.

```ts
'structure/paired-files': {
  severity: 'error',
  options: {
    pairs: [
      {
        source: 'src/**/*.ts',
        required: '{dir}/{name}.spec.ts',
      },
    ],
  },
}
```

**Options:**

| Option  | Type         | Description                                                  |
| ------- | ------------ | ------------------------------------------------------------ |
| `pairs` | `FilePair[]` | Pair definitions linking source files to required companions |

Each `FilePair` has:

| Field      | Type     | Required | Description                                          |
| ---------- | -------- | -------- | ---------------------------------------------------- |
| `source`   | `string` | Yes      | Glob pattern matching source files                   |
| `required` | `string` | Yes      | Template path with `{dir}` and `{name}` placeholders |
| `message`  | `string` | No       | Custom message when the paired file is missing       |

**Providers:** `fs`

**Placeholders:**

- `{dir}` -- the directory of the source file
- `{name}` -- the filename without extension

For a source file `src/utils/parser.ts`:

- `{dir}` = `src/utils`
- `{name}` = `parser`
- Template `{dir}/{name}.spec.ts` resolves to `src/utils/parser.spec.ts`

**Behavior:**

- For each source file matching the `source` glob, the required companion path is computed from the template
- If the companion file does not exist, a violation is reported
- Auto-fix creates an empty file at the expected path

**Example -- require tests and stories:**

```ts
'structure/paired-files': {
  severity: 'warn',
  options: {
    pairs: [
      {
        source: 'src/**/*.ts',
        required: '{dir}/{name}.spec.ts',
        message: 'Every module needs a test file',
      },
      {
        source: 'src/components/**/*.tsx',
        required: '{dir}/{name}.stories.tsx',
        message: 'Every component needs a Storybook story',
      },
    ],
  },
}
```
