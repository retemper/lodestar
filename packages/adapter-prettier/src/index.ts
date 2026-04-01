/** Default Prettier configuration */
const prettierConfig = {
  singleQuote: true,
  trailingComma: 'all',
  semi: true,
  tabWidth: 2,
  printWidth: 100,
  arrowParens: 'always',
  endOfLine: 'lf',
} as const;

export default prettierConfig;
export { prettierConfig };
