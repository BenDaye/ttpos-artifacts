import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/** 与后端路由首段一致；/apps 必须在 /app 之前，避免前缀误匹配 */
const DEV_API_PROXY_PREFIXES = [
  '/apps',
  '/app',
  '/user',
  '/users',
  '/whoami',
  '/channel',
  '/search',
  '/telemetry',
  '/platform',
  '/arch',
  '/admin',
  '/tuf',
  '/upload',
  '/artifact',
  '/token',
  '/login',
  '/signup',
] as const;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devProxyTarget = env.VITE_DEV_PROXY_TARGET?.trim();
  const proxy =
    mode === 'development' && devProxyTarget
      ? Object.fromEntries(
          DEV_API_PROXY_PREFIXES.map((prefix) => [
            prefix,
            {
              target: devProxyTarget,
              changeOrigin: true,
              bypass(req: import('http').IncomingMessage) {
                if (req.headers.accept?.includes('text/html')) {
                  return '/index.html';
                }
              },
            },
          ])
        )
      : undefined;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: Number(env.VITE_PORT) || 3000,
      allowedHosts: true,
      proxy,
    },
  };
});
