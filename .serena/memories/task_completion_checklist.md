# Task Completion Checklist

修改 workflow 文件后的检查清单（补充 CLAUDE.md 未覆盖的要点）：

## YAML 语法
- [ ] 缩进正确（2 空格）
- [ ] 字符串引号配对正确
- [ ] `${{ secrets.XXX }}` 语法正确

## 新增步骤
- [ ] 步骤名称和 input description 使用中文
- [ ] 新 secret 在所有相关 workflow 中保持一致

## 验证
- [ ] `git diff` 确认修改范围
- [ ] 推送后在 GitHub Actions 上验证