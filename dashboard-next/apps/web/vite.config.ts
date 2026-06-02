import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { API_PROXY_PREFIXES } from '@ttpos/shared'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/** 版本号单一事实来源：apps/web/package.json，优先用 CI 注入的 APP_VERSION。 */
function resolveAppVersion(): string {
  if (process.env.APP_VERSION) {
    return process.env.APP_VERSION
  }
  try {
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'),
    ) as { version?: string }
    return pkg.version ?? 'unknown'
  }
  catch {
    return 'unknown'
  }
}

/**
 * git short hash。容器构建里 .git 不在上下文且镜像无 git，
 * 因此优先取 CI 经 build-arg 注入的 GIT_COMMIT，本地构建回退到本机 git。
 */
function resolveGitCommit(): string {
  if (process.env.GIT_COMMIT) {
    return process.env.GIT_COMMIT
  }
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  }
  catch {
    return 'unknown'
  }
}

/** 构建时刻，CI 可经 BUILD_TIME 覆盖，否则取当下。 */
function resolveBuildTime(): string {
  return process.env.BUILD_TIME || new Date().toISOString()
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devProxyTarget = env.VITE_DEV_PROXY_TARGET?.trim()

  const proxy
    = mode === 'development' && devProxyTarget
      ? Object.fromEntries(
          API_PROXY_PREFIXES.map(prefix => [
            prefix,
            {
              target: devProxyTarget,
              changeOrigin: true,
              bypass(req: { headers: { accept?: string } }) {
                if (req.headers.accept?.includes('text/html')) {
                  return '/index.html'
                }
              },
            },
          ]),
        )
      : undefined

  return {
    define: {
      __APP_VERSION__: JSON.stringify(resolveAppVersion()),
      __GIT_COMMIT__: JSON.stringify(resolveGitCommit()),
      __BUILD_TIME__: JSON.stringify(resolveBuildTime()),
    },
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        routesDirectory: 'src/app/routes',
        generatedRouteTree: 'src/app/routeTree.gen.ts',
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      tsconfigPaths: true,
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: Number(env.VITE_PORT) || 3000,
      allowedHosts: true,
      proxy,
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./src/test/setup.ts'],
    },
  }
})
