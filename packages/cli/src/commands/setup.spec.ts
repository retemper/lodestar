import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@retemper/lodestar', () => ({
  loadConfigFile: vi.fn(),
  createLogger: vi.fn(() => ({
    debug: vi.fn((...args: unknown[]) => console.error(...args)),
    error: vi.fn((...args: unknown[]) => console.error(...args)),
    info: vi.fn((...args: unknown[]) => console.error(...args)),
    warn: vi.fn((...args: unknown[]) => console.error(...args)),
  })),
}));

import { setupCommand } from './setup';
import { loadConfigFile } from '@retemper/lodestar';

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

  it('outputs error message and sets exitCode to 1 when config file is missing', async () => {
    mockLoadConfigFile.mockResolvedValue(null);

    await setupCommand({ _: ['setup'], $0: 'lodestar' });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No lodestar.config.ts found'),
    );
    expect(process.exitCode).toBe(1);
  });

  it('prints message when no adapter with verifySetup is found', async () => {
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

  it('handles config blocks without adapter array', async () => {
    mockLoadConfigFile.mockResolvedValue({
      plugins: [],
      rules: {},
    } as never);

    await setupCommand({ _: ['setup'], $0: 'lodestar' });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No adapters with verifySetup'),
    );
  });

  it('handles array-style config', async () => {
    mockLoadConfigFile.mockResolvedValue([
      { plugins: [], rules: {} },
      { plugins: [], rules: {}, adapters: [{ name: 'adapter-no-setup' }] },
    ] as never);

    await setupCommand({ _: ['setup'], $0: 'lodestar' });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No adapters with verifySetup'),
    );
  });

  it('outputs checkmark when there are no violations', async () => {
    const mockVerifySetup = vi.fn().mockResolvedValue([]);
    mockLoadConfigFile.mockResolvedValue({
      plugins: [],
      rules: {},
      adapters: [{ name: 'ts-adapter', verifySetup: mockVerifySetup }],
    } as never);

    await setupCommand({ _: ['setup'], $0: 'lodestar' });

    const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.includes('Verifying ts-adapter'))).toBe(true);
    expect(calls.some((c) => c.includes('✓'))).toBe(true);
  });

  it('applies fix and outputs done when violation has fix', async () => {
    const mockApply = vi.fn().mockResolvedValue(undefined);
    const mockVerifySetup = vi
      .fn()
      .mockResolvedValue([{ message: 'tsconfig missing', fix: { apply: mockApply } }]);
    mockLoadConfigFile.mockResolvedValue({
      plugins: [],
      rules: {},
      adapters: [{ name: 'ts-adapter', verifySetup: mockVerifySetup }],
    } as never);

    await setupCommand({ _: ['setup'], $0: 'lodestar' });

    expect(mockApply).toHaveBeenCalledTimes(1);
    const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.includes('Fixing: tsconfig missing'))).toBe(true);
    expect(calls.some((c) => c.includes('done'))).toBe(true);
  });

  it('outputs only message and shows done when violation has no fix', async () => {
    const mockVerifySetup = vi.fn().mockResolvedValue([{ message: 'manual fix needed' }]);
    mockLoadConfigFile.mockResolvedValue({
      plugins: [],
      rules: {},
      adapters: [{ name: 'ts-adapter', verifySetup: mockVerifySetup }],
    } as never);

    await setupCommand({ _: ['setup'], $0: 'lodestar' });

    const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.includes('manual fix needed'))).toBe(true);
    expect(calls.some((c) => c.includes('done'))).toBe(true);
  });

  it('runs verifySetup for each adapter when multiple adapters exist', async () => {
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
