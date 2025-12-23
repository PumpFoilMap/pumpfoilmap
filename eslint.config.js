// ESLint Flat Config
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
  'dist-cjs/**',
  'backend/dist/**',
  'backend/dist-cjs/**',
  'backend/.serverless/**',
  'backend/.esbuild/**',
      'coverage/**',
      'test-results/**',
      '**/*.config.*',
      '**/jest*.cjs'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node }
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      // Enforce using `import type` for type-only imports to improve tree-shaking and readability
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' }
      ],
      '@typescript-eslint/no-require-imports': 'off',
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/ban-ts-comment': 'off',
      'no-useless-escape': 'off',
      'no-empty': 'off'
    }
  },
  {
    files: ['backend/**/*.{ts,tsx,js,cjs}'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: { '@typescript-eslint/no-require-imports': 'off' }
  },
  {
    files: ['**/*.test.*', 'tests/**/*.*'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
    rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/ban-ts-comment': 'off' }
  }
];
