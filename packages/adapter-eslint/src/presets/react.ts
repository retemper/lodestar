/** React ESLint flat config preset */
function createReactConfig() {
  return [
    {
      rules: {
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
      },
    },
  ];
}

export { createReactConfig };
