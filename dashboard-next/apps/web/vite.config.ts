import path from 'node:path'
import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { API_PROXY_PREFIXES } from '@ttpos/shared'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

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
