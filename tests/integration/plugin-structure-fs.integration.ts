import { describe, it, expect, afterEach } from 'vitest';
import { createFixtureDir } from '../helpers/fixture.js';
import type { FixtureResult } from '../helpers/fixture.js';
import { createFileSystemProvider } from '@lodestar/core';
import { directoryExists, noForbiddenPath, fileNaming } from '@lodestar/plugin-structure';
import type { RuleContext, RuleProviders, Violation } from '@lodestar/types';

/** Creates RuleProviders with real fs provider */
function createRealProviders(rootDir: string): RuleProviders {
  return {
    fs: createFileSystemProvider(rootDir),
    graph: {
      getDependencies: async () => [],
      getDependents: async () => [],
      hasCircular: async () => false,
      getModuleGraph: async () => ({ nodes: new Map() }),
    },
    ast: {
      getSourceFile: async () => null,
      getImports: async () => [],
      getExports: async () => [],
    },
    config: {
      getPackageJson: async () => ({}),
      getTsConfig: async () => ({}),
      getCustomConfig: async () => ({}) as never,
    },
  };
}

/** Creates a RuleContext for testing with real providers */
function createRealContext(
  rootDir: string,
  options: Record<string, unknown>,
): { ctx: RuleContext; violations: Violation[] } {
  const violations: Violation[] = [];
  const providers = createRealProviders(rootDir);
  const ctx: RuleContext = {
    rootDir,
    options,
    providers,
    report(partial) {
      violations.push({
        ruleId: 'test',
        message: partial.message,
        location: partial.location,
        severity: 'error',
        fix: partial.fix,
      });
    },
  };
  return { ctx, violations };
}

describe('plugin-structure real file system integration test', () => {
  const fixtures: FixtureResult[] = [];

  afterEach(async () => {
    for (const f of fixtures) {
      await f.cleanup();
    }
    fixtures.length = 0;
  });

  /** Helper that creates a fixture and registers it for cleanup */
  async function setup(structure: Record<string, string | null>) {
    const fixture = await createFixtureDir(structure);
    fixtures.push(fixture);
    return fixture;
  }

  describe('structure/directory-exists', () => {
    it('reports no violations for existing directories', async () => {
      const { rootDir } = await setup({
        'src/.gitkeep': '',
        'tests/.gitkeep': '',
      });
      const { ctx, violations } = createRealContext(rootDir, {
        required: ['src', 'tests'],
      });

      await directoryExists.check(ctx);

      expect(violations).toHaveLength(0);
    });

    it('reports violations for non-existing directories', async () => {
      const { rootDir } = await setup({
        'src/.gitkeep': '',
      });
      const { ctx, violations } = createRealContext(rootDir, {
        required: ['src', 'tests', 'docs'],
      });

      await directoryExists.check(ctx);

      expect(violations).toHaveLength(2);
      expect(violations.map((v) => v.message)).toStrictEqual([
        'Required directory "tests" does not exist',
        'Required directory "docs" does not exist',
      ]);
    });

    it('can check nested directories', async () => {
      const { rootDir } = await setup({
        'src/components/.gitkeep': '',
      });
      const { ctx, violations } = createRealContext(rootDir, {
        required: ['src/components', 'src/utils'],
      });

      await directoryExists.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('src/utils');
    });

    it('reports no violations for an empty required list', async () => {
      const { rootDir } = await setup({});
      const { ctx, violations } = createRealContext(rootDir, { required: [] });

      await directoryExists.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('structure/no-forbidden-path', () => {
    it('reports violations when files match forbidden patterns', async () => {
      const { rootDir } = await setup({
        'src/app.ts': 'export {}',
        'src/temp.log': 'log content',
        'debug.log': 'root log',
      });
      const { ctx, violations } = createRealContext(rootDir, {
        patterns: ['**/*.log'],
      });

      await noForbiddenPath.check(ctx);

      expect(violations).toHaveLength(2);
      const files = violations.map((v) => v.location?.file).sort();
      expect(files).toContain('debug.log');
      expect(files).toContain('src/temp.log');
    });

    it('passes when no files match forbidden patterns', async () => {
      const { rootDir } = await setup({
        'src/app.ts': 'export {}',
        'src/utils.ts': 'export {}',
      });
      const { ctx, violations } = createRealContext(rootDir, {
        patterns: ['**/*.log'],
      });

      await noForbiddenPath.check(ctx);

      expect(violations).toHaveLength(0);
    });

    it('checks multiple forbidden patterns independently', async () => {
      const { rootDir } = await setup({
        'src/file.bak': 'backup',
        'tmp/cache.tmp': 'temp',
      });
      const { ctx, violations } = createRealContext(rootDir, {
        patterns: ['**/*.bak', '**/*.tmp'],
      });

      await noForbiddenPath.check(ctx);

      expect(violations).toHaveLength(2);
    });

    it('reports no violations in an empty directory', async () => {
      const { rootDir } = await setup({});
      const { ctx, violations } = createRealContext(rootDir, {
        patterns: ['**/*.log'],
      });

      await noForbiddenPath.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('structure/file-naming', () => {
    it('reports no violations for files that satisfy kebab-case convention', async () => {
      const { rootDir } = await setup({
        'src/my-component.ts': 'export {}',
        'src/utils.ts': 'export {}',
        'src/api-client.ts': 'export {}',
      });
      const { ctx, violations } = createRealContext(rootDir, {
        convention: 'kebab-case',
        include: ['src/**/*.ts'],
      });

      await fileNaming.check(ctx);

      expect(violations).toHaveLength(0);
    });

    it('reports violations for files that violate kebab-case convention', async () => {
      const { rootDir } = await setup({
        'src/MyComponent.ts': 'export {}',
        'src/utils.ts': 'export {}',
        'src/BadName.ts': 'export {}',
      });
      const { ctx, violations } = createRealContext(rootDir, {
        convention: 'kebab-case',
        include: ['src/**/*.ts'],
      });

      await fileNaming.check(ctx);

      expect(violations).toHaveLength(2);
      const messages = violations.map((v) => v.message);
      expect(messages.some((m) => m.includes('MyComponent'))).toBe(true);
      expect(messages.some((m) => m.includes('BadName'))).toBe(true);
    });

    it('validates component files with PascalCase convention', async () => {
      const { rootDir } = await setup({
        'components/Button.tsx': 'export {}',
        'components/input-field.tsx': 'export {}',
      });
      const { ctx, violations } = createRealContext(rootDir, {
        convention: 'PascalCase',
        include: ['components/**/*.tsx'],
      });

      await fileNaming.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('input-field');
    });

    it('checks files in nested directories', async () => {
      const { rootDir } = await setup({
        'src/deep/nested/BadFile.ts': 'export {}',
        'src/deep/nested/good-file.ts': 'export {}',
      });
      const { ctx, violations } = createRealContext(rootDir, {
        convention: 'kebab-case',
        include: ['src/**/*.ts'],
      });

      await fileNaming.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('BadFile');
    });

    it('ignores files that do not match the include pattern', async () => {
      const { rootDir } = await setup({
        'src/BadFile.ts': 'export {}',
        'lib/AnotherBad.ts': 'export {}',
      });
      const { ctx, violations } = createRealContext(rootDir, {
        convention: 'kebab-case',
        include: ['src/**/*.ts'],
      });

      await fileNaming.check(ctx);

      // Files in the lib/ directory should not be checked
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('BadFile');
    });
  });
});
