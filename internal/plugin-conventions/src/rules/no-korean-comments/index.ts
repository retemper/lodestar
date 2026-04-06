import { defineRule } from '@lodestar/types';

/** 한글 문자 범위 (가-힣, ㄱ-ㅎ, ㅏ-ㅣ) */
const KOREAN_PATTERN = /[\uAC00-\uD7AF\u3130-\u318F\u3200-\u321E]/;

/** 한 줄 주석 패턴 */
const SINGLE_LINE_COMMENT = /\/\/(.+)/g;

/** 블록 주석 패턴 (여러 줄 포함) */
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;

/** 주석 텍스트에서 한국어를 포함하는지 검사한다 */
function containsKorean(text: string): boolean {
  return KOREAN_PATTERN.test(text);
}

/**
 * Extract all comments from source code and return those containing Korean characters.
 * @param source - file content as string
 */
function findKoreanComments(
  source: string,
): readonly { readonly line: number; readonly text: string }[] {
  const results: { readonly line: number; readonly text: string }[] = [];
  const lines = source.split('\n');

  for (const match of source.matchAll(BLOCK_COMMENT)) {
    const commentText = match[0];
    if (!containsKorean(commentText)) continue;

    const offset = match.index;
    const lineNumber = source.slice(0, offset).split('\n').length;
    results.push({ line: lineNumber, text: commentText.trim() });
  }

  for (const [lineIndex, line] of lines.entries()) {
    const singleMatch = line.match(/\/\/(.+)/);
    if (!singleMatch) continue;
    if (!containsKorean(singleMatch[1])) continue;

    const alreadyCovered = results.some(
      (r) => r.line <= lineIndex + 1 && r.text.includes(singleMatch[1].trim()),
    );
    if (alreadyCovered) continue;

    results.push({ line: lineIndex + 1, text: singleMatch[0].trim() });
  }

  return results;
}

/** 소스 코드 주석에 한국어 사용을 금지한다 */
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
