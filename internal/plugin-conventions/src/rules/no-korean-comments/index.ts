import { defineRule } from '@retemper/lodestar-types';

/** Korean character ranges (U+AC00-U+D7AF, U+3130-U+318F, U+3200-U+321E) */
const KOREAN_PATTERN = /[\uAC00-\uD7AF\u3130-\u318F\u3200-\u321E]/;

/** Check whether the given comment text contains Korean characters */
function containsKorean(text: string): boolean {
  return KOREAN_PATTERN.test(text);
}

/** Parsed comment token from source code */
interface CommentToken {
  readonly start: number;
  readonly text: string;
}

/**
 * Skip past a template literal body starting after the opening backtick.
 * @param source - full source code
 * @param start - index right after the opening backtick
 * @param len - source length
 * @returns index right after the closing backtick
 */
function skipTemplateLiteral(source: string, start: number, len: number): number {
  for (let i = start; i < len; ) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === '`') return i + 1;
    if (source[i] === '$' && source[i + 1] === '{') {
      i = skipTemplateExpression(source, i + 2, len);
      continue;
    }
    i++;
  }
  return len;
}

/**
 * Skip past a template expression (inside ${...}) tracking brace depth.
 * @param source - full source code
 * @param start - index right after the opening ${
 * @param len - source length
 * @returns index right after the closing }
 */
function skipTemplateExpression(source: string, start: number, len: number): number {
  for (let i = start, depth = 1; i < len; ) {
    const c = source[i];
    if (c === '{') {
      depth++;
      i++;
      continue;
    }
    if (c === '}') {
      depth--;
      if (depth === 0) return i + 1;
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      i++;
      while (i < len && source[i] !== c) {
        if (source[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (c === '`') {
      i = skipTemplateLiteral(source, i + 1, len);
      continue;
    }
    i++;
  }
  return len;
}

/**
 * Extract all comment tokens from source using a state machine.
 * Correctly handles strings, template literals (including expressions), and regex literals.
 */
function extractComments(source: string): readonly CommentToken[] {
  const comments: CommentToken[] = [];
  const len = source.length;
  for (let i = 0; i < len; ) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === '/' && next === '/') {
      const start = i;
      i += 2;
      while (i < len && source[i] !== '\n') i++;
      comments.push({ start, text: source.slice(start, i) });
      continue;
    }

    if (ch === '/' && next === '*') {
      const start = i;
      i += 2;
      while (i < len - 1 && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      comments.push({ start, text: source.slice(start, i) });
      continue;
    }

    if (ch === "'" || ch === '"') {
      i++;
      while (i < len && source[i] !== ch) {
        if (source[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }

    if (ch === '`') {
      i = skipTemplateLiteral(source, i + 1, len);
      continue;
    }

    i++;
  }

  return comments;
}

/**
 * Extract all comments from source code and return those containing Korean characters.
 * @param source - file content as string
 */
function findKoreanComments(
  source: string,
): readonly { readonly line: number; readonly text: string }[] {
  const comments = extractComments(source);
  const results: { readonly line: number; readonly text: string }[] = [];

  for (const comment of comments) {
    if (!containsKorean(comment.text)) continue;
    const lineNumber = source.slice(0, comment.start).split('\n').length;
    results.push({ line: lineNumber, text: comment.text.trim() });
  }

  return results;
}

/** Disallow Korean characters in source code comments */
const noKoreanComments = defineRule<{
  readonly include?: readonly string[];
}>({
  name: 'conventions/no-korean-comments',
  description: 'Disallow Korean characters in source code comments',
  needs: ['fs'],
  schema: {
    type: 'object',
    properties: {
      include: {
        type: 'array',
        items: { type: 'string' },
        description: 'Glob patterns for files to check (default: **/*.ts)',
      },
    },
  },
  async check(ctx) {
    const patterns = ctx.options.include ?? ['**/*.ts', '**/*.tsx'];
    const allFiles: string[] = [];

    for (const pattern of patterns) {
      const files = await ctx.providers.fs.glob(pattern);
      allFiles.push(...files);
    }

    const uniqueFiles = [...new Set(allFiles)];
    let violationCount = 0;

    for (const file of uniqueFiles) {
      const source = await ctx.providers.fs.readFile(file);
      const koreanComments = findKoreanComments(source);

      for (const comment of koreanComments) {
        ctx.report({
          message: `Korean comment found: ${comment.text}`,
          location: { file, line: comment.line },
        });
        violationCount++;
      }
    }

    ctx.meta(`${uniqueFiles.length} files, ${violationCount} Korean comments`);
  },
});

export { noKoreanComments, findKoreanComments, containsKorean };
