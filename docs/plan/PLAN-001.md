# PLAN-001: Fork FaynoSync 并重构为 Monorepo

- **状态**: proposing
- **关联任务**: BEN-46
- **创建时间**: 2026-03-23

## 背景调查

### 上游仓库概况
- 仓库：`ku9nov/faynoSync`，Apache-2.0 许可
- 语言：Go 1.25.5，框架 Gin，数据库 MongoDB + Redis
- 代码量：~1.2MB，结构清晰
- 最新版本：v1.5.6（2026-03-16）
- 维护者：仅 1 人（Bus Factor = 1）

### 现有项目结构
```
ttpos-artifacts/         ← 当前仓库
├── src/                 # Dashboard React SPA
├── faynosync/           # Docker Compose 部署配置
├── .github/workflows/   # CI/CD（构建 Flutter 应用 + Dashboard Docker 镜像）
└── docs/                # 签名文档
```

### 版本唯一性 Bug
- `mongod/create.go` 的 `Upload()` 中 `FindOne` 查询缺少 `channel_id`
- MongoDB `apps` 集合缺少 `{app_id, version, channel_id, owner}` 唯一复合索引
- 后果：跨 Channel 制品污染 + 并发竞态导致重复文档

### 集成点分析
- Docker 镜像引用：1 处（docker-compose.yml）
- GitHub 链接：~6 处文档
- Dashboard API：**零改动**（通过运行时 `VITE_API_URL` 连接，端点路径保持兼容）
- CI 工作流：通过 Secrets（`FAYNOSYNC_URL`/`FAYNOSYNC_TOKEN`）连接，代码无需改动
- 品牌引用：~10 处（可选更新）

## 方案

### 目标 Monorepo 结构

```
ttpos-artifacts/                    ← 仓库名不变
├── dashboard/                      # React SPA（现有 src/ 整体移入）
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── Dockerfile                  # Dashboard 多阶段构建
│   ├── docker-entrypoint.sh
│   └── nginx.conf
├── server/                         # FaynoSync Go 后端（fork 引入）
│   ├── faynoSync.go                # 入口
│   ├── faynoSync_test.go
│   ├── go.mod / go.sum
│   ├── Dockerfile                  # 后端多阶段构建
│   ├── server/                     # HTTP 层
│   ├── mongod/                     # 数据层
│   ├── redisdb/                    # 缓存层
│   └── ...
├── deploy/                         # 部署配置（现有 faynosync/ 重命名）
│   ├── docker-compose.yml
│   ├── .env.example
│   └── README.md
├── .github/workflows/              # CI/CD（保持原位）
│   ├── build-dashboard.yaml        # 更新构建上下文路径
│   ├── build-server.yaml           # 新增：后端 Docker 镜像构建
│   └── ...                         # Flutter 构建工作流不变
├── docs/                           # 文档
│   ├── task/
│   ├── plan/
│   └── ...
├── CLAUDE.md                       # 更新项目结构说明
└── README.md                       # 更新项目说明
```

### 实施步骤

#### 步骤 1：Fork 后端代码

1. `gh repo fork ku9nov/faynoSync --clone=false --remote=false` 到 GitHub 组织下
2. 在本地将 fork 后的代码克隆到临时目录
3. 清理 `.git` 后将代码复制到 `server/` 目录
4. **不保留 upstream remote**（彻底断连）

#### 步骤 2：重组目录结构

1. 将 Dashboard 相关文件移入 `dashboard/`：
   - `src/` → `dashboard/src/`
   - `public/` → `dashboard/public/`
   - `index.html` → `dashboard/index.html`
   - `package.json`, `yarn.lock`, `vite.config.ts`, `tsconfig*.json`, `tailwind.config.js`, `postcss.config.js`, `.eslintrc.cjs`, `.prettierrc`, `commitlint.config.js` → `dashboard/`
   - `Dockerfile`, `docker-entrypoint.sh`, `nginx.conf` → `dashboard/`
   - `.env.example` → `dashboard/.env.example`
2. 将 `faynosync/` 重命名为 `deploy/`
3. 在 `server/` 中放置 fork 的后端代码
4. 更新根目录 `.gitignore`（合并 Dashboard + Server 的忽略规则）

#### 步骤 3：修复版本唯一性 Bug

在 `server/` 中：
1. 修改 `mongod/create.go` 的 `Upload()` 函数：`FindOne` 查询加入 `channel_id`
2. 新增 MongoDB 迁移文件，添加唯一复合索引：
   ```json
   {
     "key": { "app_id": 1, "version": 1, "channel_id": 1, "owner": 1 },
     "name": "unique_app_version_channel_owner",
     "unique": true
   }
   ```

#### 步骤 4：更新 Dashboard 构建

1. 更新 `dashboard/vite.config.ts` 中的路径别名（`@/` → `src/`，相对路径调整）
2. 更新 `dashboard/tsconfig.json` 中的路径映射
3. 验证 `yarn dev` 和 `yarn build` 正常工作

#### 步骤 5：更新 Docker 部署

1. `deploy/docker-compose.yml`：
   - 后端镜像从 `ku9nov/faynosync:v1.5.4` 改为本地构建或自有 registry 镜像
   - Dashboard 镜像路径更新
2. 新增 `server/Dockerfile`（保持原有多阶段构建，可优化运行时镜像为纯 alpine）
3. `dashboard/Dockerfile` 更新构建上下文

#### 步骤 6：更新 CI/CD

1. `.github/workflows/build-dashboard.yaml`：更新构建上下文为 `dashboard/`
2. 新增 `.github/workflows/build-server.yaml`：后端 Docker 镜像构建推送
3. Flutter 构建工作流无需改动（通过 Secrets 连接 FaynoSync API）

#### 步骤 7：更新文档和引用

1. 更新 `CLAUDE.md` 项目结构说明
2. 更新 `README.md`
3. 更新 `deploy/README.md`
4. 替换 `ku9nov/faynoSync` GitHub 链接为 fork 地址

## 风险

| 风险 | 级别 | 缓解措施 |
|------|------|----------|
| 仓库体积增大（Go 依赖 + 源码） | 低 | Go 源码仅 ~1.2MB，go.sum 不提交二进制 |
| Dashboard 路径迁移破坏构建 | 中 | 步骤 4 单独验证，确保所有路径别名正确 |
| 版本唯一性修复可能影响现有数据 | 中 | 迁移前需检查现有数据是否存在重复；如有，先清理后建索引 |
| Go 工具链版本兼容性（1.25.5） | 低 | 本地验证编译；CI 中固定版本 |
| git history 断裂（server/ 无历史） | 低 | 可接受，fork 后以本仓库为主 |

## 范围

### 包含
- Fork 后端代码并集成到 monorepo
- 重组目录结构
- 修复版本唯一性 bug
- 更新构建、部署、CI/CD 配置
- 更新文档引用

### 不包含
- 品牌重命名（FaynoSync → 新名称）— 可作为后续任务
- 后端功能增改 — 本次只 fork + bug fix
- Flutter 构建工作流改动
- 后端 Dockerfile 优化（如改用 alpine/scratch）— 可作为后续任务

## 备选方案

**方案 B：Git Subtree 合并**
- 用 `git subtree add` 将 fork 引入为 `server/` 子树，保留完整 git 历史
- 优点：保留后端提交历史
- 缺点：subtree 操作复杂，后续不再 sync 时多余
- **不推荐**：既然断连上游，历史意义不大

**方案 C：Git Submodule**
- 将 fork 作为 submodule
- 优点：独立仓库，可单独管理
- 缺点：submodule 工作流复杂，CI 需额外 checkout
- **不推荐**：monorepo 的统一管理更适合

**结论：方案 A（直接复制代码）最简单直接，符合"断连上游"的决策。**
