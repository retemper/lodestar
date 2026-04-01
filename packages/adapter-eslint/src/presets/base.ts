/** Base ESLint flat config preset */
function createBaseConfig() {
  return [
    {
      rules: {
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        'no-debugger': 'error',
        'prefer-const': 'error',
      },
    },
  ];
}

export { createBaseConfig };
