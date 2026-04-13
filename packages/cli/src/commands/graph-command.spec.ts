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

  describe('file-level graph', () => {
    it('outputs dependency graph in mermaid format', async () => {
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

    it('outputs dependency graph in dot format', async () => {
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

    it('prints message and returns when there are no dependencies', async () => {
      const nodes = makeNodes({ 'src/a.ts': [] });
      mockCreateProviders.mockReturnValue({
        graph: { getModuleGraph: vi.fn().mockResolvedValue({ nodes }) },
      } as never);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'mermaid' });

      expect(console.error).toHaveBeenCalledWith('No dependencies found.');
      expect(process.stdout.write).not.toHaveBeenCalled();
    });

    it('passes scope option', async () => {
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

  describe('layer-level graph', () => {
    it('outputs error and sets exitCode to 1 when architecture/layers rule is missing', async () => {
      mockLoadConfigFile.mockResolvedValue({ plugins: [], rules: {} } as never);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'mermaid', layers: true });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('No architecture/layers rule found'),
      );
      expect(process.exitCode).toBe(1);
    });

    it('outputs error when config is missing', async () => {
      mockLoadConfigFile.mockResolvedValue(null);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'mermaid', layers: true });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('No architecture/layers rule found'),
      );
      expect(process.exitCode).toBe(1);
    });

    it('ignores layers rule when it is a string type', async () => {
      mockLoadConfigFile.mockResolvedValue({
        plugins: [],
        rules: { 'architecture/layers': 'error' },
      } as never);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'mermaid', layers: true });

      expect(process.exitCode).toBe(1);
    });

    it('outputs error when layers is an empty array', async () => {
      mockLoadConfigFile.mockResolvedValue({
        plugins: [],
        rules: {
          'architecture/layers': { options: { layers: [] } },
        },
      } as never);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'mermaid', layers: true });

      expect(process.exitCode).toBe(1);
    });

    it('outputs layer graph in mermaid format', async () => {
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

    it('outputs layer graph in dot format', async () => {
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

    it('outputs error when layers rule has no options', async () => {
      mockLoadConfigFile.mockResolvedValue({
        plugins: [],
        rules: { 'architecture/layers': { severity: 'error' } },
      } as never);

      await graphCommand({ _: ['graph'], $0: 'lodestar', format: 'mermaid', layers: true });

      expect(process.exitCode).toBe(1);
    });

    it('finds layers rule in array-style config', async () => {
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

  describe('--serve mode', () => {
    it('creates and starts an HTTP server', async () => {
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

    it('uses default port 4040 when port is not specified', async () => {
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

    it('/api/graph endpoint returns JSON', async () => {
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

    it('other URLs return HTML viewer', async () => {
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

    it('includes layer info in API response when config has layers', async () => {
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
