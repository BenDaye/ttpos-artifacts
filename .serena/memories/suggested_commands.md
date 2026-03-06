# Suggested Commands

## Important Note
This project has **no local build/test/lint commands** — all execution happens in GitHub Actions runners.

## Git Operations
```bash
git status                    # 查看工作区状态
git diff                      # 查看未暂存更改
git log --oneline -10         # 查看最近提交
git add .                     # 暂存所有更改
git commit -m "message"       # 提交更改
git push                      # 推送到远程
```

## YAML Validation (Optional)
```bash
# 如果安装了 yamllint，可以校验 YAML 语法
yamllint .github/workflows/

# 也可以使用 actionlint 校验 GitHub Actions 语法
actionlint .github/workflows/
```

## Workflow Inspection
```bash
# 查看工作流文件
ls -la .github/workflows/

# 搜索特定配置
grep -r "pattern" .github/workflows/
```

## GitHub CLI (如果需要触发工作流)
```bash
# 列出工作流
gh workflow list

# 手动触发工作流
gh workflow run build-android.yaml -f branch=main -f env=test -f package=all

# 查看运行状态
gh run list --workflow=build-android.yaml
```

## System Utils (macOS / Darwin)
```bash
ls, cd, grep, find            # 基本文件操作
rg                            # ripgrep (推荐使用)
open .                        # 在 Finder 中打开当前目录
pbcopy / pbpaste              # 剪贴板操作
```