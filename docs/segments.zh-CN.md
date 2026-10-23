# 字段与图标参考

ccglance 每个段的完整参考:读取哪个 stdin 字段、展示什么、所有图标含义、配额档位与颜色语义。

[← 返回 README](../README.zh-CN.md)

## 字段说明

**第一行 —— 运行时**

| 标识 | 段 | 来源 | 展示 |
|---|---|---|---|
| 🤖 | 模型 | `model.display_name`、`model.id`、`context_window.context_window_size` | 压缩名称如 `Opus 5.5 1M`；有效实际容量决定 1M 及以上窗口标记，缺失时才用名称/id 提示兜底 |
| 👤 | agent | `agent.name` | 当前主 agent 名；字段缺失时隐藏 |
| 🧠 | effort / thinking | `effort.level`、`thinking.enabled` | 推理强度；thinking 明确关闭时追加 `⊘` |
| ✅/⏸️/💭/⚙️/🔧 | 状态 | transcript 尾部 | 仅图标显示状态；工具运行时显示工具名 |
| 🚀 | fast | `fast_mode` | 仅 fast 模式开启时显示 |
| ⚡️ | 上下文 | `context_window` | 占比 · 输入 · 输出 · 剩余 |
| 💾 | 缓存 | `context_window.current_usage` / `prompt_cache` | 最近一次请求命中率 · 最近一次缓存读写 · 热缓存剩余时间或冷缓存重建量；本次 usage 不可用时，仅以 `Avg` 展示会话累计比例，不显示读写量 |
| 🎯 | 输出风格 | `output_style.name` | 当前 output style |

**第二行 —— 订阅 / 配额**

| 标识 | 段 | 来源 | 展示 |
|---|---|---|---|
| 📊 | 配额 | `rate_limits.five_hour` / `seven_day` / `spend_limit` | Hour / Week / 可选企业网关 `Limit`，带百分比与重置时间；`Limit` 可超过 100%，可选追加 `$已用/$上限 周期` |

**第三行 —— 项目 / 会话**

| 图标 | 段 | 来源 | 展示 |
|---|---|---|---|
| 📁 | 目录 | `workspace.current_dir` | 当前目录名 |
| 🌿 / 🌲 | git + worktree | stdin + 本地 `git` | 分支 + 状态标记：`✓` 干净、`●` 有未提交变更、`⚠` 有冲突；另含 `↑领先` `↓落后`；优先用 `worktree.name`，缺失时回退 `workspace.git_worktree` |
| 🔀 | PR | `pr.number`、`pr.review_state` | PR 编号，以及 `✓` 已批准、`○` 待审、`!` 需修改或 `◌` 草稿 |
| 🏷️ | 会话名 | `session_name` | 由 `--name` 或 `/rename` 设置 |
| ⏱️ | 会话 | `cost` | 耗时 + `+新增` `-删除` 行数 |
| 💰 | cost | `cost.total_cost_usd` | 美元成本，大于 0 时显示 |
| 💩 | 版本 | `version` | Claude Code 版本；2 小时缓存发现新版时追加 `↑latest` |

配额月相映射：

| 占用 | 图标 |
|---|---|
| 0% <= 占用 < 10% | 🌑 |
| 10% <= 占用 < 30% | 🌒 |
| 30% <= 占用 < 60% | 🌓 |
| 60% <= 占用 < 90% | 🌔 |
| 占用 >= 90% | 🌕 |

## 图标说明

| 图标 | 含义 |
|---|---|
| 🤖 | 模型名；以 `model.display_name` 为准，缺失时用可读 `model.id` 兜底 |
| 👤 | 当前主 agent 名 |
| ⊘ | extended thinking 已明确关闭 |
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
| 📊 | Hour / Week 订阅配额及可选的企业网关 Limit |
| 🌑 🌒 🌓 🌔 🌕 | 配额占用档位 |
| ⏳ | 距离当前配额窗口重置的时间 |
| 📁 | 当前目录 |
| 🌿 | git 分支 |
| 🔀 | PR 编号与审查状态 |
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

只有 thinking 或 redacted-thinking 的记录保持 `💭`。明确的 `end_turn` / `stop_sequence`
代表完成；旧版文本回复缺少 `stop_reason` 或为 null 时，仍保留 `✅` 的回退。普通元数据
会跳过，中断记录仍会生效。transcript 是快照，单凭文本无法可靠区分流式片段和完整回复。
可用[可选定时刷新](../README.zh-CN.md#配置)缩短 assistant 消息间的状态滞后；
没有重绘时，ccglance 不会重新推断状态。

## 企业网关消费金额

Claude Code 和网关均 >= 2.1.284 时，`rate_limits.spend_limit` 可额外提供 `used_usd`、
`limit_usd`、`period`。金额对有效时，例如显示 `Limit 🌔 63% $314.00/$500.00 monthly`。
金额缺失仍沿用原来的百分比与重置时间；已用金额可为 0，上限必须大于 0。
周期按原字符串展示，兼容未来新增值。

金额由网关独立查询，在持续请求时约每五分钟更新；`used_percentage` 随响应更新，
两者可能不同步。ccglance 保留官方百分比，不会用可能较旧的金额重算比例。
见[官方消费限额字段](https://code.claude.com/docs/en/statusline#spend-limit-fields)。
