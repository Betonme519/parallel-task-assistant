# 工具脚本

| 脚本 | 用途 |
| --- | --- |
| `check.cjs` | JavaScript 语法检查 |
| `privacy-check.cjs` | Git 发布候选文件的启发式隐私扫描 |
| `package.cjs` | 生成不含个人数据的独立便携版 |
| `export-source.cjs` | 从 Git 工作区导出未被忽略的源码文件 |

扫描与导出需要 Git 工作区。打包及导出拒绝覆盖已有输出，避免覆盖正在使用的目录。
