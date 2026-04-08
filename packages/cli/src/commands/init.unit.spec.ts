import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initCommand } from './init';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@retemper/lodestar', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn((...args: unknown[]) => console.error(...args)),
    error: vi.fn((...args: unknown[]) => console.error(...args)),
    info: vi.fn((...args: unknown[]) => console.error(...args)),
    warn: vi.fn((...args: unknown[]) => console.error(...args)),
  })),
}));

describe('initCommand', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('올바른 경로에 설정 파일을 작성한다', async () => {
    const { writeFile } = await import('node:fs/promises');

    await initCommand({} as Parameters<typeof initCommand>[0]);

    expect(writeFile).toHaveBeenCalledTimes(1);
    const [path, content, encoding] = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toContain('lodestar.config.ts');
    expect(content).toContain('defineConfig');
    expect(encoding).toBe('utf-8');
  });

  it('작성 완료 후 성공 메시지를 출력한다', async () => {
    await initCommand({} as Parameters<typeof initCommand>[0]);

    const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.includes('Created'))).toBe(true);
    expect(calls.some((c) => c.includes('lodestar.config.ts'))).toBe(true);
  });
});
