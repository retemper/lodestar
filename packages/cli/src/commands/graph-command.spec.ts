import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ModuleNode } from '@retemper/lodestar';
import { createServer } from 'node:http';

vi.mock('node:http', () => ({
  createServer: vi.fn(),
}));

vi.mock('@retemper/lodestar', () => ({
  createProviders: vi.fn(),
  loadConfigFile: vi.fn(),
  createLogger: vi.fn(() => ({
    debug: vi.fn((...args: unknown[]) => console.error(...args)),
    error: vi.fn((...args: unknown[]) => console.error(...args)),
    info: vi.fn((...args: unknown[]) => console.error(...args)),
    warn: vi.fn((...args: unknown[]) => console.error(...args)),
  })),
}));

const mockCreateServer = vi.mocked(createServer);

import { graphCommand } from './graph';
import { createProviders, loadConfigFile } from '@retemper/lodestar';

const mockCreateProviders = vi.mocked(createProviders);
const mockLoadConfigFile = vi.mocked(loadConfigFile);

/** Creates a module node map for testing */
function makeNodes(defs: Record<string, string[]>): ReadonlyMap<string, ModuleNode> {
  const nodes = new Map<string, ModuleNode>();
  for (const [id, deps] of Object.entries(defs)) {
    nodes.set(id, { id, dependencies: deps, dependents: [] });
  }
  return nodes;
}

describe('graphCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  describe('파일 레벨 그래프', () => {
    it('mermaid 형식으로 의존성 그래프를 출력한다', async () => {
      const nodes = makeNodes({
        'src/a.ts': ['src/b.ts'],
        'src/b.ts': [],
      });
      mockCreateProviders.mockReturnValue({
        graph: { getModuleGraph: vi.fn().mockResolvedValue({ nodes }) },
      } as never);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'mermaid' });

      const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain('graph TD');
      expect(output).toContain('"src/a.ts" --> "src/b.ts"');
    });

    it('dot 형식으로 의존성 그래프를 출력한다', async () => {
      const nodes = makeNodes({
        'src/a.ts': ['src/b.ts'],
        'src/b.ts': [],
      });
      mockCreateProviders.mockReturnValue({
        graph: { getModuleGraph: vi.fn().mockResolvedValue({ nodes }) },
      } as never);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'dot' });

      const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain('digraph dependencies');
    });

    it('의존성이 없으면 메시지를 출력하고 반환한다', async () => {
      const nodes = makeNodes({ 'src/a.ts': [] });
      mockCreateProviders.mockReturnValue({
        graph: { getModuleGraph: vi.fn().mockResolvedValue({ nodes }) },
      } as never);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'mermaid' });

      expect(console.error).toHaveBeenCalledWith('No dependencies found.');
      expect(process.stdout.write).not.toHaveBeenCalled();
    });

    it('scope 옵션을 전달한다', async () => {
      const nodes = makeNodes({
        'src/domain/a.ts': ['src/domain/b.ts'],
        'src/domain/b.ts': [],
        'src/infra/c.ts': ['src/domain/a.ts'],
      });
      mockCreateProviders.mockReturnValue({
        graph: { getModuleGraph: vi.fn().mockResolvedValue({ nodes }) },
      } as never);

      await graphCommand({
        _: ['graph'],
        $0: 'lodestar',
        format: 'mermaid',
        scope: 'src/domain',
      });

      const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain('src/domain/a.ts');
      expect(output).not.toContain('src/infra/c.ts');
    });
  });

  describe('레이어 레벨 그래프', () => {
    it('architecture/layers 규칙이 없으면 에러를 출력하고 exitCode를 1로 설정한다', async () => {
      mockLoadConfigFile.mockResolvedValue({ plugins: [], rules: {} } as never);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'mermaid', layers: true });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('No architecture/layers rule found'),
      );
      expect(process.exitCode).toBe(1);
    });

    it('config가 없으면 에러를 출력한다', async () => {
      mockLoadConfigFile.mockResolvedValue(null);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'mermaid', layers: true });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('No architecture/layers rule found'),
      );
      expect(process.exitCode).toBe(1);
    });

    it('layers 규칙이 string 타입이면 무시한다', async () => {
      mockLoadConfigFile.mockResolvedValue({
        plugins: [],
        rules: { 'architecture/layers': 'error' },
      } as never);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'mermaid', layers: true });

      expect(process.exitCode).toBe(1);
    });

    it('layers가 빈 배열이면 에러를 출력한다', async () => {
      mockLoadConfigFile.mockResolvedValue({
        plugins: [],
        rules: {
          'architecture/layers': { options: { layers: [] } },
        },
      } as never);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'mermaid', layers: true });

      expect(process.exitCode).toBe(1);
    });

    it('mermaid 형식으로 레이어 그래프를 출력한다', async () => {
      const layerDefs = [
        { name: 'domain', path: 'src/domain/**/*.ts' },
        { name: 'app', path: 'src/app/**/*.ts', canImport: ['domain'] },
      ];
      mockLoadConfigFile.mockResolvedValue({
        plugins: [],
        rules: { 'architecture/layers': { options: { layers: layerDefs } } },
      } as never);

      const nodes = makeNodes({
        'src/app/service.ts': ['src/domain/entity.ts'],
        'src/domain/entity.ts': [],
      });
      mockCreateProviders.mockReturnValue({
        graph: { getModuleGraph: vi.fn().mockResolvedValue({ nodes }) },
      } as never);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'mermaid', layers: true });

      const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain('graph TD');
      expect(output).toContain('app');
      expect(output).toContain('domain');
    });

    it('dot 형식으로 레이어 그래프를 출력한다', async () => {
      const layerDefs = [
        { name: 'domain', path: 'src/domain/**/*.ts' },
        { name: 'app', path: 'src/app/**/*.ts', canImport: ['domain'] },
      ];
      mockLoadConfigFile.mockResolvedValue({
        plugins: [],
        rules: { 'architecture/layers': { options: { layers: layerDefs } } },
      } as never);

      const nodes = makeNodes({
        'src/app/service.ts': ['src/domain/entity.ts'],
        'src/domain/entity.ts': [],
      });
      mockCreateProviders.mockReturnValue({
        graph: { getModuleGraph: vi.fn().mockResolvedValue({ nodes }) },
      } as never);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'dot', layers: true });

      const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain('digraph architecture');
    });

    it('layers 규칙에 options가 없으면 에러를 출력한다', async () => {
      mockLoadConfigFile.mockResolvedValue({
        plugins: [],
        rules: { 'architecture/layers': { severity: 'error' } },
      } as never);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'mermaid', layers: true });

      expect(process.exitCode).toBe(1);
    });

    it('배열 형태의 config에서 layers 규칙을 찾는다', async () => {
      const layerDefs = [
        { name: 'domain', path: 'src/domain/**/*.ts' },
        { name: 'app', path: 'src/app/**/*.ts', canImport: ['domain'] },
      ];
      mockLoadConfigFile.mockResolvedValue([
        { plugins: [], rules: {} },
        { plugins: [], rules: { 'architecture/layers': { options: { layers: layerDefs } } } },
      ] as never);

      const nodes = makeNodes({
        'src/app/service.ts': ['src/domain/entity.ts'],
        'src/domain/entity.ts': [],
      });
      mockCreateProviders.mockReturnValue({
        graph: { getModuleGraph: vi.fn().mockResolvedValue({ nodes }) },
      } as never);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'mermaid', layers: true });

      const output = (process.stdout.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain('graph TD');
    });
  });

  describe('--serve 모드', () => {
    it('HTTP 서버를 생성하고 시작한다', async () => {
      const nodes = makeNodes({
        'src/a.ts': ['src/b.ts'],
        'src/b.ts': [],
      });
      mockCreateProviders.mockReturnValue({
        graph: { getModuleGraph: vi.fn().mockResolvedValue({ nodes }) },
      } as never);
      mockLoadConfigFile.mockResolvedValue(null);

      /** Mock server that invokes the listen callback immediately */
      const mockServer = {
        listen: vi.fn((_port: number, callback: () => void) => {
          callback();
        }),
      };
      mockCreateServer.mockReturnValue(mockServer as never);

      await graphCommand({
        _: ['graph'],
        $0: 'lodestar',
        format: 'mermaid',
        serve: true,
        port: 5050,
      });

      expect(mockCreateServer).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalledWith(5050, expect.any(Function));
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('http://localhost:5050'));
    });

    it('포트가 지정되지 않으면 기본 포트 4040을 사용한다', async () => {
      const nodes = makeNodes({ 'src/a.ts': [] });
      mockCreateProviders.mockReturnValue({
        graph: { getModuleGraph: vi.fn().mockResolvedValue({ nodes }) },
      } as never);
      mockLoadConfigFile.mockResolvedValue(null);

      const mockServer = {
        listen: vi.fn((_port: number, callback: () => void) => {
          callback();
        }),
      };
      mockCreateServer.mockReturnValue(mockServer as never);

      await graphCommand({
        _: ['graph'],
        $0: 'lodestar',
        format: 'mermaid',
        serve: true,
      });

      expect(mockServer.listen).toHaveBeenCalledWith(4040, expect.any(Function));
    });

    it('/api/graph 엔드포인트가 JSON을 반환한다', async () => {
      const nodes = makeNodes({
        'src/a.ts': ['src/b.ts'],
        'src/b.ts': [],
      });
      mockCreateProviders.mockReturnValue({
        graph: { getModuleGraph: vi.fn().mockResolvedValue({ nodes }) },
      } as never);
      mockLoadConfigFile.mockResolvedValue(null);

      /** Variable to capture the request handler */
      type RequestHandler = (
        req: { url: string },
        res: { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> },
      ) => void;
      const capturedHandlers: RequestHandler[] = [];

      mockCreateServer.mockImplementation(((handler: RequestHandler) => {
        capturedHandlers.push(handler);
        return {
          listen: vi.fn((_port: number, callback: () => void) => {
            callback();
          }),
        };
      }) as never);

      await graphCommand({
        _: ['graph'],
        $0: 'lodestar',
        format: 'mermaid',
        serve: true,
      });

      const handler = capturedHandlers[0];
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      handler({ url: '/api/graph' }, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      const jsonOutput = JSON.parse(mockRes.end.mock.calls[0][0] as string);
      expect(jsonOutput).toHaveProperty('nodes');
      expect(jsonOutput).toHaveProperty('edges');
      expect(jsonOutput).toHaveProperty('layers');
    });

    it('기타 URL은 HTML 뷰어를 반환한다', async () => {
      const nodes = makeNodes({ 'src/a.ts': [] });
      mockCreateProviders.mockReturnValue({
        graph: { getModuleGraph: vi.fn().mockResolvedValue({ nodes }) },
      } as never);
      mockLoadConfigFile.mockResolvedValue(null);

      type RequestHandler = (
        req: { url: string },
        res: { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> },
      ) => void;
      const capturedHandlers: RequestHandler[] = [];

      mockCreateServer.mockImplementation(((handler: RequestHandler) => {
        capturedHandlers.push(handler);
        return {
          listen: vi.fn((_port: number, callback: () => void) => {
            callback();
          }),
        };
      }) as never);

      await graphCommand({
        _: ['graph'],
        $0: 'lodestar',
        format: 'mermaid',
        serve: true,
      });

      const handler = capturedHandlers[0];
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      handler({ url: '/' }, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
      const htmlOutput = mockRes.end.mock.calls[0][0] as string;
      expect(htmlOutput).toContain('<!DOCTYPE html>');
      expect(htmlOutput).toContain('Lodestar');
    });

    it('config에 layers가 있으면 레이어 정보를 API 응답에 포함한다', async () => {
      const layerDefs = [
        { name: 'domain', path: 'src/domain/**/*.ts' },
        { name: 'app', path: 'src/app/**/*.ts', canImport: ['domain'] },
      ];
      mockLoadConfigFile.mockResolvedValue({
        plugins: [],
        rules: { 'architecture/layers': { options: { layers: layerDefs } } },
      } as never);

      const nodes = makeNodes({
        'src/app/service.ts': ['src/domain/entity.ts'],
        'src/domain/entity.ts': [],
      });
      mockCreateProviders.mockReturnValue({
        graph: { getModuleGraph: vi.fn().mockResolvedValue({ nodes }) },
      } as never);

      type RequestHandler = (
        req: { url: string },
        res: { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> },
      ) => void;
      const capturedHandlers: RequestHandler[] = [];

      mockCreateServer.mockImplementation(((handler: RequestHandler) => {
        capturedHandlers.push(handler);
        return {
          listen: vi.fn((_port: number, callback: () => void) => {
            callback();
          }),
        };
      }) as never);

      await graphCommand({
        _: ['graph'],
        $0: 'lodestar',
        format: 'mermaid',
        serve: true,
      });

      const handler = capturedHandlers[0];
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      handler({ url: '/api/graph' }, mockRes);

      const jsonOutput = JSON.parse(mockRes.end.mock.calls[0][0] as string);
      expect(jsonOutput.layers).toHaveLength(2);
      expect(jsonOutput.layers[0].name).toBe('domain');
    });
  });
});
