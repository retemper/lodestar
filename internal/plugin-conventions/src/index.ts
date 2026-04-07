import { definePlugin } from '@retemper/types';
import { noKoreanComments } from './rules/no-korean-comments/index';

/** Internal code conventions plugin — code style rules applied across the monorepo */
const pluginConventions = definePlugin(() => ({
  name: '@repo/plugin-conventions',
  rules: [noKoreanComments],
}));

export { pluginConventions, noKoreanComments };
