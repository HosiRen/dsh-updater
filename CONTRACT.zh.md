---
description: "在设置页把当前运行的 DeepSeek Harness 代码检出与上游仓库同步，并重装依赖、重新构建。"
kind: "package-reference"
---

# @local/dsh-updater

[English](CONTRACT.md) | 中文

安装方式与简要说明见 [README.zh.md](README.zh.md)。

## 概要

插件在设置页新增一个独立页面，把当前运行的 DeepSeek Harness 代码检出与上游仓库保持一致：报告本地与上游的修订号，按配置的频率探测远端，并执行完整更新——快进代码检出、重装依赖、重建宿主库与 Web 前端——同时把完整输出保留在磁盘上。

更新耗时且具破坏性，因此插件遵循三条约束：脏工作区直接拒绝并列出未提交文件；只用 `git merge --ff-only`，分支分叉即停止；任一步失败都回滚到起始提交，并保留失败阶段、退出码与完整日志。

更新本身在分离子进程中执行，关闭页面、重载宿主或重启 Harness 都不会中断它。页面读取状态文件来显示进度。

## 目录

- [使用本包](#使用本包)
- [理解实现](#理解实现)
- [进一步探索](#进一步探索)
- [模型体验](#模型体验)
- [已知限制与后续工作](#已知限制与后续工作)

<a id="使用本包"></a>
## 使用本包

把该目录作为 profile bundle 安装。插件是双面包，一行即挂载两个半边。

```
plugin_manager { action: "install_bundle", target: "/abs/path/to/user-plugin/dsh-updater" }
```

`cordis.patch.yml` 插入的行 id 为 `dsh-updater`。它的浏览器半边注册一个 `settings.section` 条目，导航标签为**更新**，排在内置分区之后。

### 页面做什么

- **检查更新**：用 `git ls-remote` 探测配置的分支。只读，不写入 `.git`，不触碰任何工作区文件。
- **立即更新**：拒绝脏工作区，记录当前提交，然后在分离子进程中依次执行 `git fetch` → `git merge --ff-only` → `pnpm install` → 配置的构建。
- **回滚**：把代码检出退回上次运行前记录的提交并重装依赖。只要存在运行记录就会提供。
- **更新方式**：`remoteTransport` 决定拉取走哪个协议。`origin` 按 remote 名称拉取，即 git 自身行为；`https` 与 `ssh` 从该 remote 的地址推导出对应协议的地址，配显式 refspec 拉取。
- 频率选择器通过配置编辑器把 `autoCheck` 写回 profile patch。

### 配置

每个字段都是 `dsh-updater` 行的受校验 Config 字段，可在 profile patch 中覆盖，无需改动本包。

| 字段 | 默认值 | 含义 |
|---|---|---|
| `repoRoot` | 运行时解析 | 显式的代码检出根目录。缺省时由运行中 profile 的安装锚点推导，因此同一份安装能在任意检出路径下工作。 |
| `remote` | `origin` | 更新读取的 git 远端。 |
| `branch` | `master` | 更新快进到的分支。 |
| `remoteTransport` | `origin` | 拉取协议。`origin` 按 remote 名称拉取；`https`、`ssh` 把 remote 地址改写为对应协议后以其为 fetch 源，并保持 remote-tracking ref 仍是 `<remote>/<branch>`，因此后续快进合并不受影响。 |
| `build` | `full` | `full` 执行 `pnpm run build`（宿主库、浏览器产物、Web 前端、native 系统二进制）。`lib-web` 依次执行 `build:lib` 与 `build:web`，跳过 native 插件。 |
| `autoCheck` | `startup` | `startup`、`daily`、`weekly`、`monthly` 或 `never`。 |
| `pnpmCommand` | `pnpm` | 安装与构建步骤使用的包管理器。 |
| `timeoutMs` | `1200000` | 单条流水线命令的上限。 |
| `probeTimeoutMs` | `60000` | 单次远端探测的上限。链路到达远端较慢时调大。 |
| `logTailBytes` | `65536` | 返回给页面的运行日志字节数。 |
| `maxDirtyFiles` | `50` | 代码检出为脏时列出的工作区路径数。 |

### 安装到别处

本目录是该包的可发布形态：`lib/`、`locale/`、`icon.svg`、`cordis.patch.yml` 与文档。这里无需构建，且本包没有声明 `prepare` 脚本，因此 git 安装直接使用已提交的 `lib/`。

把本目录作为独立仓库推送后，按 spec 安装：

```
plugin_manager { action: "install_bundle", target: "github:<所有者>/<仓库>" }
```

指向本地副本的绝对路径同样可行。本插件刻意不属于 Harness 仓库的 workspace，也不受该仓库的 git 跟踪；`user-plugin/` 被列入它的 `.git/info/exclude`，这正是上游快进能保持干净、同时插件又居住在被它更新的那份检出里的原因。

源码树（`src/`、`tests/` 以及 tsdown、vitest、tsconfig 各文件）存放在本目录之外。开发在那里进行：`pnpm exec tsdown && pnpm exec tsc -p tsconfig.build.json` 重新发布 `lib/`，再把产物同步回本目录。

<a id="理解实现"></a>
## 理解实现

<details>
<summary>实现内部——点击展开</summary>

**代码检出解析。** `resolve-install.ts` 从 `profileContext.installAnchor`（安装内的 `dsh` 应用清单）出发，向上查找最近的、`package.json` 声明 `@deepseek-ai/dsh-root` 的祖先目录，并要求 `<root>/.git` 存在。用逐级查找而非固定层数，是为了同时覆盖两种布局：源码检出锚定在 `<root>/apps/cli/package.json`，打包安装锚定在 `<root>/runtime/package.json`。`Config.repoRoot` 覆盖整套推导。解析失败会呈现为带确切原因的不可用页面，插件不做猜测。

**状态。** `$DSH_HOME/updater/` 存放 `state.json`（当前运行）、`check.json`（上次探测）、`logs/<runId>.log` 与 `run.lock`。探测历史落在文件而非存储域，是因为该记录必须能被分离子进程与跨宿主代际读取，而本包位于 pnpm workspace 之外，无法从检出的顶层 `node_modules` 解析 Harness 存储服务或 `zod`。插件运行时不 import 任何第一方包。

**探测。** `git ls-remote <source> refs/heads/<branch>` 是宿主按自身节奏执行的唯一网络操作，其中 `<source>` 由 `fetch-target.ts` 从 `remoteTransport` 与 remote 地址推导：`origin` 得到 remote 名称，`https`、`ssh` 得到改写后的地址。结果作为 `CheckResult` 存为运行状态旁的 `check.json`，并提供 daily、weekly、monthly 频率所比较的 `lastCheckedAt`。

**传输。** `transport.ts` 解析 remote 地址（`https://`、`ssh://`、`git@host:path` 三种写法）得到主机与仓库路径，再按所选协议重新拼装；本机路径没有主机可改写，返回 `undefined`，此时 `resolveFetchTarget` 退回按 remote 名称拉取，并把缺失的 `resolvedUrl` 交给页面显示为回退提示。改写只影响本次 fetch 的参数，仓库自身的 `remote.origin.url` 始终不变；显式 refspec `+refs/heads/<branch>:refs/remotes/<remote>/<branch>` 保证 `FETCH_HEAD` 之外，快进合并读取的 remote-tracking ref 同样被更新。

**运行更新。** `runner.ts` 获取锁文件，记录起始提交与 `preflight` 运行状态，并以分离方式启动 `lib/update-runner.js`，把运行日志作为其 stdio 目标。子进程逐阶段推进状态文件（`fetching`、`merging`、`installing`、`building`），随后进入 `done` 或 `failed`。状态文件是唯一真源，父进程只读取它，因此运行中途重启宿主不会丢失进度。

**失败与回滚。** 任一步失败时，子进程先记录失败阶段、退出码与受限的 stderr 尾部，再执行 `git reset --hard <beforeSha>` 并重装依赖，最后记录 `rolled-back`。原始失败在回滚后依然保留：回滚步骤只追加日志，不替换原因。

**构建输出残留与缓存失效。** 快进合并只删除受跟踪文件，而包的 `lib/` 与 `node_modules/` 是被忽略的构建输出，于是合并删掉一个包后它们会留在磁盘上，下一次构建仍把该包当作存在——这是上游删除演变成「找不到导出、而源码已无处可寻」的路径。因此合并之后、构建之前，`residue.ts` 会删除那些既无 `package.json`、又留有这两项的目录中的它们，并清除检出根目录下的 `.tsbuildinfo`。第二步不可省略：`tsc -b` 依据缓存而非文件系统判断是否重建，只删产物而不失效缓存，会把「已是最新」的判断变成一个永久的缺失，最终在打包阶段表现为 `Cannot find entry`。代价是一次全量重建，而这条流水线本就要跑完整构建。回滚路径同样执行这两步，因为回滚恢复的源码，其产物可能已在此前的合并中被删除。

**归属。** HTTP 表面与无人值守探测都注册在 `ctx.effect` 内，因此禁用该行会移除路由并中止进行中的探测。

**浏览器传输。** 两个半边经由 `/dsh-updater/*` 通信，其 handler 复用连接载体的浏览器信任栅栏。浏览器半边请求文档相对路由（`dsh-updater/status`），宿主注册绝对路由键，遵循[文档相对应用路由的决定](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/architecture/2026-09-14-web-document-relative-app-routes.md)。

</details>

## 进一步探索

- [新增 workspace 包](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md) —— 仓库自己的包清单；本包遵循其结构与文案规则，但不加入 workspace。
- [配置编辑器](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/config-editor/README.md) —— 频率选择器的写入如何抵达 profile patch。
- [HMR](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/hmr/README.md) —— 构建重写浏览器产物时重新加载它们的文件监听。

## 模型体验

无。本插件只提供设置页与宿主 HTTP 路由，不贡献系统提示文本、工具 schema 或 Session 事件。

#### KV Cache 效果

零。本插件从不构造模型请求，也不向 Session 日志追加内容，因此不可能让可复用的前缀失效。

## 已知限制与后续工作

- **只能更新 git 检出。** npm 安装的 harness 没有 `.git`，也没有受跟踪的分支，因此页面报告不可用，而不是尝试基于下载的退路。
- **应用更新需要重启。** 宿主侧代码在启动时加载，页面会说明这一点且不提供自动重启；Web 前端会自行重载，因为 webserver 对它所服务的产物做 stat 轮询。
- **运行不能在步骤边界续跑。** 若分离子进程被直接杀死，下次运行从当前提交开始；锁里记录的 pid 已消失，会被自动回收。
- **`lib-web` 跳过 native 插件。** 上游改动触及 `native/` 之后请选 `full`，否则先前构建的插件会留在原地。
- **仓库门禁不覆盖本包。** 因为它不是 workspace 成员，`pnpm run typecheck`、`lint` 与 `test:coverage` 都会跳过它；请用它自己的检查：`pnpm exec vitest run --config user-plugin/dsh-updater/vitest.config.ts` 与 `pnpm exec tsc --noEmit -p user-plugin/dsh-updater/tsconfig.json`。
