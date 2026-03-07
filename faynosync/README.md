# FaynoSync — TTPOS 应用更新服务

基于 [FaynoSync](https://github.com/ku9nov/faynoSync) 的自托管应用更新服务，为 TTPOS 各端应用提供版本管理和更新分发。

## 架构

| 服务 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| api | `ku9nov/faynosync:v1.5.4` | 9000 | 更新 API 服务（Go） |
| dashboard | `ku9nov/faynosync-dashboard:latest` | 3000 | Web 管理面板 |
| db | `mongo:7` | 27017 | 元数据存储 |
| cache | `redis:7-alpine` | 6379 | 缓存 |
| s3 | `minio/minio` | 9010 (API) / 9011 (Console) | 对象存储 |
| s3-init | `minio/mc` | — | 初始化存储桶（一次性） |

## 部署

### 前置条件

- Docker 和 Docker Compose
- 可选：反向代理（Nginx/Caddy）配置域名和 HTTPS

### 步骤

```bash
# 1. 复制环境变量文件
cp .env.example .env

# 2. 生成安全密钥并填入 .env
#    API_KEY:
openssl rand -base64 16
#    JWT_SECRET:
openssl rand -base64 32

# 3. 修改 .env 中的 S3_ACCESS_KEY / S3_SECRET_KEY / MONGO_PASSWORD 等默认值

# 4. 启动所有服务
docker compose up -d

# 5. 查看日志确认启动正常
docker compose logs -f api
```

### 验证

```bash
# API 健康检查
curl http://localhost:9000/status

# Dashboard
open http://localhost:3000

# MinIO Console
open http://localhost:9011
```

## 初始化配置

服务启动后，通过 Dashboard（`http://localhost:3000`）完成以下一次性配置。

### 1. 注册管理员账号

首次打开 Dashboard，使用 `.env` 中配置的 `API_KEY` 注册管理员账号。

### 2. 创建 Channel

对应 TTPOS 的三个构建环境：

| Channel | 说明 |
|---------|------|
| `prod` | 正式环境（release 分支构建） |
| `test` | 测试环境（其他分支构建） |
| `dev` | 开发环境 |

### 3. 创建 Platform

对应三个目标平台，均使用 `manual` updater：

| Platform | Architecture | 说明 |
|----------|-------------|------|
| `android` | `arm64` | APK 安装包 |
| `windows` | `amd64` | Inno Setup EXE 安装包 |
| `macos` | `amd64`, `arm64` | 签名公证 DMG |

### 4. 创建 App

对应 TTPOS 的 7 个应用包：

| App Name | 对应包名 | 平台 | 说明 |
|----------|---------|------|------|
| `TTPOS` | pos | Android, Windows, macOS | 收银端 |
| `TTPOS Go` | assistant | Android, Windows, macOS | 助手端 |
| `TTPOS Kitchen` | kds | Android, Windows, macOS | 厨显端 |
| `TTPOS Menu` | tablet | Android, Windows, macOS | 点餐端 |
| `TTPOS Shop` | shop | Android, Windows, macOS | 商城端 |
| `TTPOS Queue` | qds | Android | 排队端 |
| `TTPOS Kiosk` | kiosk | — | 自助终端（预留） |

### 5. 创建 CI/CD Token

用于 GitHub Actions workflow 自动上传构建产物，比 username/password 更安全。

1. 登录 Dashboard，进入 Token 管理页面
2. 创建新 Token：
   - **Name**: `GitHub Actions`
   - **Allowed Apps**: 选择所有需要自动上传的 App（或留空允许全部）
   - **Expires At**: 按需设置过期时间
3. **立即保存返回的 Token 值**（仅显示一次）
4. 在 GitHub 仓库 Settings > Secrets and variables > Actions 中配置：
   - `FAYNOSYNC_URL` — FaynoSync API 公网地址（如 `https://update.ttpos.com`）
   - `FAYNOSYNC_TOKEN` — 上一步创建的 CI/CD Token

配置完成后，在触发 build workflow 时勾选 "是否上传到 FaynoSync" 即可自动上传。

## API 参考

### 上传版本（CI/CD 调用）

```bash
# 使用 CI/CD Token 上传（推荐，workflow 中已集成）
curl -X POST http://localhost:9000/upload \
  -H "Authorization: Bearer ${FAYNOSYNC_TOKEN}" \
  -F "file=@TTPOS-Cashier-V1.3.0.apk" \
  -F 'data={"app_name":"TTPOS","version":"1.3.0","channel":"prod","publish":true,"critical":false,"platform":"android","arch":"arm64","changelog":"Build from release"}'
```

也可以通过 JWT 登录后上传：

```bash
TOKEN=$(curl -s -X POST http://localhost:9000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}' | jq -r '.token')

curl -X POST http://localhost:9000/upload \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@TTPOS-Cashier-V1.3.0.apk" \
  -F 'data={"app_name":"TTPOS","version":"1.3.0","channel":"prod","publish":true,"critical":false,"platform":"android","arch":"arm64","changelog":"1. 修复收银异常\n2. 新增会员功能"}'
```

### 检查更新（客户端调用）

```bash
curl "http://localhost:9000/checkVersion?app_name=TTPOS&version=1.2.0&channel=prod&platform=android&arch=arm64&owner=admin"
```

### 获取最新版本下载链接

```bash
curl -L "http://localhost:9000/apps/latest?app_name=TTPOS&channel=prod&platform=android&arch=arm64&package=apk&owner=admin"
```

## 升级

更新 FaynoSync 版本只需修改 `docker-compose.yml` 中的镜像 tag：

```bash
# 编辑 docker-compose.yml 中 api 服务的 image 版本号
# 然后重新拉取并重启
docker compose pull api
docker compose up -d api
```

## 备份

### MongoDB

```bash
# 导出
docker compose exec db mongodump \
  --username root --password changeme \
  --authenticationDatabase admin \
  --db faynosync \
  --out /tmp/backup

docker compose cp db:/tmp/backup ./backup-$(date +%Y%m%d)

# 恢复
docker compose cp ./backup-20260306 db:/tmp/backup
docker compose exec db mongorestore \
  --username root --password changeme \
  --authenticationDatabase admin \
  /tmp/backup
```

### MinIO

MinIO 数据通过 Docker volume `minio_data` 持久化。也可以使用 `mc mirror` 做增量备份：

```bash
# 在宿主机安装 mc 后
mc alias set local http://localhost:9010 <S3_ACCESS_KEY> <S3_SECRET_KEY>
mc mirror local/faynosync-public ./backup-s3/public
mc mirror local/faynosync-private ./backup-s3/private
```

## 相关文档

- [FaynoSync 官方文档](https://faynosync.com/docs/intro)
- [FaynoSync GitHub](https://github.com/ku9nov/faynoSync)
- [FaynoSync Dashboard](https://github.com/ku9nov/faynoSync-dashboard)
- [MinIO 文档](https://min.io/docs/minio/container/index.html)
