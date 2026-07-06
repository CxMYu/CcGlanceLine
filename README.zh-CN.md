# ccglance

> 面向 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 的轻量多行状态栏 —— 模型、effort、上下文、缓存、git、会话,一眼尽览。TypeScript 编写、运行时零依赖。

[![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22-3c873a)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[English](./README.md) | 简体中文

仓库：[github.com/CxMYu/CcGlanceLine](https://github.com/CxMYu/CcGlanceLine)

`ccglance` 以 Claude Code 通过 stdin 传入的 JSON 为主数据源；`status`
段只在启用时读取 transcript(会话记录)尾部。它用 **TypeScript** 编写,以编译后的
JavaScript 发布,**运行时零依赖**(仅用 Node 标准库)。

## 预览

![ccglance 预览](./docs/assets/preview.png)

截图由 `ccglance preview` 生成。

## 特性

- **紧凑多行布局** —— 运行时、订阅配额、项目/会话分成逻辑行；无数据的行自动消失。
- **运行时零依赖** —— 仅用 Node 标准库;TypeScript 仅为构建期工具,不进发布包。
- **stdin 优先** —— 核心段消费 Claude Code 提供的 JSON；status 只读 transcript 尾部固定字节。
- **上下文块** —— 占用百分比、本轮输入/输出 token、剩余 token。
- **缓存块** —— 缓存命中率、读取/写入 token。
- **git 段** —— 分支、干净/脏/冲突标记、领先/落后计数；只跑一次有界 `git status`，并带短缓存。
- **会话段** —— 耗时 + 新增/删除行数。
- **Claude Code 版本 + 更新提示** —— 显示 stdin 里的 Claude Code `version`；
  本地 4 小时缓存发现新版时追加 `↑latest`。刷新在 stdout 写出后异步进行，不阻塞状态栏。
- **额外会话信息** —— 5小时/7天配额、美元成本，以及 Claude Code 提供时显示在 git 分支右侧的 worktree 名。
- **响应式多行布局** —— 读终端宽度(`COLUMNS`),把每行按能容纳的宽度自动折成多行;
  正确处理 CJK/emoji 显示宽度。
- **固定内置风格** —— 不读取用户配置文件，也不读取外部样式文件；状态栏使用 ccglance 自己的 emoji 优先风格。

## 环境要求

- Node.js **>= 22**
- `git`(可选,仅 git 段需要)

Claude Code 兼容性：

| Claude Code CLI | ccglance 行为 |
|---|---|
| >= 1.0.71 | 支持基础 statusline stdin |
| >= 2.1.80 | 官方 `rate_limits.five_hour` / `rate_limits.seven_day` 字段存在时显示订阅配额行 |
| >= 2.1.153 | 优先使用 `COLUMNS` / `LINES` 做终端宽度适配；更旧版本回退到 TTY 宽度或 80 列 |

配额行只面向订阅场景。Claude.ai Pro/Max 这类订阅会话可能提供 `rate_limits`；
API key、Bedrock、Vertex 等按量/外部网关场景通常没有该字段，ccglance 会隐藏配额行，
不会自行推断或伪造。

## 安装

### 方式 A —— npm 全局安装(推荐)

```bash
npm install -g ccglance          # npm
yarn global add ccglance         # 或 yarn
pnpm add -g ccglance             # 或 pnpm
```

registry 慢?用国内镜像:

```bash
npm install -g ccglance --registry https://registry.npmmirror.com
```

npm 会下载**预编译好的 `dist/`**(本机不跑编译器),并把 `ccglance` 命令装到 `PATH`。
需要 Node.js **>= 22**。

安装之后:

- ✅ `ccglance` 命令全局可用。
- ⚙️ **只装不会自动生效** —— 必须把 `statusLine` 块加进 `~/.claude/settings.json`
  (见 [配置](#配置)),然后重启 Claude Code。
- 🔎 用 `ccglance preview`(样例渲染)或 `ccglance --help`(用法 + 完整 settings.json
  配置)验证。在普通终端直接敲 `ccglance` 只会打印这份帮助。

后续可用 `npm update -g ccglance` 更新、`npm uninstall -g ccglance` 卸载。

### 方式 B —— 从源码构建

```bash
git clone https://github.com/CxMYu/CcGlanceLine.git
cd CcGlanceLine
npm install             # 安装 devDeps；随后 prepare 脚本自动编译 src/ → dist/
npm link                # 可选：把 ccglance 链到本机 PATH
```

`npm install` 已经通过 `prepare` 生命周期脚本帮你构建好 `dist/`,**无需再单独跑构建**。
编译产物入口为 `dist/cli.js`;`ccglance` bin 命令和 `node dist/cli.js` 是同一个文件。验证:

```bash
node dist/cli.js preview
```

## 配置

在 `~/.claude/settings.json` 加入 `statusLine`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "ccglance",
    "padding": 0
  }
}
```

若未全局安装,直接用 Node 指向编译后的文件:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /绝对路径/ccglance/dist/cli.js"
  }
}
```

Windows 用完整路径,例如 `node D:\\path\\to\\ccglance\\dist\\cli.js`。

> **跨平台路径**:Claude Code v2.1.47+ 会在所有平台展开命令开头的 `~`,所以
> `node ~/path/to/dist/cli.js` 也能用。优先用 `~` 而非 `%USERPROFILE%`(近版本不可靠);
> 全局的 `ccglance` 命令则完全不需要写路径。`"padding": 0` 去掉 Claude Code 默认的左侧缩进,
> 让状态栏从最左开始。

## 字段说明

**第一行 —— 运行时**

| 标识 | 段 | 来源 | 展示 |
|---|---|---|---|
| 🤖 | 模型 | `model.display_name`，缺失时回退 `model.id` | stdin display name 只做轻量压缩(`Opus 4.8 1M`)；缺失时用可读 id 兜底 |
| 🧠 | effort | `effort.level` | 推理强度 |
| ✅/⏸️/💭/⚙️/🔧 | 状态 | transcript 尾部 | 仅图标显示状态；工具运行时显示工具名 |
| 🚀 | fast | `fast_mode` | 仅 fast 模式开启时显示 |
| ⚡️ | 上下文 | `context_window` | 占比 · 输入 · 输出 · 剩余 |
| 💾 | 缓存 | `context_window.current_usage` | 命中率 · 缓存读取 · 缓存写入 |
| 🎯 | 输出风格 | `output_style.name` | 当前 output style |

**第二行 —— 订阅 / 配额**

| 标识 | 段 | 来源 | 展示 |
|---|---|---|---|
| 📊 | 配额 | `rate_limits.five_hour` / `rate_limits.seven_day` | Hour / Week 紧凑月相仪表，各自带百分比和重置时间；Claude Code 当前没有月配额窗口 |

**第三行 —— 项目 / 会话**

| 图标 | 段 | 来源 | 展示 |
|---|---|---|---|
| 📁 | 目录 | `workspace.current_dir` | 当前目录名 |
| 🌿 / 🌲 | git + worktree | stdin + 本地 `git` | 分支 + 状态标记：`✓` 干净、`●` 有未提交变更、`⚠` 有冲突；另含 `↑领先` `↓落后`；`worktree.name` 追加在分支状态右侧 |
| 🏷️ | 会话名 | `session_name` | 由 `--name` 或 `/rename` 设置 |
| ⏱️ | 会话 | `cost` | 耗时 + `+新增` `-删除` 行数 |
| 💰 | cost | `cost.total_cost_usd` | 美元成本，大于 0 时显示 |
| 💩 | 版本 | `version` | Claude Code 版本；4 小时缓存发现新版时追加 `↑latest` |

配额月相映射：

| 占用 | 图标 |
|---|---|
| 0% <= 占用 < 10% | 🌑 |
| 10% <= 占用 < 30% | 🌒 |
| 30% <= 占用 < 60% | 🌓 |
| 60% <= 占用 < 90% | 🌔 |
| 90% <= 占用 <= 100% | 🌕 |

## 图标说明

| 图标 | 含义 |
|---|---|
| 🤖 | 模型名；以 `model.display_name` 为准，缺失时用可读 `model.id` 兜底 |
| 🧠 | 推理强度 |
| ✅ | 空闲；最近一轮 assistant 输出已完成 |
| ⏸️ | 暂停；正在执行的动作被用户中断或取消 |
| 💭 | 思考中；等待或正在接收模型输出 |
| ⚙️ | 处理中；工具结果已返回，Claude 正在继续处理 |
| 🔧 | 工具调用中；可用时会显示工具名 |
| 🚀 | fast mode |
| ⚡️ | 上下文窗口占用 |
| 💾 | prompt cache 使用情况 |
| 🎯 | output style |
| 📊 | Hour / Week 订阅配额 |
| 🌑 🌒 🌓 🌔 🌕 | 配额占用档位 |
| ⏳ | 距离当前配额窗口重置的时间 |
| 📁 | 当前目录 |
| 🌿 | git 分支 |
| ✓ ● ⚠ | git 干净 / 有未提交变更 / 有冲突 |
| 🌲 | worktree 名，显示在 git 段内 |
| 🏷️ | 会话名 |
| ⏱️ | 会话耗时 |
| 💰 | 会话成本 |
| 💩 | Claude Code 版本 |
| ↑latest | 检测到更新的 Claude Code 版本 |

## 颜色语义

| 颜色 | 含义 |
|---|---|
| 亮绿 | 空闲/健康状态、fast、缓存、新增、git 干净标记、git 领先/outgoing/push 计数 |
| 黄色 | 需要注意：暂停状态、effort、配额重置时间、成本、警戒阈值 |
| 亮红 | 风险或负向：危险阈值、冲突、删除、版本更新提示 |
| 蓝色 | Git modified/dirty 状态、落后/incoming/pull 计数 |
| 青色 / 白色 | 中性运行与项目信息：模型、输出风格、会话耗时、git 分支 |
| 品红 | 当前上下文与会话身份：上下文窗口、会话名 |

status 图标来自 transcript 尾部推断，只代表 Claude Code 触发 statusline 刷新时的近似状态，不是实时事件流。
如果正在执行时按 Esc 取消，ccglance 会在 Claude Code 下一次重绘 statusline 时更新；transcript 里的中断标记会显示为暂停。

## 原理

每次刷新时,Claude Code 会运行你配置的 `command`,并把一段 JSON(模型、effort、
上下文窗口、cost、workspace、版本……)从 **stdin** 传入。`ccglance` 用
`fs.readFileSync(0)` 一次性读入、按固定行格式化并**先打印**；`status`
只会读取 transcript 尾部固定字节。版本段同步阶段只读本地小缓存；stdout 写出之后，如果
Claude Code 最新版缓存超过 4 小时，才 detached 后台刷新 npm registry。若 JSON 解析失败则
静默退出,绝不影响 CLI。来自 stdin、transcript、git 的文本在输出前会清理终端控制序列，
避免逃逸到状态栏之外。主要外部调用是本地 `git`(单次有界 status 调用并带短缓存)、按需
transcript 尾部读取，以及渲染后的后台版本检查。

## 开发

### 源码构建

```bash
git clone https://github.com/CxMYu/CcGlanceLine.git
cd CcGlanceLine
npm install              # 安装 devDeps，并执行 prepare -> build

npm run build            # 编译 src/ → dist/
npm run typecheck        # tsc --noEmit(strict)
npm test                 # 构建 + node:test fixtures/snapshots/smoke
npm run benchmark        # 构建 + 启动耗时基准
ccglance preview         # 预览全局/软链命令

# 用样例 stdin 冒烟测试:
printf '%s' '{"model":{"display_name":"Claude Opus 4.8 (1M context)","id":"claude-opus-4-8[1m]"}}' | node dist/cli.js
```

本地试用建议构建后执行 `npm link`，然后在 Claude Code 里配置 `"command": "ccglance"`。不做全局链接时，直接配置 `node /绝对路径/ccglance/dist/cli.js`。

### 验证

- `test/fixtures/` 放订阅、API 风格、字段缺失、高上下文占用等 stdin 样例。
- `test/snapshots/` 固定 ANSI 彩色渲染结果，图标、间距、颜色、换行变化都必须是有意修改。
- `test/*.test.js` 使用 Node 内置 `node:test`，不额外引入运行时测试框架。
- `bench/latency.js` 会同时测空 Node 基线、无 git、订阅+transcript、git warm cache、
  git cold fallback。Windows 上空 Node 冷启动通常占大头，判断 ccglance 成本时应看相对基线的增量。

### Agent 构建范式

- `src/` 是唯一源码；不要手改 `dist/`，用 `npm run build` 重新生成。
- 保持固定内置风格：不要加用户配置读取、外部样式文件、运行时样式发现。
- 保持运行时零依赖；新增依赖只能是构建期依赖，并说明必要性。
- 改代码后执行 `npm run typecheck`、`npm run build`、`ccglance preview`。
- 修改图标或间距时，检查去掉 ANSI 后的 preview，并用至少一个合成 stdin 覆盖被改的 segment。

### 代码结构

```text
src/
  cli.ts              # 命令入口：preview / statusLine stdin
  defaults/           # 固定内置风格与显示顺序
  readers/            # stdin、transcript 尾读、终端宽度
  render/             # 颜色、图标、布局、最终渲染
  segments/           # 每个显示项的渲染逻辑
  runtime/            # git、Claude Code 版本缓存等运行时能力
  types/              # Claude Code stdin 与渲染类型
  utils/              # 格式化、显示宽度计算
test/
  fixtures/           # 代表性的 Claude Code stdin 和 transcript 数据
  snapshots/          # 固定渲染输出基准
bench/
  latency.js          # 启动耗时与缓存路径基准
```

发布到 npm 的只有编译后的 `dist/`；`npm run build` 会先清空 `dist` 再编译，避免旧平铺产物混入包里。

## 缓存文件

`ccglance` 只落盘可丢弃的运行缓存：git 状态、transcript 派生状态、Claude Code 最新版本缓存。
文件按 `git/`、`transcript/`、`version/` 分组。

所有平台都统一落在 Claude Code 自己的配置目录下,随 Claude 配置一起走、清理也方便:

```text
~/.claude/ccglance/
├── git/          # git 状态快照(每个仓库一个)
├── transcript/   # transcript 派生的会话状态
└── version/      # Claude Code 最新版本检查
```

若设置了 `CLAUDE_CONFIG_DIR` 改变 Claude Code 配置目录,ccglance 的缓存会跟着落到该目录下。
整个 `ccglance/` 目录随时可安全删除 —— 下次渲染会自动重建。

git 缓存逻辑：

- 缓存 key 使用 Git worktree 根目录，同一仓库里的多个 Claude Code 终端共享一份 git 缓存。
- 分支名优先使用 Claude Code stdin 里的 `worktree.branch`；没有该字段时，每次渲染都会从
  `.git/HEAD` 快速读取，所以普通切换分支也会立即显示。
- dirty/冲突和 ahead/behind 细节使用缓存；20 分钟内且仍属于当前分支的缓存会直接返回。
- 本地状态(`✓` / `●` / `⚠`)和上游状态(`↑领先` / `↓落后`)来自同一次
  `git status --porcelain=v2 --branch` 缓存快照，所以 TTL 相同。如果本地和远程状态同时存在，
  会一起显示，例如 `main ● ↑1 ↓1`。
- 缓存过期、无缓存或分支变化时仍立即渲染：用 `.git/HEAD` 快速只显示分支，再后台刷新 `git status`。
- 刷新使用独占 `.refresh` 标记，写入使用临时文件 rename，多个终端并发不会写坏缓存。
- 没有心跳，也没有常驻 watcher。刷新是懒触发：Claude Code 重绘 statusline 时启动 ccglance，
  ccglance 检查缓存年龄，只有过期时才启动 detached 后台刷新进程。

## 相关项目

- [CCometixLine](https://github.com/Haleclipse/CCometixLine) —— Rust 编写的高性能状态栏,带交互式 TUI 配置与主题
- [ccstatusline](https://github.com/sirmalloc/ccstatusline) —— 可配置、支持 powerline 风格的状态栏
- [claude-powerline](https://github.com/Owloops/claude-powerline) —— 轻量的 powerline 风格状态栏

## 贡献

欢迎提 issue 和 PR。改代码前请先跑 `npm run typecheck`、`npm run build`、`ccglance preview`;
请保持**运行时零依赖**和固定风格(不加配置加载器)。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=CxMYu/CcGlanceLine&type=Date)](https://star-history.com/#CxMYu/CcGlanceLine&Date)

## 许可

[MIT](./LICENSE) © 2026 CxMYu
