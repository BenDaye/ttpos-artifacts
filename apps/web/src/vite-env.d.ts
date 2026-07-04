/// <reference types="vite/client" />

// 构建时由 vite.config.ts 的 define 注入。
// APP_VERSION 取自 apps/web/package.json，GIT_COMMIT 由 CI 经 build-arg 传入
// （.git 不在 Docker 构建上下文内），BUILD_TIME 为构建发生的时刻。
declare const __APP_VERSION__: string
declare const __GIT_COMMIT__: string
declare const __BUILD_TIME__: string
