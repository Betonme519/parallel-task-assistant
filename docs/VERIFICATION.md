# 验证说明

## 可复现检查

在安装依赖后的项目根目录执行：

```powershell
npm run check
npm test
npm run test:e2e
npm run check:privacy
```

| 范围 | 测试入口 | 验证内容 |
| --- | --- | --- |
| 任务模型 | `tests/model.test.cjs` | 输入限制、创建与记录、归档恢复、状态验证、显示器几何 |
| 流程模型 | `tests/workflow.test.cjs` | 当前阶段、逐步推进、最终完成、步骤标识与旧数据兼容 |
| 数据存储 | `tests/store.test.cjs` | 重启恢复、连续写入、撤销、写入失败、损坏恢复、非法导入 |
| AI | `tests/ai.test.cjs` | 建议标签、歧义、格式错误、无密钥不请求、有限重试、认证失败 |
| 当前界面 | `tests/simple-flow-ui.cjs` | 表单、语音按钮焦点、创建编辑、增加步骤、推进阶段、保留历史 |

源码发布准备期间已执行 38 项单元测试，并验证过源码及干净便携版的当前界面测试。这是当时的验证记录；修改代码后应重新执行命令，不应视为持续集成服务实时给出的状态。

`npm run check` 是 JavaScript 语法检查，不是完整 lint 或 TypeScript 类型检查。隐私扫描是启发式检查，不检查图像内容或完整 Git 历史。

## 桌面测试

`npm run test:e2e` 会启动真实 Electron 窗口，需要可用的图形桌面。数据位于隔离的 `work/` 目录，不使用正式任务工作区。

打包完成后，可验证便携版：

```powershell
$env:FLOWLINE_PACKAGED='1'
try { npm run test:e2e } finally { Remove-Item Env:FLOWLINE_PACKAGED }
```

其他桌面测试文件包含早期界面场景或专项实验，不全部作为当前回归入口；遇到旧选择器时，应以当前界面核对后维护测试。

## 尚需人工验证

- 不同 Windows 设备、显示缩放及物理多屏组合。
- 真实麦克风的听写效果和系统权限差异。
- 当前 AI 服务可用性、真实截图的识别质量与歧义表现。
- 文件管理器原生拖放、系统边缘交互和长期使用体验。

公开宣传素材使用虚构任务。AI 合成的桌面展示与原始软件截图分别说明，不把概念素材当作功能测试证据。
