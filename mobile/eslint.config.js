import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'
import jsdoc from 'eslint-plugin-jsdoc'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'

const boundaryPolicies = [
  {
    from: { element: { type: 'components' } },
    disallow: { to: { element: { type: 'db' } } },
    message: 'Components must not access database directly (use services or feeds)',
  },
  {
    from: { element: { type: 'screens' } },
    disallow: { to: { element: { type: 'db' } } },
    message: 'Screens must not access database directly (use services or feeds)',
  },
  {
    from: { element: { type: 'types' } },
    disallow: {
      to: {
        element: {
          types: { anyOf: ['components', 'screens', 'services', 'db', 'feeds', 'api'] },
        },
      },
    },
    message: 'Types must not import from any other architectural layers',
  },
  {
    from: { element: { type: 'db' } },
    disallow: {
      to: {
        element: {
          types: { anyOf: ['components', 'screens', 'services', 'feeds', 'api'] },
        },
      },
    },
    message: 'Database layer must not import from higher layers',
  },
  {
    from: { element: { type: 'services' } },
    disallow: {
      to: {
        element: {
          types: { anyOf: ['components', 'screens'] },
        },
      },
    },
    message: 'Services must not import components or screens',
  },
  {
    from: { element: { type: 'feeds' } },
    disallow: {
      to: {
        element: {
          types: { anyOf: ['components', 'screens'] },
        },
      },
    },
    message: 'Feeds must not import components or screens',
  },
  {
    from: { element: { type: 'api' } },
    disallow: {
      to: {
        element: {
          types: { anyOf: ['components', 'screens'] },
        },
      },
    },
    message: 'API layer must not import components or screens',
  },
]

export default defineConfig([
  globalIgnores([
    'dist/**',
    '.expo/**',
    'node_modules/**',
    'coverage/**',
    'src/types/generated/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
    ],
    plugins: {
      boundaries,
      jsdoc,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
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
        { type: 'components', pattern: 'src/components' },
        { type: 'screens', pattern: 'app' },
        { type: 'screens', pattern: 'src/screens' },
        { type: 'services', pattern: 'src/services' },
        { type: 'db', pattern: 'src/db' },
        { type: 'feeds', pattern: 'src/feeds' },
        { type: 'api', pattern: 'src/api' },
        { type: 'types', pattern: 'src/types' },
        { type: 'e2e', pattern: 'src/e2e' },
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
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Fowler Maintainability Sensors
      'complexity': ['error', 10],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 50, skipBlankLines: true, skipComments: true },
      ],
      'max-params': ['error', 3],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['src/components/**/*.{ts,tsx}'],
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
    // View Layer Zero Business Logic Guardrail: enforces pure paint/rendering layers across mobile components and screens
    files: ['src/components/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'BinaryExpression[operator="*"][right.value=0.125], BinaryExpression[operator="*"][left.value=0.125], BinaryExpression[operator="*"][right.value=0.2], BinaryExpression[operator="*"][left.value=0.2], BinaryExpression[operator="*"][right.value=0.04], BinaryExpression[operator="*"][left.value=0.04], BinaryExpression[operator="*"][right.value=0.15], BinaryExpression[operator="*"][left.value=0.15], BinaryExpression[operator="*"][right.value=0.3], BinaryExpression[operator="*"][left.value=0.3]',
          message: 'Forbidden statutory tax rate multiplication in view layer. Tax calculations must occur on the backend.',
        },
        {
          selector: 'CallExpression[callee.object.name="Math"][callee.property.name="pow"] > BinaryExpression[operator="+"][left.value=1]',
          message: 'Forbidden Fisher purchasing power deflator compounding in view layer. Use backend DragDecompositionDto.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'complexity': 'off',
    },
  },
])
