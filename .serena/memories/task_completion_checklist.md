# Task Completion Checklist

当完成一个修改任务后，应执行以下检查：

## 1. YAML 语法检查
- [ ] 确保 YAML 缩进正确（2 空格）
- [ ] 确保所有字符串引号配对正确
- [ ] 确保环境变量引用语法正确 (`${{ secrets.XXX }}`)

## 2. 一致性检查
- [ ] 所有矩阵策略保持 `fail-fast: false`
- [ ] `should_run` 模式完整保留
- [ ] 环境后缀映射逻辑一致 (`dev→development`, `test→test`, `prod→production`)
- [ ] macOS YAML anchor (`&mac_steps` / `*mac_steps`) 关系未被破坏
- [ ] 测试 URL 选项和 SCP 路径在相关字段间保持同步

## 3. 中文 UI 标签
- [ ] 新增的步骤名称和描述使用中文
- [ ] input 的 description 使用中文

## 4. Git 操作
- [ ] `git diff` 确认修改范围正确
- [ ] 提交信息简洁明了

## 5. 注意事项
- 本项目没有本地构建/测试命令，所有执行发生在 GitHub Actions runners 上
- 修改后需要推送到仓库并在 GitHub Actions 上验证