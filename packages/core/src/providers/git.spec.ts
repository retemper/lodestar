import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createGitProvider, execGit } from './git';

const execFileAsync = promisify(execFile);

/** List of temporary directories to clean up */
const dirs: string[] = [];

/** Creates a temporary git repository with an initial commit */
async function setupGitRepo(): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-git-test-'));
  dirs.push(rootDir);

  await execFileAsync('git', ['init'], { cwd: rootDir });
  await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: rootDir });
  await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: rootDir });

  // Create initial commit
  await writeFile(join(rootDir, 'README.md'), '# Test', 'utf-8');
  await execFileAsync('git', ['add', '.'], { cwd: rootDir });
  await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: rootDir });

  return rootDir;
}

afterAll(async () => {
  for (const dir of dirs) {
    await rm(dir, { recursive: true, force: true });
  }
});

// Shared repo setup for tests that only need a basic git repo.
// Reduces Windows CI time by avoiding repeated git init + commit.
let sharedRepo: string;
beforeAll(async () => {
  sharedRepo = await setupGitRepo();
}, 30_000);

describe('createGitProvider', () => {
  describe('currentBranch', () => {
    it('returns current branch name', async () => {
      const git = createGitProvider(sharedRepo);
      const branch = await git.currentBranch();

      // git init creates 'main' or 'master' depending on git config
      expect(typeof branch).toBe('string');
      expect(branch).toBeTruthy();
    });

    it('returns null in detached HEAD state', async () => {
      const rootDir = await setupGitRepo();

      // Create a second commit to detach from
      await writeFile(join(rootDir, 'file.txt'), 'content', 'utf-8');
      await execFileAsync('git', ['add', '.'], { cwd: rootDir });
      await execFileAsync('git', ['commit', '-m', 'second'], { cwd: rootDir });
      const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: rootDir });
      await execFileAsync('git', ['checkout', stdout.trim()], { cwd: rootDir });

      const git = createGitProvider(rootDir);
      const branch = await git.currentBranch();

      expect(branch).toBeNull();
    }, 30_000);
  });

  describe('stagedFiles', () => {
    it('returns empty array when GIT_INDEX_FILE is missing', async () => {
      const git = createGitProvider(sharedRepo);

      // Ensure GIT_INDEX_FILE is not set
      delete process.env.GIT_INDEX_FILE;

      const staged = await git.stagedFiles();

      expect(staged).toStrictEqual([]);
    });

    it('returns staged files when GIT_INDEX_FILE exists', async () => {
      const rootDir = await setupGitRepo();

      // Stage a new file
      await writeFile(join(rootDir, 'new-file.ts'), 'export {}', 'utf-8');
      await execFileAsync('git', ['add', 'new-file.ts'], { cwd: rootDir });

      // Simulate commit hook context
      const originalEnv = process.env.GIT_INDEX_FILE;
      process.env.GIT_INDEX_FILE = join(rootDir, '.git/index');

      try {
        const git = createGitProvider(rootDir);
        const staged = await git.stagedFiles();

        expect(staged).toContain('new-file.ts');
      } finally {
        if (originalEnv === undefined) {
          delete process.env.GIT_INDEX_FILE;
        } else {
          process.env.GIT_INDEX_FILE = originalEnv;
        }
      }
    }, 30_000);
  });

  describe('diffFiles', () => {
    it('returns list of changed files between two commits', async () => {
      const rootDir = await setupGitRepo();

      // Get first commit ref
      const { stdout: base } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd: rootDir,
      });

      // Create a new commit with changes
      await mkdir(join(rootDir, 'src'), { recursive: true });
      await writeFile(join(rootDir, 'src/app.ts'), 'console.log("hi")', 'utf-8');
      await execFileAsync('git', ['add', '.'], { cwd: rootDir });
      await execFileAsync('git', ['commit', '-m', 'add app'], { cwd: rootDir });

      const git = createGitProvider(rootDir);
      const files = await git.diffFiles(base.trim(), 'HEAD');

      expect(files).toContain('src/app.ts');
    }, 30_000);

    it('uses HEAD as default when head is omitted', async () => {
      const rootDir = await setupGitRepo();

      const { stdout: base } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd: rootDir,
      });

      await writeFile(join(rootDir, 'new.ts'), 'export {}', 'utf-8');
      await execFileAsync('git', ['add', '.'], { cwd: rootDir });
      await execFileAsync('git', ['commit', '-m', 'add new'], { cwd: rootDir });

      const git = createGitProvider(rootDir);
      const files = await git.diffFiles(base.trim());

      expect(files).toContain('new.ts');
    }, 30_000);
  });

  describe('diffContent', () => {
    it('returns diff of staged files', async () => {
      const rootDir = await setupGitRepo();

      // Modify existing file and stage it
      await writeFile(join(rootDir, 'README.md'), '# Updated', 'utf-8');
      await execFileAsync('git', ['add', 'README.md'], { cwd: rootDir });

      const git = createGitProvider(rootDir);
      const diff = await git.diffContent('README.md', { staged: true });

      expect(diff).toContain('Updated');
      expect(diff).toContain('diff --git');
    }, 30_000);

    it('returns diff relative to base ref', async () => {
      const rootDir = await setupGitRepo();

      const { stdout: base } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd: rootDir,
      });

      await writeFile(join(rootDir, 'README.md'), '# Changed', 'utf-8');
      await execFileAsync('git', ['add', '.'], { cwd: rootDir });
      await execFileAsync('git', ['commit', '-m', 'change readme'], { cwd: rootDir });

      const git = createGitProvider(rootDir);
      const diff = await git.diffContent('README.md', { base: base.trim() });

      expect(diff).toContain('Changed');
    }, 30_000);

    it('returns working tree diff when called without options', async () => {
      const rootDir = await setupGitRepo();

      // Modify file without staging
      await writeFile(join(rootDir, 'README.md'), '# Working tree change', 'utf-8');

      const git = createGitProvider(rootDir);
      const diff = await git.diffContent('README.md');

      expect(diff).toContain('Working tree change');
    }, 30_000);
  });

  describe('isAncestor', () => {
    it('returns true when it is an ancestor', async () => {
      const rootDir = await setupGitRepo();

      const { stdout: ancestor } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd: rootDir,
      });

      // Create a new commit
      await writeFile(join(rootDir, 'file.txt'), 'content', 'utf-8');
      await execFileAsync('git', ['add', '.'], { cwd: rootDir });
      await execFileAsync('git', ['commit', '-m', 'child'], { cwd: rootDir });

      const git = createGitProvider(rootDir);
      const result = await git.isAncestor(ancestor.trim(), 'HEAD');

      expect(result).toBe(true);
    }, 30_000);

    it('returns false when it is not an ancestor', async () => {
      const rootDir = await setupGitRepo();

      // Create two diverging branches
      await execFileAsync('git', ['checkout', '-b', 'branch-a'], { cwd: rootDir });
      await writeFile(join(rootDir, 'a.txt'), 'a', 'utf-8');
      await execFileAsync('git', ['add', '.'], { cwd: rootDir });
      await execFileAsync('git', ['commit', '-m', 'a'], { cwd: rootDir });
      const { stdout: commitA } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd: rootDir,
      });

      await execFileAsync('git', ['checkout', '-b', 'branch-b', 'HEAD~1'], { cwd: rootDir });
      await writeFile(join(rootDir, 'b.txt'), 'b', 'utf-8');
      await execFileAsync('git', ['add', '.'], { cwd: rootDir });
      await execFileAsync('git', ['commit', '-m', 'b'], { cwd: rootDir });

      const git = createGitProvider(rootDir);
      const result = await git.isAncestor(commitA.trim(), 'HEAD');

      expect(result).toBe(false);
    }, 30_000);

    it('uses HEAD as default when descendant is omitted', async () => {
      const rootDir = await setupGitRepo();

      const { stdout: ancestor } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd: rootDir,
      });

      await writeFile(join(rootDir, 'file.txt'), 'content', 'utf-8');
      await execFileAsync('git', ['add', '.'], { cwd: rootDir });
      await execFileAsync('git', ['commit', '-m', 'child'], { cwd: rootDir });

      const git = createGitProvider(rootDir);
      const result = await git.isAncestor(ancestor.trim());

      expect(result).toBe(true);
    }, 30_000);
  });

  describe('execGit', () => {
    it('returns stdout of successful git command', async () => {
      const result = await execGit(['rev-parse', '--git-dir'], sharedRepo);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBeTruthy();
    });

    it('rejects on non-zero exit code when allowNonZero=false', async () => {
      await expect(
        execGit(['merge-base', '--is-ancestor', 'HEAD', 'nonexistent-ref'], sharedRepo, false),
      ).rejects.toThrow();
    });

    it('resolves on non-zero exit code when allowNonZero=true', async () => {
      const rootDir = await setupGitRepo();

      // Create diverging branches so isAncestor returns exit code 1
      await execFileAsync('git', ['checkout', '-b', 'test-a'], { cwd: rootDir });
      await writeFile(join(rootDir, 'a.txt'), 'a', 'utf-8');
      await execFileAsync('git', ['add', '.'], { cwd: rootDir });
      await execFileAsync('git', ['commit', '-m', 'a'], { cwd: rootDir });
      const { stdout: commitA } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd: rootDir,
      });

      await execFileAsync('git', ['checkout', '-b', 'test-b', 'HEAD~1'], { cwd: rootDir });
      await writeFile(join(rootDir, 'b.txt'), 'b', 'utf-8');
      await execFileAsync('git', ['add', '.'], { cwd: rootDir });
      await execFileAsync('git', ['commit', '-m', 'b'], { cwd: rootDir });

      const result = await execGit(
        ['merge-base', '--is-ancestor', commitA.trim(), 'HEAD'],
        rootDir,
        true,
      );

      expect(result.exitCode).toBe(1);
    }, 30_000);
  });

  describe('environment without git', () => {
    it('throws error in non-git directory', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-git-test-nogit-'));
      dirs.push(rootDir);
      const git = createGitProvider(rootDir);

      await expect(git.currentBranch()).rejects.toThrow('Git is not available');
    });

    it('throws error when called again after failing once', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-git-test-nogit2-'));
      dirs.push(rootDir);
      const git = createGitProvider(rootDir);

      await expect(git.currentBranch()).rejects.toThrow('Git is not available');
      // Second call should also throw (cached failure)
      await expect(git.stagedFiles()).rejects.toThrow('Git is not available');
    });
  });
});
