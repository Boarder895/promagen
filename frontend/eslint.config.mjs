import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import react from 'eslint-plugin-react';
import unused from 'eslint-plugin-unused-imports';

export default [
  // base
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@typescript-eslint': tseslint.plugin, import: importPlugin, react, 'unused-imports': unused },
  },

  // strict core
  {
    files: ['src/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}'],
    rules: {
      'import/no-default-export': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'unused-imports/no-unused-imports': 'error',
    },
  },

  // relaxed app
  {
    files: ['app/**/*.{ts,tsx}'],
    rules: {
      'import/no-default-export': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'unused-imports/no-unused-imports': 'off',
    },
  },
];



