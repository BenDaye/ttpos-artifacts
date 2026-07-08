# Changelog

本文件记录 Dashboard（`apps/web`，ZEHub Dashboard）自身的版本变更，遵循
[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与
[语义化版本](https://semver.org/lang/zh-CN/)。

版本号以 `apps/web/package.json` 为单一事实来源（根 `package.json` 不参与版本，恒为 0.0.0）；
发布请使用 `bun run version:patch|minor|major -- --app web`（见根 `package.json` 脚本），脚本会
bump 版本号、归档本文件的 Unreleased 段，并打印建议的 commit / tag 命令（不会自动提交或打标签），
发版 tag 为 `web-v<version>`。

> 说明：`docs/changelog.md` 是整个仓库按日期记录的产品级流水账；本文件只聚焦 Dashboard
> 自身、由 semver 驱动的版本历史，两者用途不同、并行维护。

## [Unreleased]

## [0.2.15] - 2026-07-08

## [0.2.14] - 2026-07-08

## [0.2.13] - 2026-07-07

## [0.2.12] - 2026-07-07

### Fixed

- Board 视图版本卡加 `shrink-0`：修复版本多的列（如 53 / 66 个版本）版本卡被 flex 压扁、内容被 `Card` 自带 `overflow-hidden` 裁切、呈压扁 / 发灰截断的问题。根因是版本卡作为 `flex-col` 滚动容器子项缺 `shrink-0`，叠加 `overflow-hidden` 使 `min-height:auto` 失效为 0；补 `shrink-0` 后卡片保持自然高度、超出改由滚动区滚动。并给 e2e board 用例补卡片最小高度断言（原测试只查滚动区能滚、抓不到压扁）

## [0.2.11] - 2026-07-07

### Fixed

- 弹窗滚动区改为集中式四周留白（`.dialog-scroll-area` 统一 `margin: -16px` + `padding: 16px`）：根因是 `overflow` 容器把后代 box-shadow（`:focus-visible` 光晕）裁在自身 padding box，四条边都会裁、内容不滚动也裁。裁剪框整体外扩到弹窗内边距边缘后，输入框聚焦光晕四周完整；四个弹窗调用点收敛为纯类名，替代 0.2.10 的逐边 inline 补丁

## [0.2.10] - 2026-07-07

### Fixed

- 弹窗滚动区（表单 / 版本详情 / changelog / 下载列表）加 `-mx-4 px-4`：修复输入框聚焦光晕左右两侧被 `overflow-y-auto` 裁平的问题，裁剪边界外扩到弹窗内边距边缘、内容视觉位置不变

## [0.2.9] - 2026-07-07

### Fixed

- 全局 `* { border-color }` 规则包进 `@layer base`（官方 base-nova 写法）：此前未分层规则静默覆盖全应用 border 颜色工具类，导致输入框聚焦时 `border-ring` 失效、光晕反比边框深的"反转浮雕"观感；修复后校验红框、徽章描边等一并恢复设计色
- 看板列版本滚动区追加 `py-2`，首尾版本卡的 ring/光晕不再被滚动容器裁剪

## [0.2.8] - 2026-07-06

### Fixed

- 交互卡片焦点态改用 base-nova 官方配方（1px `outline-ring` 细边 + 3px `ring-ring/50` 光晕）：修复键盘关闭版本详情弹窗后，焦点回落卡片时残留 2px 实心灰环、状似边框损坏的问题；7 个文件 11 处手写焦点环统一对齐 button/input/tabs

## [0.2.7] - 2026-07-06

### Fixed

- 调用点适配新版 Card 自带 padding 契约,消除叠加留白:版本卡片(board)改 `size="sm"` 均匀 12px,应用卡片与平台/架构/渠道/Tokens/Users 行卡片用默认 16px,应用详情面板均匀 24px,列表表格容器 Card 改 `py-0` 全出血

## [0.2.6] - 2026-07-06

### Fixed

- 主题变量重同步为 shadcn 官方 neutral cssVarsV4（OKLCH）：修复输入框 focus 黑色双层粗框、版本卡片回焦黑色粗 ring；`--radius` 跟随官方默认 0.625rem
- 版本卡片选中态/hover 适配新版 Card 的 ring 体系（`border-primary` → `ring-primary` 等），恢复选中描边

## [0.2.5] - 2026-07-06

## [0.2.4] - 2026-07-06

## [0.2.3] - 2026-07-05

### Changed

- 镜像构建改用 `turbo prune` 剪枝上下文（无功能变化）：Dockerfile 不再手工维护 workspace 成员 COPY 清单，新增成员自动纳入。

## [0.2.2] - 2026-06-28

### Fixed

- 看板视图：版本卡在按版本号排序的基础上，新增按 channel 列表顺序的二级排序，使同版本号下不同渠道的卡片排列稳定可预期。

## [0.2.1] - 2026-06-03

### Changed

- 内部清理全部 eslint 告警（`set-state-in-effect` / `no-array-index-key` / FormControl `cloneElement` 等）：刻意的弹窗 prop-sync 与 shadcn 标准模式以注释抑制，加载骨架改用稳定 key，零功能与行为变化。

## [0.2.0] - 2026-06-03

### Added

- 引入语义警示色（status color）：错误 / 危险态（表单校验、`aria-invalid` 输入框、删除等破坏性按钮）改用低饱和警示红，与品牌单蓝区分；正常交互元素仍保持单蓝。
- 统一错误态组件 `ErrorState`：加载失败时展示告警图标 + 重试入口，明确区别于「暂无数据」空态，覆盖应用 / 平台 / 渠道 / 架构 / 统计 / 令牌 / 用户等页面。
- 密码输入组件 `PasswordInput`：支持明文切换，应用于登录、注册、成员与管理员凭据表单。
- 组件化 `Tooltip` 原语（基于 Base UI），并为截断文本补全提示。

### Changed

- 删除 / 危险操作按钮与表单校验错误文字由品牌蓝改为语义警示红，提升可辨识度。
- 看板视图：被打开详情的版本卡新增选中高亮（单蓝描边 + `aria-current`）。
- 列表视图修正可访问性角色（行改为 button 语义），可点卡片 / 行补充按下反馈。

### Fixed

- 修复长表单弹窗内容超出视口时顶部字段无法触达的问题（表单弹窗正文统一加滚动区）。
- 修复长标题被弹窗右上角关闭按钮遮挡。
- 提交进行中锁定弹窗关闭，避免请求中途关闭导致状态错乱（含新建令牌时 token 丢失）。
- 表单校验文案、关闭按钮 `aria-label`、changelog 占位符等补齐 i18n，不再泄漏英文默认文案。
- 加载骨架按当前视图（卡片 / 列表 / 看板）匹配形态，减少切换时的布局抖动。

## [0.1.2] - 2026-06-03

### Fixed

- 修复在详情弹层中执行新增 / 删除 / 编辑等写操作后，仍打开的弹层未即时刷新、需关闭重开才能看到最新数据的问题。
  选中项改为按稳定 id 从最新查询数据派生，写操作完成后弹层内容随之即时更新。

## [0.1.1] - 2026-06-02

### Added

- 侧边栏底部常驻展示 Dashboard 自身版本号，hover 显示完整的版本 · git commit · 构建时间。
- 构建时经 Vite `define` 注入版本元数据（`__APP_VERSION__` / `__GIT_COMMIT__` / `__BUILD_TIME__`），
  容器构建的 git commit 由 CI 经 `GIT_COMMIT` build-arg 传入。
- 新增 `version:patch|minor|major` 发布脚本，统一 bump 版本号并归档 changelog。

### Fixed

- 修复删除单个 artifact 的可靠性：改为按 artifact 的稳定标识（下载链接）删除，避免列表加载与点击删除之间发生变化时误删其他文件；删除失败或无匹配时正确提示错误，不再误报删除成功。

## [0.1.0]

### Added

- Dashboard Next 初始版本基线。
