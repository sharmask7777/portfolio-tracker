import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'
import checkFile from 'eslint-plugin-check-file'
import { defineConfig, globalIgnores } from 'eslint/config'

const boundaryPolicies = [
  {
    from: { element: { type: 'utils' } },
    disallow: { to: { element: { types: { anyOf: ['components', 'contexts'] } } } },
    message: 'Utils must not import components or contexts',
  },
  {
    from: { element: { type: 'types' } },
    disallow: { to: { element: { types: { anyOf: ['components', 'utils', 'contexts'] } } } },
    message: 'Types must not import components, utils, or contexts',
  },
  {
    from: { element: { type: 'contexts' } },
    disallow: { to: { element: { type: 'components' } } },
    message: 'Contexts must not import components',
  },
  {
    from: {
      element: {
        type: 'components',
        captured: { subdomain: ['Analytics', 'Tax', 'Dashboard', 'Family', 'Auth', 'Insights'] },
      },
    },
    disallow: {
      to: {
        element: {
          type: 'components',
          captured: { subdomain: '!{{from.subdomain}}' },
        },
      },
    },
    message: 'Cross-subdomain imports between components (${from.subdomain} -> ${to.subdomain}) are prohibited',
  },
]

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'tests/**']),
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      boundaries,
      'check-file': checkFile,
    },
    languageOptions: {
      globals: globals.browser,
      parser: tseslint.parser,
    },
    settings: {
      'boundaries/legacy-warnings': false,
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
      'boundaries/elements': [
        { type: 'components', pattern: 'src/components/(*)', capture: ['subdomain'] },
        { type: 'components', pattern: 'src/components' },
        { type: 'utils', pattern: 'src/utils' },
        { type: 'types', pattern: 'src/types' },
        { type: 'contexts', pattern: 'src/contexts' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: boundaryPolicies,
          policies: boundaryPolicies,
        },
      ],
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: boundaryPolicies,
        },
      ],
      'check-file/filename-naming-convention': [
        'error',
        {
          'src/components/**/!(index|*.test).tsx': 'PASCAL_CASE',
          'src/utils/**/!(*.test).ts': 'KEBAB_CASE',
        },
        {
          ignoreMiddleExtensions: true,
        },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
])
