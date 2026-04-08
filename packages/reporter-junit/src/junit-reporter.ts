import { writeFile } from 'node:fs/promises';
import type {
  WorkspaceReporter,
  WorkspacePackageInfo,
  Violation,
  RunSummary,
  RuleResultSummary,
} from '@retemper/lodestar-types';

/** Options for the JUnit reporter */
interface JunitReporterOptions {
  /** Output file path — writes to stdout if omitted */
  readonly output?: string;
}

/** Collected result per rule */
interface RuleEntry {
  readonly ruleId: string;
  readonly violations: Violation[];
  readonly durationMs: number;
  readonly error?: Error;
}

/** Create a JUnit XML reporter that outputs test-suite style results */
function createJunitReporter(options?: JunitReporterOptions): WorkspaceReporter {
  const ruleEntries: RuleEntry[] = [];

  return {
    name: 'junit',

    onStart() {},

    onRuleComplete(result: RuleResultSummary) {
      ruleEntries.push({
        ruleId: result.ruleId,
        violations: [...result.violations],
        durationMs: result.durationMs,
        error: result.error,
      });
    },

    onViolation() {},

    async onComplete(summary: RunSummary) {
      const xml = buildJunitXml(ruleEntries, summary);

      if (options?.output) {
        await writeFile(options.output, xml, 'utf-8');
      } else {
        process.stdout.write(xml);
      }
    },

    onPackageStart(_pkg: WorkspacePackageInfo) {},
    onPackageComplete(_pkg: WorkspacePackageInfo, _summary: RunSummary) {},
  };
}

/** Build JUnit XML string from rule entries */
function buildJunitXml(entries: readonly RuleEntry[], summary: RunSummary): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');

  const totalTests = entries.length;
  const totalFailures = entries.filter((e) =>
    e.violations.some((v) => v.severity === 'error'),
  ).length;
  const totalErrors = entries.filter((e) => e.error).length;
  const totalTime = (summary.durationMs / 1000).toFixed(3);

  lines.push(
    `<testsuites tests="${totalTests}" failures="${totalFailures}" errors="${totalErrors}" time="${totalTime}">`,
  );

  for (const entry of entries) {
    const errors = entry.violations.filter((v) => v.severity === 'error');
    const warnings = entry.violations.filter((v) => v.severity === 'warn');
    const time = (entry.durationMs / 1000).toFixed(3);

    lines.push(
      `  <testsuite name="${escapeXml(entry.ruleId)}" tests="1" failures="${errors.length > 0 ? 1 : 0}" errors="${entry.error ? 1 : 0}" time="${time}">`,
    );

    if (entry.error) {
      lines.push(`    <testcase name="${escapeXml(entry.ruleId)}" time="${time}">`);
      lines.push(
        `      <error message="${escapeXml(entry.error.message)}">${escapeXml(entry.error.message)}</error>`,
      );
      lines.push('    </testcase>');
    } else if (errors.length > 0) {
      lines.push(`    <testcase name="${escapeXml(entry.ruleId)}" time="${time}">`);
      const failureText = errors.map((v) => formatViolation(v)).join('\n');
      lines.push(
        `      <failure message="${escapeXml(`${errors.length} violation(s)`)}">${escapeXml(failureText)}</failure>`,
      );
      lines.push('    </testcase>');
    } else if (warnings.length > 0) {
      lines.push(`    <testcase name="${escapeXml(entry.ruleId)}" time="${time}">`);
      const warnText = warnings.map((v) => formatViolation(v)).join('\n');
      lines.push(`      <system-out>${escapeXml(warnText)}</system-out>`);
      lines.push('    </testcase>');
    } else {
      lines.push(`    <testcase name="${escapeXml(entry.ruleId)}" time="${time}"/>`);
    }

    lines.push('  </testsuite>');
  }

  lines.push('</testsuites>');
  return lines.join('\n');
}

/** Format a violation as a human-readable string */
function formatViolation(v: Violation): string {
  const location = v.location
    ? ` at ${v.location.file}${v.location.line ? `:${v.location.line}` : ''}`
    : '';
  return `${v.message}${location}`;
}

/** Escape special XML characters */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Create a JUnit ReporterFactory for use in lodestar config */
function junitReporter(options?: JunitReporterOptions) {
  return {
    name: 'junit',
    create: () => createJunitReporter(options),
  };
}

export { createJunitReporter, junitReporter, buildJunitXml, escapeXml };
export type { JunitReporterOptions };
