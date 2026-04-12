import { writeFile } from 'node:fs/promises';
import type {
  WorkspaceReporter,
  WorkspacePackageInfo,
  Violation,
  RunSummary,
  RuleResultSummary,
} from '@retemper/lodestar-types';

/** Options for the SARIF reporter */
interface SarifReporterOptions {
  /** Output file path — writes to stdout if omitted */
  readonly output?: string;
}

/** SARIF severity level */
type SarifLevel = 'error' | 'warning' | 'note' | 'none';

/** Map Lodestar severity to SARIF level */
function toSarifLevel(severity: string): SarifLevel {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warn':
      return 'warning';
    default:
      return 'note';
  }
}

/** Create a SARIF reporter that outputs SARIF 2.1.0 JSON */
function createSarifReporter(options?: SarifReporterOptions): WorkspaceReporter {
  const violations: Violation[] = [];
  const ruleMetadata = new Map<string, { description?: string; docsUrl?: string }>();

  return {
    name: 'sarif',

    onStart() {},

    onRuleComplete(result: RuleResultSummary) {
      ruleMetadata.set(result.ruleId, {
        docsUrl: result.docsUrl,
      });
    },

    onViolation(violation: Violation) {
      violations.push(violation);
    },

    async onComplete(_summary: RunSummary) {
      const sarifOutput = buildSarifLog(violations, ruleMetadata);
      const json = JSON.stringify(sarifOutput, null, 2);

      if (options?.output) {
        await writeFile(options.output, json, 'utf-8');
      } else {
        process.stdout.write(json);
      }
    },

    onPackageStart(_pkg: WorkspacePackageInfo) {},
    onPackageComplete(_pkg: WorkspacePackageInfo, _summary: RunSummary) {},
  };
}

/** Build a complete SARIF 2.1.0 log object */
function buildSarifLog(
  violations: readonly Violation[],
  ruleMetadata: ReadonlyMap<string, { description?: string; docsUrl?: string }>,
): SarifLog {
  const ruleIds = [...new Set(violations.map((v) => v.ruleId))];
  const ruleIndex = new Map(ruleIds.map((id, i) => [id, i]));

  const rules: SarifReportingDescriptor[] = ruleIds.map((id) => {
    const meta = ruleMetadata.get(id);
    const descriptor: SarifReportingDescriptor = { id };
    if (meta?.docsUrl) {
      return { ...descriptor, helpUri: meta.docsUrl };
    }
    return descriptor;
  });

  const results: SarifResult[] = violations.map((v) => {
    const result: SarifResult = {
      ruleId: v.ruleId,
      ruleIndex: ruleIndex.get(v.ruleId) ?? 0,
      level: toSarifLevel(v.severity),
      message: { text: v.message },
    };

    if (v.location) {
      const physicalLocation: SarifPhysicalLocation = {
        artifactLocation: { uri: v.location.file },
      };

      if (v.location.line !== undefined) {
        physicalLocation.region = {
          startLine: v.location.line,
          ...(v.location.column !== undefined ? { startColumn: v.location.column } : {}),
        };
      }

      return { ...result, locations: [{ physicalLocation }] };
    }

    return result;
  });

  return {
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'lodestar',
            informationUri: 'https://github.com/retemper/lodestar',
            rules,
          },
        },
        results,
      },
    ],
  };
}

/** SARIF 2.1.0 log (minimal subset) */
interface SarifLog {
  readonly $schema: string;
  readonly version: '2.1.0';
  readonly runs: readonly SarifRun[];
}

/** SARIF run */
interface SarifRun {
  readonly tool: {
    readonly driver: {
      readonly name: string;
      readonly informationUri: string;
      readonly rules: readonly SarifReportingDescriptor[];
    };
  };
  readonly results: readonly SarifResult[];
}

/** SARIF reporting descriptor (rule metadata) */
interface SarifReportingDescriptor {
  readonly id: string;
  readonly helpUri?: string;
}

/** SARIF result (violation) */
interface SarifResult {
  readonly ruleId: string;
  readonly ruleIndex: number;
  readonly level: SarifLevel;
  readonly message: { readonly text: string };
  readonly locations?: readonly SarifLocation[];
}

/** SARIF location */
interface SarifLocation {
  readonly physicalLocation: SarifPhysicalLocation;
}

/** SARIF physical location */
interface SarifPhysicalLocation {
  readonly artifactLocation: { readonly uri: string };
  region?: {
    readonly startLine: number;
    readonly startColumn?: number;
  };
}

/** Create a SARIF ReporterFactory for use in lodestar config */
function sarifReporter(options?: SarifReporterOptions) {
  return {
    name: 'sarif',
    create: () => createSarifReporter(options),
  };
}

export { createSarifReporter, sarifReporter, buildSarifLog };
export type { SarifReporterOptions, SarifLog, SarifResult, SarifLevel };
