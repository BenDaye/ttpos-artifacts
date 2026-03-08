# macOS 签名配置指南

本文档说明 `build-macos.yaml` 工作流所需的全部签名相关 GitHub Secrets 的获取与配置方法。

## 前提条件

- 一个 [Apple Developer Program](https://developer.apple.com/programs/) 付费账号
- 拥有 **Developer ID Application** 类型的证书（用于 Mac App 分发签名）
- 已在 Apple Developer 后台为每个 App 创建 **Developer ID** 类型的 Provisioning Profile

## Secrets 总览

| # | Secret 名称 | 必须 | 格式 | 说明 |
|---|-------------|:----:|------|------|
| 1 | `MAC_SIGNING_CERT_BASE64` | 是 | base64 | Developer ID Application 证书 (.p12) |
| 2 | `MAC_SIGNING_CERT_PASSWORD` | 是 | 明文 | .p12 证书的导出密码 |
| 3 | `MAC_SIGNING_TEAM_ID` | 是 | 明文 | Apple 开发者团队 ID |
| 4 | `MAC_KEYCHAIN_PASSWORD` | 否 | 明文 | CI 临时钥匙串密码（有默认值） |
| 5 | `MAC_SIGNING_ENTITLEMENTS_PATH` | 否 | 明文 | 自定义 entitlements 路径（自动查找） |
| 6 | `APPLE_ID` | 是 | 明文 | Apple ID 邮箱（用于公证） |
| 7 | `APPLE_APP_SPECIFIC_PASSWORD` | 是 | 明文 | App 专用密码（用于公证） |
| 8 | `APPLE_TEAM_ID` | 是 | 明文 | 开发者团队 ID（与 #3 相同） |
| 9 | `MAC_POS_PROFILE_BASE64` | 是 | base64 | TTPOS Cashier 描述文件 |
| 10 | `MAC_ASSISTANT_PROFILE_BASE64` | 是 | base64 | TTPOS Go 描述文件 |
| 11 | `MAC_KDS_PROFILE_BASE64` | 是 | base64 | TTPOS Kitchen 描述文件 |
| 12 | `MAC_TABLET_PROFILE_BASE64` | 是 | base64 | TTPOS Menu 描述文件 |
| 13 | `MAC_SHOP_PROFILE_BASE64` | 是 | base64 | TTPOS Shop 描述文件 |

---

## 1. Developer ID Application 证书

### 获取 .p12 文件

在安装了该证书的 Mac 上操作：

1. 打开 **钥匙串访问** (Keychain Access)
2. 在左侧选择 **登录** 钥匙串 → 上方选 **我的证书** 分类
3. 找到 `Developer ID Application: 你的公司名 (TEAM_ID)`
4. 右键 → **导出项目...** → 选择文件格式 **个人信息交换 (.p12)**
5. 设置一个导出密码（此密码即 `MAC_SIGNING_CERT_PASSWORD`）

### 编码并上传

```bash
# 编码为 base64（输出复制到剪贴板）
base64 -i developer_id_cert.p12 | tr -d '\n' | pbcopy

# 可选：确认编码长度（通常数千字符）
echo "长度: $(base64 -i developer_id_cert.p12 | tr -d '\n' | wc -c) 字符"
```

| Secret | 值 |
|--------|------|
| `MAC_SIGNING_CERT_BASE64` | 粘贴上面 base64 输出 |
| `MAC_SIGNING_CERT_PASSWORD` | 导出 .p12 时设置的密码 |

### 验证

```bash
# 查看证书信息
openssl pkcs12 -in developer_id_cert.p12 -nokeys -clcerts 2>/dev/null | openssl x509 -noout -subject -dates

# 验证编解码完整性
base64 -i developer_id_cert.p12 | tr -d '\n' > /tmp/cert_b64.txt
base64 -D -i /tmp/cert_b64.txt > /tmp/cert_verify.p12
diff developer_id_cert.p12 /tmp/cert_verify.p12 && echo "编解码一致" || echo "编解码不一致!"
rm /tmp/cert_b64.txt /tmp/cert_verify.p12
```

---

## 2. 开发者团队 ID

### 获取

方法一：登录 [Apple Developer](https://developer.apple.com/account) → **Membership Details** → **Team ID**

方法二：从证书名称中提取，括号内即为 Team ID：
```
Developer ID Application: Your Company (N278MM4R33)
                                        ^^^^^^^^^^
```

方法三：终端查询：
```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

| Secret | 值 |
|--------|------|
| `MAC_SIGNING_TEAM_ID` | 10 位字母数字，如 `N278MM4R33` |
| `APPLE_TEAM_ID` | 同上（两个 secret 填相同的值） |

---

## 3. Apple 公证凭据

公证 (Notarization) 让用户下载 DMG 后无需手动信任即可打开。

### 获取 App 专用密码

1. 登录 [appleid.apple.com](https://appleid.apple.com)
2. **登录和安全** → **App 专用密码**
3. 点击 **+** 生成新密码，标签建议填 `GitHub CI`
4. 复制生成的密码（格式为 `xxxx-xxxx-xxxx-xxxx`）

| Secret | 值 |
|--------|------|
| `APPLE_ID` | Apple Developer 登录邮箱，如 `dev@yourcompany.com` |
| `APPLE_APP_SPECIFIC_PASSWORD` | 上面生成的 App 专用密码 |
| `APPLE_TEAM_ID` | 同第 2 节的 Team ID |

> **注意**：App 专用密码与 Apple ID 密码不同，是专为第三方应用（如 CI）生成的独立密码。

---

## 4. Provisioning Profiles（描述文件）

每个 App 需要各自的 Developer ID 类型描述文件。

### 获取

1. 登录 [Apple Developer - Profiles](https://developer.apple.com/account/resources/profiles/list)
2. 找到对应 App 的 **Developer ID** 类型描述文件并下载
3. 如果不存在，点击 **+** 新建：
   - 类型选 **Developer ID**
   - 选择对应的 App ID
   - 选择 Developer ID Application 证书
   - 下载 `.provisionprofile` 文件

### 编码并上传

逐个编码每个描述文件：

```bash
# TTPOS Cashier (pos)
base64 -i TTPOS_Cashier.provisionprofile | tr -d '\n' | pbcopy
# → 粘贴到 MAC_POS_PROFILE_BASE64

# TTPOS Go (assistant)
base64 -i TTPOS_Go.provisionprofile | tr -d '\n' | pbcopy
# → 粘贴到 MAC_ASSISTANT_PROFILE_BASE64

# TTPOS Kitchen (kds)
base64 -i TTPOS_Kitchen.provisionprofile | tr -d '\n' | pbcopy
# → 粘贴到 MAC_KDS_PROFILE_BASE64

# TTPOS Menu (tablet)
base64 -i TTPOS_Menu.provisionprofile | tr -d '\n' | pbcopy
# → 粘贴到 MAC_TABLET_PROFILE_BASE64

# TTPOS Shop (shop)
base64 -i TTPOS_Shop.provisionprofile | tr -d '\n' | pbcopy
# → 粘贴到 MAC_SHOP_PROFILE_BASE64
```

对应关系：

| 描述文件 App | 工作流 package | Secret |
|-------------|---------------|--------|
| TTPOS Cashier | `pos` | `MAC_POS_PROFILE_BASE64` |
| TTPOS Go | `assistant` | `MAC_ASSISTANT_PROFILE_BASE64` |
| TTPOS Kitchen | `kds` | `MAC_KDS_PROFILE_BASE64` |
| TTPOS Menu | `tablet` | `MAC_TABLET_PROFILE_BASE64` |
| TTPOS Shop | `shop` | `MAC_SHOP_PROFILE_BASE64` |

### 验证描述文件内容

```bash
# 查看描述文件的 App ID、Team、过期时间等
security cms -D -i YourProfile.provisionprofile | plutil -p -
```

---

## 5. 可选 Secrets

### `MAC_KEYCHAIN_PASSWORD`

CI 运行时创建临时钥匙串使用的密码。**不需要从 Apple 获取**，自行定义任意强密码。

不配置时使用默认值 `github-actions-secure-2024`，一般无需修改。

### `MAC_SIGNING_ENTITLEMENTS_PATH`

自定义 entitlements 文件的路径覆盖。工作流会自动在以下位置查找：
- `apps/{package}/macos/Runner/Release.entitlements`
- `apps/{package}/macos/Runner/DebugProfile.entitlements`

除非需要指定非标准路径，否则无需配置。

---

## 如何在 GitHub 中配置 Secrets

1. 打开仓库页面 → **Settings** → **Secrets and variables** → **Actions**
2. 点击 **New repository secret**
3. 填写 **Name**（如 `MAC_SIGNING_CERT_BASE64`）和 **Secret**（粘贴值）
4. 点击 **Add secret**

> **重要提示**：
> - base64 编码的值必须是**不含换行的单行字符串**，使用 `| tr -d '\n'` 确保
> - 粘贴时注意不要引入额外的空格或换行
> - GitHub Secrets 一旦保存就无法查看，只能更新或删除

---

## 常见问题

### `base64: stdin: (null): error decoding base64 input stream`

`MAC_SIGNING_CERT_BASE64` 的值不是有效的 base64。重新编码并确保使用 `tr -d '\n'` 去除换行。

### `bad substitution` 错误

macOS runner 使用 Bash 3.2，不支持 `${var^^}` 语法。工作流中已使用 `tr '[:lower:]' '[:upper:]'` 替代。

### `无法解析描述文件 UUID, 文件可能损坏`

描述文件的 base64 编码有误，或者描述文件本身已过期/损坏。重新下载并编码。

### 公证失败

- 检查 `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID` 是否正确
- App 专用密码可能已过期，需重新生成
- 公证失败不会阻断构建流程（`continue-on-error: true`），DMG 仍然可用，只是用户首次打开时需手动信任

---

## 证书续期

Apple Developer ID 证书有效期为 5 年。过期前需要：

1. 在 Apple Developer 后台重新生成证书
2. 下载新证书并导入钥匙串
3. 导出新的 .p12 文件
4. 重新编码并更新 `MAC_SIGNING_CERT_BASE64` 和 `MAC_SIGNING_CERT_PASSWORD`
5. 如果 Team ID 未变，其他 Secrets 无需修改

Provisioning Profile 有效期为 1 年，过期后需重新下载并更新对应的 `MAC_*_PROFILE_BASE64`。
