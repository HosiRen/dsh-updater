# dsh-updater

[English](README.md) | 中文

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：在设置页里，将当前运行的 DeepSeek Harness 从上游仓库同步更新。

## 安装

作为 profile bundle 安装，可用本仓库，也可用本地副本：

```
plugin_manager { action: "install_bundle", target: "github:<所有者>/dsh-updater" }
```

刷新页面，打开**设置 → 更新**。

## 功能

- **检查更新**：用 `git ls-remote` 探测配置的分支。只读，不写入 `.git`，不触碰任何工作区文件。
- **立即更新**：在分离子进程中依次执行 `git fetch` → `git merge --ff-only` → `pnpm install` → `pnpm build`。刷新页面或重启 Harness 都不会中断它。
- **回滚**：把代码检出退回上次运行前记录的提交，并重装依赖。

三条硬性约束：

- 工作区脏（有未提交改动）时拒绝更新，并列出相关文件。
- 只做快进合并，分支分叉即停止，绝不改写历史。
- 任一步失败都会回滚到起始提交，并保留失败阶段、退出码与完整日志。

更新完成后需手动重启 Harness 才会生效。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `remote` | `origin` | 更新读取的 git 远端 |
| `branch` | `master` | 更新快进到的分支 |
| `build` | `full` | `full` 执行 `pnpm run build`；`lib-web` 跳过 native 插件 |
| `autoCheck` | `startup` | `startup`、`daily`、`weekly`、`monthly` 或 `never` |
| `pnpmCommand` | `pnpm` | 安装与构建使用的包管理器 |
| `repoRoot` | 运行时解析 | 显式的代码检出根目录；默认由运行中的 profile 推导，因此同一份副本在任意路径下都能工作 |

每个字段都是 `dsh-updater` 行的普通 Cordis `Config` 字段，可在 profile patch 中覆盖，无需改动本包。页面上的频率选择器通过配置编辑器写回。

## 前置条件

- DeepSeek Harness 的 **git 检出**。npm 安装的 harness 没有 `.git`，也没有受跟踪的分支，页面会报告不可用。
- `PATH` 上有 `git`、`pnpm`，以及构建所需的工具链。

## 文档

- [CONTRACT.zh.md](CONTRACT.zh.md) —— 实现细节、落盘状态、失败与回滚语义

## 许可证

MIT

其他所涉及的开源代码披露于 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
