# iOS 签名与 TestFlight 配置指南

本文档说明 `build-ios.yaml` 工作流所需的全部签名及分发相关 GitHub Secrets 的获取与配置方法。

## 前提条件

- 一个 [Apple Developer Program](https://developer.apple.com/programs/) 付费账号
- 拥有 **Apple Distribution** 类型的证书（用于 App Store / TestFlight 分发）
- 已在 Apple Developer 后台为每个 App 创建 **App Store** 类型的 Provisioning Profile
- 已在 [App Store Connect](https://appstoreconnect.apple.com) 中创建对应的 App 记录

## Secrets 总览

| # | Secret 名称 | 必须 | 格式 | 说明 |
|---|-------------|:----:|------|------|
| 1 | `IOS_SIGNING_CERT_BASE64` | 是 | base64 | Apple Distribution 证书 (.p12) |
| 2 | `IOS_SIGNING_CERT_PASSWORD` | 是 | 明文 | .p12 证书的导出密码 |
| 3 | `IOS_KEYCHAIN_PASSWORD` | 否 | 明文 | CI 临时钥匙串密码（有默认值） |
| 4 | `IOS_POS_PROFILE_BASE64` | 是 | base64 | TTPOS Cashier 描述文件 |
| 5 | `IOS_ASSISTANT_PROFILE_BASE64` | 是 | base64 | TTPOS Go 描述文件 |
| 6 | `IOS_KDS_PROFILE_BASE64` | 是 | base64 | TTPOS Kitchen 描述文件 |
| 7 | `IOS_TABLET_PROFILE_BASE64` | 是 | base64 | TTPOS Menu 描述文件 |
| 8 | `IOS_SHOP_PROFILE_BASE64` | 是 | base64 | TTPOS Shop 描述文件 |
| 9 | `ASC_API_KEY_ID` | 是 | 明文 | App Store Connect API Key ID |
| 10 | `ASC_ISSUER_ID` | 是 | 明文 | App Store Connect Issuer ID |
| 11 | `ASC_API_KEY_BASE64` | 是 | base64 | API Key (.p8) 文件 |

---

## 1. Apple Distribution 证书

> **注意**：iOS 使用的证书类型与 macOS 不同。macOS 工作流使用 **Developer ID Application** 证书，iOS 工作流使用 **Apple Distribution** 证书。两者不能互换。

### 生成证书（如尚未拥有）

1. 登录 [Apple Developer - Certificates](https://developer.apple.com/account/resources/certificates/list)
2. 点击 **+** → 选择 **Apple Distribution**
3. 按照向导上传 CSR（证书签名请求），下载并安装到 Mac 钥匙串

### 获取 .p12 文件

在安装了该证书的 Mac 上操作：

1. 打开 **钥匙串访问** (Keychain Access)
2. 在左侧选择 **登录** 钥匙串 → 上方选 **我的证书** 分类
3. 找到 `Apple Distribution: 你的公司名 (TEAM_ID)`
4. 右键 → **导出项目...** → 选择文件格式 **个人信息交换 (.p12)**
5. 设置一个导出密码（此密码即 `IOS_SIGNING_CERT_PASSWORD`）

### 编码并上传

```bash
# 编码为 base64（输出复制到剪贴板）
base64 -i apple_distribution_cert.p12 | tr -d '\n' | pbcopy

# 可选：确认编码长度（通常数千字符）
echo "长度: $(base64 -i apple_distribution_cert.p12 | tr -d '\n' | wc -c) 字符"
```

| Secret | 值 |
|--------|------|
| `IOS_SIGNING_CERT_BASE64` | 粘贴上面 base64 输出 |
| `IOS_SIGNING_CERT_PASSWORD` | 导出 .p12 时设置的密码 |

### 验证

```bash
# 查看证书信息
openssl pkcs12 -in apple_distribution_cert.p12 -nokeys -clcerts 2>/dev/null | openssl x509 -noout -subject -dates

# 验证编解码完整性
base64 -i apple_distribution_cert.p12 | tr -d '\n' > /tmp/cert_b64.txt
base64 -D -i /tmp/cert_b64.txt > /tmp/cert_verify.p12
diff apple_distribution_cert.p12 /tmp/cert_verify.p12 && echo "编解码一致" || echo "编解码不一致!"
rm /tmp/cert_b64.txt /tmp/cert_verify.p12
```

---

## 2. Provisioning Profiles（描述文件）

每个 App 需要各自的 **App Store** 类型描述文件。

> **注意**：iOS 描述文件扩展名为 `.mobileprovision`，与 macOS 的 `.provisionprofile` 不同。

### 获取

1. 登录 [Apple Developer - Profiles](https://developer.apple.com/account/resources/profiles/list)
2. 找到对应 App 的 **App Store** 类型描述文件并下载
3. 如果不存在，点击 **+** 新建：
   - 分发类型选 **App Store Connect**
   - 选择对应的 iOS **App ID**
   - 选择 **Apple Distribution** 证书
   - 下载 `.mobileprovision` 文件

### 编码并上传

逐个编码每个描述文件：

```bash
# TTPOS Cashier (pos)
base64 -i TTPOS_Cashier_AppStore.mobileprovision | tr -d '\n' | pbcopy
# → 粘贴到 IOS_POS_PROFILE_BASE64

# TTPOS Go (assistant)
base64 -i TTPOS_Go_AppStore.mobileprovision | tr -d '\n' | pbcopy
# → 粘贴到 IOS_ASSISTANT_PROFILE_BASE64

# TTPOS Kitchen (kds)
base64 -i TTPOS_Kitchen_AppStore.mobileprovision | tr -d '\n' | pbcopy
# → 粘贴到 IOS_KDS_PROFILE_BASE64

# TTPOS Menu (tablet)
base64 -i TTPOS_Menu_AppStore.mobileprovision | tr -d '\n' | pbcopy
# → 粘贴到 IOS_TABLET_PROFILE_BASE64

# TTPOS Shop (shop)
base64 -i TTPOS_Shop_AppStore.mobileprovision | tr -d '\n' | pbcopy
# → 粘贴到 IOS_SHOP_PROFILE_BASE64
```

对应关系：

| 描述文件 App | 工作流 package | Secret |
|-------------|---------------|--------|
| TTPOS Cashier | `pos` | `IOS_POS_PROFILE_BASE64` |
| TTPOS Go | `assistant` | `IOS_ASSISTANT_PROFILE_BASE64` |
| TTPOS Kitchen | `kds` | `IOS_KDS_PROFILE_BASE64` |
| TTPOS Menu | `tablet` | `IOS_TABLET_PROFILE_BASE64` |
| TTPOS Shop | `shop` | `IOS_SHOP_PROFILE_BASE64` |

### 验证描述文件内容

```bash
# 查看描述文件的 App ID、Team、过期时间等
security cms -D -i YourProfile.mobileprovision | plutil -p -
```

---

## 3. App Store Connect API Key

API Key 用于在 CI 中上传 IPA 到 TestFlight，无需 2FA 或 App 专用密码。

### 生成 API Key

1. 登录 [App Store Connect - Users and Access - Integrations - App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
2. 点击 **Generate API Key**（如果是首次使用需要先同意条款）
3. 填写名称（如 `GitHub CI`），角色选择 **Admin** 或 **App Manager**
4. 点击 **Generate**
5. 记录以下信息：
   - **Key ID**：显示在列表中（如 `ABC123DEF4`）
   - **Issuer ID**：页面顶部显示（如 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）
6. 点击 **Download** 下载 `.p8` 文件

> **重要**：`.p8` 文件只能下载一次！请妥善保存。

### 编码并上传

```bash
# 编码 .p8 文件
base64 -i AuthKey_ABC123DEF4.p8 | tr -d '\n' | pbcopy
# → 粘贴到 ASC_API_KEY_BASE64
```

| Secret | 值 |
|--------|------|
| `ASC_API_KEY_ID` | API Key 列表中的 Key ID，如 `ABC123DEF4` |
| `ASC_ISSUER_ID` | 页面顶部的 Issuer ID，如 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `ASC_API_KEY_BASE64` | 上面 base64 编码的 `.p8` 文件内容 |

### 权限说明

| 角色 | 能力 |
|------|------|
| **Admin** | 上传构建 + 提交审核 + 管理 App 元数据 |
| **App Manager** | 上传构建 + 提交审核 |
| **Developer** | 仅上传构建（不能提交审核） |

CI 至少需要 **App Manager** 角色才能完成 TestFlight 上传。

---

## 4. App Store Connect 中创建 App 记录

每个 App 在上传 IPA 之前，需要在 App Store Connect 中有对应的记录。

1. 登录 [App Store Connect - My Apps](https://appstoreconnect.apple.com/apps)
2. 点击 **+** → **New App**
3. 填写：
   - **Platform**: iOS
   - **Name**: 应用名称
   - **Primary Language**: 选择主语言
   - **Bundle ID**: 选择在 Developer 后台创建的 App ID
   - **SKU**: 自定义标识符（如 `ttpos-cashier-ios`）
4. 对 5 个 App 重复此操作

---

## 5. 可选 Secrets

### `IOS_KEYCHAIN_PASSWORD`

CI 运行时创建临时钥匙串使用的密码。**不需要从 Apple 获取**，自行定义任意强密码。

不配置时使用默认值 `github-actions-ios-2024`，一般无需修改。

---

## 如何在 GitHub 中配置 Secrets

1. 打开仓库页面 → **Settings** → **Secrets and variables** → **Actions**
2. 点击 **New repository secret**
3. 填写 **Name**（如 `IOS_SIGNING_CERT_BASE64`）和 **Secret**（粘贴值）
4. 点击 **Add secret**

> **重要提示**：
> - base64 编码的值必须是**不含换行的单行字符串**，使用 `| tr -d '\n'` 确保
> - 粘贴时注意不要引入额外的空格或换行
> - GitHub Secrets 一旦保存就无法查看，只能更新或删除

---

## 与 macOS 签名的区别

| 维度 | macOS (`build-macos.yaml`) | iOS (`build-ios.yaml`) |
|------|---------------------------|------------------------|
| 证书类型 | Developer ID Application | Apple Distribution |
| 描述文件类型 | Developer ID | App Store |
| 描述文件扩展名 | `.provisionprofile` | `.mobileprovision` |
| 分发方式 | 直接下载 (DMG) | TestFlight → App Store |
| 公证 | 需要 (notarytool) | 不需要 |
| 代码签名 | 手动深度签名 | Xcode 自动处理 |
| 上传认证 | Apple ID + App 专用密码 | App Store Connect API Key |

---

## 常见问题

### `altool: error: No suitable application records were found`

App Store Connect 中尚未为该 Bundle ID 创建 App 记录。请按第 4 节操作创建。

### `altool: error: Unable to authenticate`

API Key 配置有误。检查：
- `ASC_API_KEY_ID` 是否正确
- `ASC_ISSUER_ID` 是否正确
- `.p8` 文件是否完整（base64 编解码无误）

### `ERROR ITMS-90046: Invalid Code Signing Entitlements`

描述文件与 App ID 的 capabilities 不匹配。在 Apple Developer 后台检查 App ID 的功能配置，然后重新生成描述文件。

### `ERROR ITMS-90060: The value provided for the ... is not available`

版本号或构建号（Build Number）与 App Store Connect 中已有的构建冲突。确保每次上传的构建号递增。

### `ERROR ITMS-90161: Invalid Provisioning Profile`

描述文件可能已过期或与证书不匹配。重新在 Apple Developer 后台生成并更新 `IOS_*_PROFILE_BASE64`。

### 上传成功但 TestFlight 中看不到构建

Apple 对上传的构建进行自动处理（通常需要 5-30 分钟）。如果长时间未出现：
- 检查 App Store Connect 中的 **Activity** 页面是否有处理状态
- 查看注册邮箱是否收到 Apple 的处理失败通知邮件

---

## 证书续期

Apple Distribution 证书有效期为 1 年。过期前需要：

1. 在 Apple Developer 后台重新生成证书
2. 下载新证书并导入钥匙串
3. 导出新的 .p12 文件
4. 重新编码并更新 `IOS_SIGNING_CERT_BASE64` 和 `IOS_SIGNING_CERT_PASSWORD`
5. 重新生成所有描述文件（因为绑定了新证书），更新 `IOS_*_PROFILE_BASE64`

Provisioning Profile 有效期为 1 年，过期后需重新下载并更新对应的 `IOS_*_PROFILE_BASE64`。

App Store Connect API Key **不会过期**，除非手动撤销。
