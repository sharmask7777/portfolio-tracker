import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'
import checkFile from 'eslint-plugin-check-file'
import jsdoc from 'eslint-plugin-jsdoc'
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
      jsdoc,
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
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          rules: boundaryPolicies,
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
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[object.meta.name="import"][object.property.name="meta"][property.name="env"]',
          message: 'Direct access to import.meta.env is forbidden. Centralize environment variable access in src/env.ts using Zod validation.',
        },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // View Layer Zero Business Logic Guardrail: enforces pure paint/rendering layers
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[object.meta.name="import"][object.property.name="meta"][property.name="env"]',
          message: 'Direct access to import.meta.env is forbidden. Centralize environment variable access in src/env.ts using Zod validation.',
        },
        {
          selector: 'BinaryExpression[operator="*"][right.value=0.125], BinaryExpression[operator="*"][left.value=0.125], BinaryExpression[operator="*"][right.value=0.2], BinaryExpression[operator="*"][left.value=0.2], BinaryExpression[operator="*"][right.value=0.04], BinaryExpression[operator="*"][left.value=0.04], BinaryExpression[operator="*"][right.value=0.15], BinaryExpression[operator="*"][left.value=0.15], BinaryExpression[operator="*"][right.value=0.3], BinaryExpression[operator="*"][left.value=0.3]',
          message: 'Forbidden statutory tax rate multiplication in view layer. Tax calculations must occur on the backend.',
        },
        {
          selector: 'CallExpression[callee.object.name="Math"][callee.property.name="pow"] > BinaryExpression[operator="+"][left.value=1]',
          message: 'Forbidden Fisher purchasing power deflator compounding in view layer. Use backend DragDecompositionDto.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*/**/tax-calculations', '*/**/itr-report-generator', '*/**/portfolio-calculations*'],
              message: 'View components must never import calculation engines directly. Consume display DTOs and presentation hooks.',
            },
          ],
        },
      ],
    },
  },
  {
    // Fowler Maintainability Sensors for App.tsx and modular dashboard components
    files: [
      'src/App.tsx',
      'src/ActiveTabRouter.tsx',
      'src/DashboardActionHeader.tsx',
      'src/DashboardModals.tsx',
      'src/components/Dashboard/EmptyStatePlaceholder.tsx',
      'src/components/Dashboard/DashboardNavigationTabs.tsx',
      'src/components/Dashboard/SortHeaderCell.tsx',
      'src/components/Dashboard/TransactionHistoryModal.tsx',
    ],
    rules: {
      'complexity': ['error', 10],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 50, skipBlankLines: true, skipComments: true },
      ],
      'max-params': ['error', 4],
    },
  },
  {
    files: ['src/components/PairMobileModal.tsx'],
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            FunctionExpression: true,
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
          },
          contexts: [
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'ExportNamedDeclaration > VariableDeclaration',
          ],
        },
      ],
      'jsdoc/require-description': 'error',
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/utils/mock-portfolios.test.ts'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'complexity': 'off',
    },
  },
  {
    // src/env.ts is the designated central hub validated with Zod for import.meta.env
    files: ['src/env.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
])
