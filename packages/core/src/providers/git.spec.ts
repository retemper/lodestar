import { describe, it, expect, afterAll } from 'vitest';
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

describe('createGitProvider', () => {
  describe('currentBranch', () => {
    it('현재 브랜치 이름을 반환한다', async () => {
      const rootDir = await setupGitRepo();
      const git = createGitProvider(rootDir);

      const branch = await git.currentBranch();

      // git init creates 'main' or 'master' depending on git config
      expect(typeof branch).toBe('string');
      expect(branch).toBeTruthy();
    });

    it('detached HEAD 상태에서는 null을 반환한다', async () => {
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
    });
  });

  describe('stagedFiles', () => {
    it('GIT_INDEX_FILE이 없으면 빈 배열을 반환한다', async () => {
      const rootDir = await setupGitRepo();
      const git = createGitProvider(rootDir);

      // Ensure GIT_INDEX_FILE is not set
      delete process.env.GIT_INDEX_FILE;

      const staged = await git.stagedFiles();

      expect(staged).toStrictEqual([]);
    });

    it('GIT_INDEX_FILE이 있으면 staged 파일을 반환한다', async () => {
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
    });
  });

  describe('diffFiles', () => {
    it('두 커밋 사이의 변경된 파일 목록을 반환한다', async () => {
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
    });
  });

  describe('diffContent', () => {
    it('staged 파일의 diff를 반환한다', async () => {
      const rootDir = await setupGitRepo();

      // Modify existing file and stage it
      await writeFile(join(rootDir, 'README.md'), '# Updated', 'utf-8');
      await execFileAsync('git', ['add', 'README.md'], { cwd: rootDir });

      const git = createGitProvider(rootDir);
      const diff = await git.diffContent('README.md', { staged: true });

      expect(diff).toContain('Updated');
      expect(diff).toContain('diff --git');
    });

    it('base ref 기준 diff를 반환한다', async () => {
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
    });
  });

  describe('isAncestor', () => {
    it('ancestor가 맞으면 true를 반환한다', async () => {
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
    });

    it('ancestor가 아니면 false를 반환한다', async () => {
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
    });
  });

  describe('diffContent without options', () => {
    it('옵션 없이 호출하면 working tree diff를 반환한다', async () => {
      const rootDir = await setupGitRepo();

      // Modify file without staging
      await writeFile(join(rootDir, 'README.md'), '# Working tree change', 'utf-8');

      const git = createGitProvider(rootDir);
      const diff = await git.diffContent('README.md');

      expect(diff).toContain('Working tree change');
    });
  });

  describe('diffFiles without head', () => {
    it('head를 생략하면 HEAD를 기본값으로 사용한다', async () => {
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
    });
  });

  describe('isAncestor without descendant', () => {
    it('descendant를 생략하면 HEAD를 기본값으로 사용한다', async () => {
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
    });
  });

  describe('execGit', () => {
    it('성공한 git 명령의 stdout을 반환한다', async () => {
      const rootDir = await setupGitRepo();
      const result = await execGit(['rev-parse', '--git-dir'], rootDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBeTruthy();
    });

    it('allowNonZero=false이면 non-zero exit code에서 reject한다', async () => {
      const rootDir = await setupGitRepo();

      await expect(
        execGit(['merge-base', '--is-ancestor', 'HEAD', 'nonexistent-ref'], rootDir, false),
      ).rejects.toThrow();
    });

    it('allowNonZero=true이면 non-zero exit code를 resolve한다', async () => {
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
    });
  });

  describe('git이 없는 환경', () => {
    it('git 저장소가 아닌 디렉토리에서 에러를 던진다', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-git-test-nogit-'));
      dirs.push(rootDir);
      const git = createGitProvider(rootDir);

      await expect(git.currentBranch()).rejects.toThrow('Git is not available');
    });

    it('한 번 실패한 후 다시 호출해도 에러를 던진다', async () => {
      const rootDir = await mkdtemp(join(tmpdir(), 'lodestar-git-test-nogit2-'));
      dirs.push(rootDir);
      const git = createGitProvider(rootDir);

      await expect(git.currentBranch()).rejects.toThrow('Git is not available');
      // Second call should also throw (cached failure)
      await expect(git.stagedFiles()).rejects.toThrow('Git is not available');
    });
  });
});
