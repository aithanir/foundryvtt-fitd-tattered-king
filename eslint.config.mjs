import js from '@eslint/js';

const foundryGlobals = {
  Actor: 'readonly',
  Ajv: 'readonly',
  BladesActor: 'readonly',
  BladesHelpers: 'readonly',
  CONFIG: 'readonly',
  Dialog: 'readonly',
  FormApplication: 'readonly',
  Hooks: 'readonly',
  HTMLElement: 'readonly',
  Item: 'readonly',
  fetch: 'readonly',
  foundry: 'readonly',
  fromUuid: 'readonly',
  game: 'readonly',
  libWrapper: 'readonly',
  ui: 'readonly',
};

export default [
  {
    ignores: [
      'modules/fitd-ttk-investigators/build/**',
      'foundry-data/**',
      'node_modules/**',
      'upstream/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['modules/**/*.js', 'modules/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...foundryGlobals,
        console: 'readonly',
        document: 'readonly',
        process: 'readonly',
        window: 'readonly',
      },
    },
    rules: {
      'no-console': 'warn',
      'no-undef': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
