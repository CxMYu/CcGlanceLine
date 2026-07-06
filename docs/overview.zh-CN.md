# 概览

ccglance 展示什么、有哪些特性、环境要求、工作原理,以及缓存落在哪里。

[← 返回 README](../README.zh-CN.md)

## 状态栏速览

三个逻辑行,任意一行无数据时自动消失:

1. **运行时** —— 🤖 模型 · 🧠 effort · 状态 · 🚀 fast · ⚡️ 上下文 · 💾 缓存 · 🎯 风格
2. **配额**(仅订阅会话)—— 📊 Hour / Week 配额仪表
3. **项目 / 会话** —— 📁 目录 · 🌿 git · 🏷️ 会话名 · ⏱️ 会话 · 💰 成本 · 💩 版本

完整字段 / 图标 / 颜色参考:[segments.zh-CN.md](./segments.zh-CN.md)。

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

## 原理

每次刷新时,Claude Code 会运行你配置的 `command`,并把一段 JSON(模型、effort、
上下文窗口、cost、workspace、版本……)从 **stdin** 传入。`ccglance` 用
`fs.readFileSync(0)` 一次性读入、按固定行格式化并**先打印**；`status`
只会读取 transcript 尾部固定字节。版本段同步阶段只读本地小缓存；stdout 写出之后，如果
Claude Code 最新版缓存超过 4 小时，才 detached 后台刷新 npm registry。若 JSON 解析失败则
静默退出,绝不影响 CLI。来自 stdin、transcript、git 的文本在输出前会清理终端控制序列，
避免逃逸到状态栏之外。主要外部调用是本地 `git`(单次有界 status 调用并带短缓存)、按需
transcript 尾部读取，以及渲染后的后台版本检查。

## 缓存文件

`ccglance` 只落盘可丢弃的运行缓存:git 状态、transcript 派生状态、Claude Code 最新版本缓存。
所有平台都统一落在 Claude Code 自己的配置目录下,随 Claude 配置一起走、清理也方便:

```text
~/.claude/ccglance/
├── git/          # git 状态快照(每个仓库一个)
├── transcript/   # transcript 派生的会话状态
└── version/      # Claude Code 最新版本检查
```

若设置了 `CLAUDE_CONFIG_DIR` 改变 Claude Code 配置目录,ccglance 的缓存会跟着落到该目录下。
整个 `ccglance/` 目录随时可安全删除 —— 下次渲染会自动重建。

git 缓存逻辑(缓存 key、`HEAD` 兜底、20 分钟 TTL、detached 刷新、原子写)见
[development.zh-CN.md](./development.zh-CN.md#git-缓存内部细节)。
