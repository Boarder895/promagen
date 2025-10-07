export default [
  {
    rules: {
      'import/no-cycle': 'warn',
      'import/order': ['warn', { 'newlines-between': 'always', alphabetize: { order: 'asc', caseInsensitive: true } }],
    },
  },
]
