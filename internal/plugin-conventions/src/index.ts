import { definePlugin } from '@lodestar/types';
import { noKoreanComments } from './rules/no-korean-comments/index';

/** 내부 코드 컨벤션 플러그인 — 모노레포 전체에 적용되는 코드 스타일 규칙 */
const pluginConventions = definePlugin(() => ({
  name: '@repo/plugin-conventions',
  rules: [noKoreanComments],
}));

export { pluginConventions, noKoreanComments };
