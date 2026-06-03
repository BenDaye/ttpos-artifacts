# Changelog

本文件记录 dashboard-next（ZEHub Dashboard）自身的版本变更，遵循
[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与
[语义化版本](https://semver.org/lang/zh-CN/)。

版本号以 `apps/web/package.json` 为单一事实来源，并与根 `package.json` 保持同步；
发布请使用 `bun run version:patch|minor|major`（见根 `package.json` 脚本），脚本会同步两处版本号、
归档本文件的 Unreleased 段，并打印建议的 commit / tag 命令（不会自动提交或打标签）。

> 说明：`docs/changelog.md` 是整个仓库按日期记录的产品级流水账；本文件只聚焦 dashboard-next
> 自身、由 semver 驱动的版本历史，两者用途不同、并行维护。

## [Unreleased]

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
