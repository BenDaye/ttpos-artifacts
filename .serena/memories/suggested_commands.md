# Useful Commands

## YAML/Workflow Validation
```bash
yamllint .github/workflows/          # YAML 语法检查
actionlint .github/workflows/       # GitHub Actions 语法检查
```

## GitHub CLI (触发和监控工作流)
```bash
gh workflow run build-android.yaml -f branch=main -f env=test -f package=all
gh run list --workflow=build-android.yaml
gh run view <run-id> --log-failed     # 查看失败日志
```