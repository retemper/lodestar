import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('lodestar', () => ({
  loadConfigFile: vi.fn(),
}));

import { setupCommand } from './setup';
import { loadConfigFile } from 'lodestar';

const mockLoadConfigFile = vi.mocked(loadConfigFile);

describe('setupCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it('설정 파일이 없으면 에러 메시지를 출력하고 exitCode를 1로 설정한다', async () => {
    mockLoadConfigFile.mockResolvedValue(null);

    await setupCommand({ _: ['setup'], $0: 'lodestar' });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No lodestar.config.ts found'),
      expect.any(String),
    );
    expect(process.exitCode).toBe(1);
  });

  it('verifySetup이 있는 어댑터가 없으면 메시지를 출력한다', async () => {
    mockLoadConfigFile.mockResolvedValue({
      plugins: [],
      rules: {},
      adapters: [{ name: 'test-adapter' }],
    } as never);

    await setupCommand({ _: ['setup'], $0: 'lodestar' });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No adapters with verifySetup'),
    );
  });

  it('어댑터 배열이 없는 config block도 처리한다', async () => {
    mockLoadConfigFile.mockResolvedValue({
      plugins: [],
      rules: {},
    } as never);

    await setupCommand({ _: ['setup'], $0: 'lodestar' });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No adapters with verifySetup'),
    );
  });

  it('배열 형태의 config를 처리한다', async () => {
    mockLoadConfigFile.mockResolvedValue([
      { plugins: [], rules: {} },
      { plugins: [], rules: {}, adapters: [{ name: 'adapter-no-setup' }] },
    ] as never);

    await setupCommand({ _: ['setup'], $0: 'lodestar' });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No adapters with verifySetup'),
    );
  });

  it('위반이 없으면 체크마크를 출력한다', async () => {
    const mockVerifySetup = vi.fn().mockResolvedValue([]);
    mockLoadConfigFile.mockResolvedValue({
      plugins: [],
      rules: {},
      adapters: [{ name: 'ts-adapter', verifySetup: mockVerifySetup }],
    } as never);

    await setupCommand({ _: ['setup'], $0: 'lodestar' });

    const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(calls.some((c) => c.includes('Verifying ts-adapter'))).toBe(true);
    expect(calls.some((c) => c.includes('✓'))).toBe(true);
  });

  it('fix가 있는 위반이면 fix를 적용하고 done을 출력한다', async () => {
    const mockApply = vi.fn().mockResolvedValue(undefined);
    const mockVerifySetup = vi.fn().mockResolvedValue([
      { message: 'tsconfig missing', fix: { apply: mockApply } },
    ]);
    mockLoadConfigFile.mockResolvedValue({
      plugins: [],
      rules: {},
      adapters: [{ name: 'ts-adapter', verifySetup: mockVerifySetup }],
    } as never);

    await setupCommand({ _: ['setup'], $0: 'lodestar' });

    expect(mockApply).toHaveBeenCalledTimes(1);
    const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(calls.some((c) => c.includes('Fixing: tsconfig missing'))).toBe(true);
    expect(calls.some((c) => c.includes('done'))).toBe(true);
  });

  it('fix가 없는 위반이면 메시지만 출력하고 done을 표시한다', async () => {
    const mockVerifySetup = vi.fn().mockResolvedValue([
      { message: 'manual fix needed' },
    ]);
    mockLoadConfigFile.mockResolvedValue({
      plugins: [],
      rules: {},
      adapters: [{ name: 'ts-adapter', verifySetup: mockVerifySetup }],
    } as never);

    await setupCommand({ _: ['setup'], $0: 'lodestar' });

    const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(calls.some((c) => c.includes('manual fix needed'))).toBe(true);
    expect(calls.some((c) => c.includes('done'))).toBe(true);
  });

  it('여러 어댑터가 있으면 각각 verifySetup을 실행한다', async () => {
    const mockVerifySetup1 = vi.fn().mockResolvedValue([]);
    const mockVerifySetup2 = vi.fn().mockResolvedValue([]);
    mockLoadConfigFile.mockResolvedValue({
      plugins: [],
      rules: {},
      adapters: [
        { name: 'adapter-1', verifySetup: mockVerifySetup1 },
        { name: 'adapter-2', verifySetup: mockVerifySetup2 },
      ],
    } as never);

    await setupCommand({ _: ['setup'], $0: 'lodestar' });

    expect(mockVerifySetup1).toHaveBeenCalledTimes(1);
    expect(mockVerifySetup2).toHaveBeenCalledTimes(1);
  });
});
