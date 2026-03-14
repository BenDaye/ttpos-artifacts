# Flutter 客户端接入指南 — packages/updater

面向 `innet8/ttpos-flutter` 仓库，创建 `packages/updater` Melos 子包，对接 FaynoSync 实现应用内检查更新、下载、安装。

---

## 1. 包结构

```
packages/updater/
├── lib/
│   ├── updater.dart                       # barrel export
│   └── src/
│       ├── config.dart                     # UpdateConfig
│       ├── models.dart                     # UpdateInfo, Artifact
│       ├── faynosync_client.dart           # HTTP 请求封装
│       ├── version_comparator.dart         # 语义化版本比较
│       ├── updater_service.dart            # 统一入口：check → download → install
│       ├── downloader.dart                 # 文件下载（带进度回调）
│       └── installer/
│           ├── installer.dart              # 抽象接口 + 工厂
│           ├── android_installer.dart      # APK 安装
│           ├── windows_installer.dart      # EXE 静默安装
│           └── macos_installer.dart        # DMG 挂载安装
├── test/
│   ├── faynosync_client_test.dart
│   ├── version_comparator_test.dart
│   └── updater_service_test.dart
├── pubspec.yaml
├── analysis_options.yaml
└── README.md
```

## 2. pubspec.yaml

```yaml
name: updater
description: TTPOS application auto-updater powered by FaynoSync
version: 0.1.0
publish_to: none

environment:
  sdk: ">=3.2.0 <4.0.0"
  flutter: ">=3.27.0"

dependencies:
  flutter:
    sdk: flutter
  http: ^1.2.0
  path_provider: ^2.1.0
  path: ^1.9.0
  # Android APK 安装
  open_filex: ^4.5.0
  # Windows/macOS 打开文件
  url_launcher: ^6.2.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0
  mockito: ^5.4.0
  build_runner: ^2.4.0
```

## 3. FaynoSync API 参考（客户端侧）

所有客户端请求**无需认证**（`auth: noauth`）。

### 3.1 检查更新 — `GET /checkVersion`

客户端的**核心 API**，传入当前版本号，服务端比较后返回是否有更新。

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `app_name` | string | ✅ | FaynoSync 中的应用名 |
| `version` | string | ✅ | 当前安装的版本号 |
| `channel` | string | ❌ | 渠道：`prod` / `test` / `dev` |
| `platform` | string | ❌ | 平台：`android` / `windows` / `macos` |
| `arch` | string | ❌ | 架构：`arm64` / `amd64` |
| `owner` | string | ✅ | FaynoSync 管理员用户名 |

#### 请求示例

```
GET https://update.ttpos.com/checkVersion
  ?app_name=TTPOS
  &version=1.2.0
  &channel=prod
  &platform=android
  &arch=arm64
  &owner=admin
```

#### 有更新时的响应

```json
{
  "update_available": true,
  "update_url_apk": "https://s3.ttpos.com/TTPOS/prod/android/arm64/TTPOS-Cashier-V1.3.0.apk",
  "changelog": "### 1.3.0\n\n- 修复收银异常\n- 新增会员功能",
  "critical": false,
  "is_intermediate_required": false
}
```

> **注意**：`update_url_*` 的后缀取决于文件扩展名——`update_url_apk`、`update_url_exe`、`update_url_dmg`。
> 如果一个版本有多个文件格式，会返回多个 `update_url_*` 字段。

#### 无更新时的响应

```json
{
  "update_available": false
}
```

#### 响应字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `update_available` | bool | 是否有新版本 |
| `update_url_{ext}` | string | 下载地址（ext = apk / exe / dmg 等） |
| `changelog` | string | 更新日志（Markdown 格式） |
| `critical` | bool | 是否为强制更新 |
| `is_intermediate_required` | bool | 是否需要先安装中间版本 |

### 3.2 获取最新版本 — `GET /apps/latest`

另一种方式，直接获取最新版本的下载地址，不做版本比较。

```
GET https://update.ttpos.com/apps/latest
  ?app_name=TTPOS
  &channel=prod
  &platform=android
  &arch=arm64
  &package=apk
  &owner=admin
```

- 指定 `package` 参数时，**直接 302 重定向**到文件下载地址
- 不指定时返回该 channel/platform/arch 下所有可用格式

### 3.3 私有下载 — `GET /download`

当 `ENABLE_PRIVATE_APP_DOWNLOADING=true` 时，通过此端点获取签名下载 URL：

```
GET https://update.ttpos.com/download?key=TTPOS/prod/android/arm64/TTPOS-Cashier-V1.3.0.apk
```

> 当前部署 `ENABLE_PRIVATE_APP_DOWNLOADING=false`，`checkVersion` 返回的 URL 可直接下载，无需使用此端点。

---

## 4. 应用映射表

在 Flutter 代码中，需要将包名（`package`）映射到 FaynoSync 的应用名：

| package (Melos) | FaynoSync `app_name` | 平台 | 架构 |
|-----------------|---------------------|------|------|
| `pos` | `TTPOS` | android, windows, macos, ios | arm64, amd64 |
| `assistant` | `TTPOS Go` | android, windows, macos, ios | arm64, amd64 |
| `kds` | `TTPOS Kitchen` | android, windows, macos, ios | arm64, amd64 |
| `tablet` | `TTPOS Menu` | android, windows, macos, ios | arm64, amd64 |
| `shop` | `TTPOS Shop` | android, windows, macos, ios | arm64, amd64 |
| `qds` | `TTPOS Queue` | android | arm64 |

> **iOS 说明**：iOS 通过 App Store 分发，FaynoSync 仅存储版本元数据（changelog、critical 标记等）。
> CI 上传占位文件注册版本，待 App Store 审核通过后在 Dashboard 手动 publish。

### Channel 映射

| 构建环境 | FaynoSync `channel` |
|----------|-------------------|
| release 分支 | `prod` |
| 其他分支 | `test` |
| 开发本地 | `dev` |

---

## 5. 核心实现

### 5.1 UpdateConfig

```dart
class UpdateConfig {
  final String baseUrl;       // FaynoSync API 地址，如 https://update.ttpos.com
  final String appName;       // FaynoSync 应用名，如 "TTPOS"
  final String currentVersion;// 当前版本号，如 "1.2.0"
  final String channel;       // prod / test / dev
  final String platform;      // android / windows / macos
  final String arch;          // arm64 / amd64
  final String owner;         // FaynoSync 管理员用户名

  const UpdateConfig({
    required this.baseUrl,
    required this.appName,
    required this.currentVersion,
    required this.channel,
    required this.platform,
    required this.arch,
    required this.owner,
  });
}
```

### 5.2 UpdateInfo 模型

```dart
class UpdateInfo {
  final bool updateAvailable;
  final String? downloadUrl;    // 从 update_url_{ext} 中提取
  final String? version;        // 从 URL 或 changelog 解析
  final String? changelog;
  final bool critical;
  final bool intermediateRequired;

  const UpdateInfo({
    required this.updateAvailable,
    this.downloadUrl,
    this.version,
    this.changelog,
    this.critical = false,
    this.intermediateRequired = false,
  });

  factory UpdateInfo.noUpdate() => const UpdateInfo(updateAvailable: false);
}
```

### 5.3 FaynoSyncClient

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class FaynoSyncClient {
  final http.Client _client;
  final UpdateConfig config;

  FaynoSyncClient({required this.config, http.Client? client})
      : _client = client ?? http.Client();

  /// 检查是否有新版本
  Future<UpdateInfo> checkVersion() async {
    final uri = Uri.parse('${config.baseUrl}/checkVersion').replace(
      queryParameters: {
        'app_name': config.appName,
        'version': config.currentVersion,
        'channel': config.channel,
        'platform': config.platform,
        'arch': config.arch,
        'owner': config.owner,
      },
    );

    final response = await _client.get(uri);
    if (response.statusCode != 200) {
      throw Exception('checkVersion failed: ${response.statusCode}');
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final available = json['update_available'] as bool? ?? false;

    if (!available) return UpdateInfo.noUpdate();

    // 从响应中提取 update_url_{ext}
    final downloadUrl = _extractDownloadUrl(json);

    return UpdateInfo(
      updateAvailable: true,
      downloadUrl: downloadUrl,
      changelog: json['changelog'] as String?,
      critical: json['critical'] as bool? ?? false,
      intermediateRequired: json['is_intermediate_required'] as bool? ?? false,
    );
  }

  /// 提取下载链接 —— 根据平台取对应扩展名
  String? _extractDownloadUrl(Map<String, dynamic> json) {
    // FaynoSync 返回 update_url_{ext} 格式
    // Android → update_url_apk
    // Windows → update_url_exe
    // macOS   → update_url_dmg
    final extMap = {
      'android': 'apk',
      'windows': 'exe',
      'macos': 'dmg',
    };

    final ext = extMap[config.platform];
    if (ext != null) {
      final key = 'update_url_$ext';
      if (json.containsKey(key)) return json[key] as String;
    }

    // fallback: 取第一个 update_url_* 字段
    for (final entry in json.entries) {
      if (entry.key.startsWith('update_url_') && entry.value is String) {
        return entry.value as String;
      }
    }
    return null;
  }

  void dispose() => _client.close();
}
```

### 5.4 Downloader（带进度）

```dart
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

typedef DownloadProgress = void Function(int received, int total);

class Downloader {
  final http.Client _client;

  Downloader({http.Client? client}) : _client = client ?? http.Client();

  /// 下载文件到临时目录，返回本地文件路径
  Future<String> download(
    String url, {
    DownloadProgress? onProgress,
  }) async {
    final request = http.Request('GET', Uri.parse(url));
    final response = await _client.send(request);

    if (response.statusCode != 200) {
      throw Exception('Download failed: ${response.statusCode}');
    }

    final contentLength = response.contentLength ?? -1;
    final dir = await getTemporaryDirectory();
    final fileName = Uri.parse(url).pathSegments.last;
    final filePath = p.join(dir.path, 'updater', fileName);

    // 确保目录存在
    await Directory(p.dirname(filePath)).create(recursive: true);

    final file = File(filePath);
    final sink = file.openWrite();
    int received = 0;

    await for (final chunk in response.stream) {
      sink.add(chunk);
      received += chunk.length;
      onProgress?.call(received, contentLength);
    }

    await sink.close();
    return filePath;
  }

  void dispose() => _client.close();
}
```

### 5.5 Installer 抽象 + 平台实现

```dart
// installer.dart
import 'dart:io';

abstract class Installer {
  Future<void> install(String filePath);

  factory Installer() {
    if (Platform.isAndroid) return AndroidInstaller();
    if (Platform.isWindows) return WindowsInstaller();
    if (Platform.isMacOS) return MacOSInstaller();
    throw UnsupportedError('Unsupported platform: ${Platform.operatingSystem}');
  }
}
```

#### Android — APK 安装

```dart
// android_installer.dart
import 'package:open_filex/open_filex.dart';

class AndroidInstaller implements Installer {
  @override
  Future<void> install(String filePath) async {
    // 通过系统 Intent 打开 APK 安装器
    // 需要在 AndroidManifest.xml 中声明:
    //   <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/>
    // 以及 FileProvider（Android 7+）
    final result = await OpenFilex.open(filePath, type: 'application/vnd.android.package-archive');
    if (result.type != ResultType.done) {
      throw Exception('APK install failed: ${result.message}');
    }
  }
}
```

**Android 额外配置**（在各 app 的 `android/app/src/main/AndroidManifest.xml`）：

```xml
<!-- 安装 APK 权限（Android 8+） -->
<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/>

<!-- FileProvider（Android 7+ 文件分享） -->
<application>
  <provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.fileprovider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
      android:name="android.support.FILE_PROVIDER_PATHS"
      android:resource="@xml/file_paths"/>
  </provider>
</application>
```

`android/app/src/main/res/xml/file_paths.xml`：

```xml
<?xml version="1.0" encoding="utf-8"?>
<paths>
  <cache-path name="cache" path="."/>
  <external-cache-path name="external_cache" path="."/>
</paths>
```

#### Windows — EXE 安装

```dart
// windows_installer.dart
import 'dart:io';

class WindowsInstaller implements Installer {
  @override
  Future<void> install(String filePath) async {
    // Inno Setup 支持 /SILENT 或 /VERYSILENT 静默安装
    // /CLOSEAPPLICATIONS 自动关闭当前运行的应用实例
    final result = await Process.run(filePath, ['/SILENT', '/CLOSEAPPLICATIONS']);
    if (result.exitCode != 0) {
      throw Exception('EXE install failed (exit ${result.exitCode}): ${result.stderr}');
    }
  }
}
```

#### macOS — DMG 安装

```dart
// macos_installer.dart
import 'dart:io';
import 'package:path/path.dart' as p;

class MacOSInstaller implements Installer {
  @override
  Future<void> install(String filePath) async {
    // 1. 挂载 DMG
    final mountResult = await Process.run('hdiutil', ['attach', filePath, '-nobrowse']);
    if (mountResult.exitCode != 0) {
      throw Exception('DMG mount failed: ${mountResult.stderr}');
    }

    // 从 hdiutil 输出中解析挂载路径
    final mountPoint = _parseMountPoint(mountResult.stdout as String);

    try {
      // 2. 查找 .app 文件
      final mountDir = Directory(mountPoint);
      final appDir = mountDir.listSync().firstWhere(
        (e) => e.path.endsWith('.app'),
        orElse: () => throw Exception('No .app found in DMG'),
      );

      // 3. 复制到 /Applications
      final appName = p.basename(appDir.path);
      final target = '/Applications/$appName';

      // 先删除旧版本
      if (Directory(target).existsSync()) {
        await Directory(target).delete(recursive: true);
      }

      await Process.run('cp', ['-R', appDir.path, target]);

      // 4. 重新启动应用
      await Process.run('open', [target]);
    } finally {
      // 5. 卸载 DMG
      await Process.run('hdiutil', ['detach', mountPoint]);
    }
  }

  String _parseMountPoint(String output) {
    // hdiutil attach 输出最后一行的最后一列是挂载路径
    final lines = output.trim().split('\n');
    final lastLine = lines.last;
    // 格式: /dev/disk4s1   Apple_HFS   /Volumes/TTPOS
    final match = RegExp(r'\t(/Volumes/.+)$').firstMatch(lastLine);
    return match?.group(1) ?? '/Volumes/${lastLine.split('\t').last}';
  }
}
```

### 5.6 UpdaterService — 统一入口

```dart
class UpdaterService {
  final FaynoSyncClient _client;
  final Downloader _downloader;
  final Installer _installer;

  UpdaterService({
    required UpdateConfig config,
  })  : _client = FaynoSyncClient(config: config),
        _downloader = Downloader(),
        _installer = Installer();

  /// 仅检查更新
  Future<UpdateInfo> checkForUpdate() => _client.checkVersion();

  /// 检查 + 下载 + 安装（全流程）
  Future<void> updateNow({
    DownloadProgress? onDownloadProgress,
  }) async {
    final info = await checkForUpdate();
    if (!info.updateAvailable || info.downloadUrl == null) return;

    final filePath = await _downloader.download(
      info.downloadUrl!,
      onProgress: onDownloadProgress,
    );

    await _installer.install(filePath);
  }

  void dispose() {
    _client.dispose();
    _downloader.dispose();
  }
}
```

---

## 6. 集成到各 App

### 6.1 配置初始化

在各应用端（pos、assistant、kds 等）的启动逻辑中初始化：

```dart
import 'dart:io';
import 'package:updater/updater.dart';

// 应用名映射
const kAppNameMap = {
  'pos': 'TTPOS',
  'assistant': 'TTPOS Go',
  'kds': 'TTPOS Kitchen',
  'tablet': 'TTPOS Menu',
  'shop': 'TTPOS Shop',
  'qds': 'TTPOS Queue',
};

UpdaterService createUpdaterService({
  required String packageName,     // Melos 包名
  required String currentVersion,  // 从 pubspec 或 package_info_plus 获取
  required String channel,         // 从 .env.{env}.local 读取或硬编码
}) {
  final platform = _detectPlatform();
  final arch = _detectArch();

  return UpdaterService(
    config: UpdateConfig(
      baseUrl: const String.fromEnvironment(
        'FAYNOSYNC_URL',
        defaultValue: 'https://update.ttpos.com',
      ),
      appName: kAppNameMap[packageName] ?? packageName,
      currentVersion: currentVersion,
      channel: channel,
      platform: platform,
      arch: arch,
      owner: const String.fromEnvironment(
        'FAYNOSYNC_OWNER',
        defaultValue: 'admin',
      ),
    ),
  );
}

String _detectPlatform() {
  if (Platform.isAndroid) return 'android';
  if (Platform.isWindows) return 'windows';
  if (Platform.isMacOS) return 'macos';
  throw UnsupportedError('Unsupported: ${Platform.operatingSystem}');
}

String _detectArch() {
  // Dart 没有直接 API，但可以编译时注入或运行时检测
  // Android 统一 arm64，Windows 统一 amd64
  if (Platform.isAndroid) return 'arm64';
  if (Platform.isWindows) return 'amd64';
  if (Platform.isMacOS) {
    // macOS 可通过 uname -m 判断
    final result = Process.runSync('uname', ['-m']);
    return result.stdout.toString().trim() == 'x86_64' ? 'amd64' : 'arm64';
  }
  return 'amd64';
}
```

### 6.2 启动时检查更新

```dart
class _MyAppState extends State<MyApp> {
  late final UpdaterService _updater;

  @override
  void initState() {
    super.initState();
    _updater = createUpdaterService(
      packageName: 'pos',
      currentVersion: '1.2.0',  // 实际从 package_info_plus 获取
      channel: 'prod',
    );
    _checkUpdate();
  }

  Future<void> _checkUpdate() async {
    try {
      final info = await _updater.checkForUpdate();
      if (!info.updateAvailable || !mounted) return;

      if (info.critical) {
        // 强制更新 → 显示不可关闭的对话框
        _showForceUpdateDialog(info);
      } else {
        // 可选更新 → 显示可关闭的对话框
        _showOptionalUpdateDialog(info);
      }
    } catch (e) {
      // 更新检查失败不应阻塞应用正常使用
      debugPrint('Update check failed: $e');
    }
  }

  void _showForceUpdateDialog(UpdateInfo info) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => UpdateDialog(
        info: info,
        onUpdate: () => _performUpdate(info),
        dismissible: false,
      ),
    );
  }

  void _showOptionalUpdateDialog(UpdateInfo info) {
    showDialog(
      context: context,
      builder: (_) => UpdateDialog(
        info: info,
        onUpdate: () => _performUpdate(info),
        dismissible: true,
      ),
    );
  }

  Future<void> _performUpdate(UpdateInfo info) async {
    await _updater.updateNow(
      onDownloadProgress: (received, total) {
        final progress = total > 0 ? received / total : 0.0;
        // 更新进度条 UI
      },
    );
  }

  @override
  void dispose() {
    _updater.dispose();
    super.dispose();
  }
}
```

### 6.3 更新对话框 UI 组件（参考）

```dart
class UpdateDialog extends StatefulWidget {
  final UpdateInfo info;
  final VoidCallback onUpdate;
  final bool dismissible;

  const UpdateDialog({
    super.key,
    required this.info,
    required this.onUpdate,
    this.dismissible = true,
  });

  @override
  State<UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<UpdateDialog> {
  bool _downloading = false;
  double _progress = 0;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.info.critical ? '重要更新' : '发现新版本'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.info.changelog != null)
            Text(widget.info.changelog!),
          if (_downloading) ...[
            const SizedBox(height: 16),
            LinearProgressIndicator(value: _progress),
            Text('${(_progress * 100).toStringAsFixed(0)}%'),
          ],
        ],
      ),
      actions: [
        if (widget.dismissible && !_downloading)
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('稍后'),
          ),
        ElevatedButton(
          onPressed: _downloading ? null : widget.onUpdate,
          child: Text(_downloading ? '下载中...' : '立即更新'),
        ),
      ],
    );
  }
}
```

---

## 7. 平台注意事项

### Android

| 项目 | 说明 |
|------|------|
| 权限 | `REQUEST_INSTALL_PACKAGES`（AndroidManifest.xml） |
| FileProvider | Android 7+ 必须配置，否则无法通过 Intent 打开 APK |
| 存储 | 下载到 `getTemporaryDirectory()`，无需额外权限 |
| 后台下载 | 考虑用 `flutter_downloader` 或前台 Service 处理大文件 |

### Windows

| 项目 | 说明 |
|------|------|
| UAC | Inno Setup `/SILENT` 会触发 UAC 提示，无法绕过 |
| 自更新 | 安装器的 `/CLOSEAPPLICATIONS` 会关闭当前实例再安装 |
| 路径 | 下载到 `getTemporaryDirectory()`（即 `%TEMP%`） |

### macOS

| 项目 | 说明 |
|------|------|
| Sandbox | 如果应用是沙箱的，`hdiutil` 和 `cp` 到 `/Applications` 需要特殊处理 |
| 权限 | DMG 安装到 `/Applications` 可能需要 admin 权限 |
| 自重启 | 安装后通过 `open /Applications/XXX.app` 重新启动 |
| 已公证 | 已通过 notarytool 公证的 DMG，用户打开时不会弹 Gatekeeper 警告 |

---

## 8. 环境变量 / 编译时注入

可以通过 `--dart-define` 注入配置，避免硬编码：

```bash
flutter run \
  --dart-define=FAYNOSYNC_URL=https://update.ttpos.com \
  --dart-define=FAYNOSYNC_OWNER=admin \
  --dart-define=APP_CHANNEL=prod
```

在构建脚本中，这些值可以从 `.env.{env}.local` 中读取后传入。

---

## 9. 测试策略

### 单元测试

- `FaynoSyncClient` — mock HTTP 响应，验证 URL 拼接、JSON 解析、异常处理
- `VersionComparator` — 语义化版本比较边界 case
- `UpdaterService` — mock client + downloader + installer，验证流程编排

### 集成测试

```bash
# 用本地 FaynoSync 实例（docker compose up -d）
# 上传一个测试版本
curl -X POST http://localhost:9000/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-app-1.0.0.apk" \
  -F 'data={"app_name":"TTPOS","version":"1.0.0","channel":"test","publish":true,"platform":"android","arch":"arm64"}'

# 验证 checkVersion
curl "http://localhost:9000/checkVersion?app_name=TTPOS&version=0.9.0&channel=test&platform=android&arch=arm64&owner=admin"
# → {"update_available":true,"update_url_apk":"...","critical":false,...}
```

---

## 10. 注意事项

1. **版本号格式**：FaynoSync 内部做语义化版本比较，确保上传时的 version 和客户端传入的 version 格式一致（如 `1.2.0`，不带 `v` 前缀）
2. **owner 参数**：这是 FaynoSync 的管理员用户名，不是终端用户名；所有客户端共用同一个 owner
3. **错误容忍**：更新检查失败绝不应阻塞应用正常启动和使用
4. **下载断点续传**：初期可不实现，后续可加 `Range` 头支持
5. **MinIO 外网**：`checkVersion` 返回的 `update_url_*` 指向 MinIO 公网地址（或 Nginx 代理后的地址），需确保客户端可达
6. **中间版本**：若 `is_intermediate_required == true`，需要引导用户先安装中间版本，适用于包含数据库迁移等不可跳跃的更新

---

## 11. 相关资源

- [FaynoSync API 文档](https://faynosync.com/docs/api)
- [FaynoSync Updaters 说明](https://faynosync.com/docs/updaters)
- [FaynoSync Postman Collection](https://github.com/ku9nov/faynoSync/blob/main/examples/faynoSync.postman_collection.json)
- [ttpos-artifacts / faynosync / README.md](../faynosync/README.md) — 服务端部署与初始化配置
