# 字段与图标参考

ccglance 每个段的完整参考:读取哪个 stdin 字段、展示什么、所有图标含义、配额档位与颜色语义。

[← 返回 README](../README.zh-CN.md)

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

## 会话状态

status 图标来自 transcript 尾部推断,只代表 Claude Code 触发 statusline 刷新时的近似状态,不是实时事件流:

- `✅` 空闲 —— 最近一轮 assistant 输出已完成
- `⏸️` 暂停 —— 正在执行的动作被中断或取消(Esc);下次重绘时更新
- `💭` 思考中 —— 等待或正在接收模型输出
- `⚙️` 处理中 —— 工具结果已返回,Claude 正在继续处理
- `🔧 <工具名>` —— 正在调用工具(可用时显示工具名)
