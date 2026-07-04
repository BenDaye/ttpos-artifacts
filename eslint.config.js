import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'app',
  typescript: true,
  react: true,
  formatters: true,
  stylistic: {
    indent: 2,
    quotes: 'single',
    semi: false,
  },
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.turbo/**',
    '**/playwright-report/**',
    '**/test-results/**',
    'apps/web/src/app/routeTree.gen.ts',
    // 顶层化后仓库根还包含非前端资产，保持迁移前的 lint 范围（原 dashboard-next 子树）
    'apps/server/**',
    'docs/**',
    'deploy/**',
    '.github/**',
    '.serena/**',
    '*.md',
  ],
}, {
  files: ['**/*.{ts,tsx}'],
  rules: {
    'react-refresh/only-export-components': 'off',
    'react/no-context-provider': 'off',
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
  },
})
