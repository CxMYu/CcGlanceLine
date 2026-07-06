# Segment & Icon Reference

Full reference for every ccglance segment: which stdin field it reads, what it
shows, all icon meanings, rate-limit levels and color semantics.

[← Back to README](../README.md)

## Line reference

**Line 1 — runtime**

| Label | Segment | Source | Shows |
|---|---|---|---|
| 🤖 | model | `model.display_name`, fallback to `model.id` | stdin display name with minimal compacting (`Opus 4.8 1M`); readable id fallback when missing |
| 🧠 | effort | `effort.level` | reasoning effort |
| ✅/⏸️/💭/⚙️/🔧 | status | transcript tail | icon-only state; tool name while a tool is running |
| 🚀 | fast | `fast_mode` | shown only when fast mode is on |
| ⚡️ | context | `context_window` | usage % · input · output · tokens left |
| 💾 | cache | `context_window.current_usage` | hit % · cache read · cache write |
| 🎯 | style | `output_style.name` | active output style |

**Line 2 — quota**

| Label | Segment | Source | Shows |
|---|---|---|---|
| 📊 | rate limits | `rate_limits.five_hour` / `rate_limits.seven_day` | Compact Hour / Week moon-phase meters with percentage and reset time; Claude Code does not provide a monthly quota window |

**Line 3 — project / session**

| Icon | Segment | Source | Shows |
|---|---|---|---|
| 📁 | dir | `workspace.current_dir` | current directory name |
| 🌿 / 🌲 | git + worktree | stdin + local `git` | branch + status glyph: `✓` clean, `●` dirty, `⚠` conflicts; plus `↑ahead` `↓behind`; `worktree.name` is appended after the branch state |
| 🏷️ | session name | `session_name` | set via `--name` or `/rename` |
| ⏱️ | session | `cost` | elapsed time + `+added` `-removed` lines |
| 💰 | cost | `cost.total_cost_usd` | USD cost, shown only when greater than 0 |
| 💩 | version | `version` | Claude Code version; appends `↑latest` when the 4h cache finds a newer release |

Rate-limit moon phases:

| Usage | Icon |
|---|---|
| 0% <= usage < 10% | 🌑 |
| 10% <= usage < 30% | 🌒 |
| 30% <= usage < 60% | 🌓 |
| 60% <= usage < 90% | 🌔 |
| 90% <= usage <= 100% | 🌕 |

## Icon Reference

| Icon | Meaning |
|---|---|
| 🤖 | model name; `model.display_name` is the source of truth, with readable `model.id` fallback |
| 🧠 | reasoning effort |
| ✅ | idle; the last assistant turn appears complete |
| ⏸️ | paused; a running action was interrupted or cancelled |
| 💭 | thinking; waiting for or receiving model output |
| ⚙️ | working; a tool result returned and Claude is processing it |
| 🔧 | tool call in progress; the tool name is shown when available |
| 🚀 | fast mode |
| ⚡️ | context-window usage |
| 💾 | prompt cache usage |
| 🎯 | output style |
| 📊 | Hour / Week rate-limit quota |
| 🌑 🌒 🌓 🌔 🌕 | rate-limit usage level |
| ⏳ | time until the quota window resets |
| 📁 | current directory |
| 🌿 | git branch |
| ✓ ● ⚠ | git clean / dirty / conflict |
| 🌲 | worktree name, shown inside the git segment |
| 🏷️ | session name |
| ⏱️ | session duration |
| 💰 | session cost |
| 💩 | Claude Code version |
| ↑latest | newer Claude Code version is available |

## Color Semantics

| Color | Meaning |
|---|---|
| Bright green | idle/healthy state, fast mode, cache, additions, clean git marker, git ahead/outgoing/push count |
| Yellow | attention state: paused status, effort, quota reset time, cost, warning thresholds |
| Bright red | risk or negative state: danger thresholds, conflicts, deletions, update hint |
| Blue | Git modified/dirty status and behind/incoming/pull count |
| Cyan / white | neutral runtime/project identity: model, style, session duration, git branch |
| Magenta | active context/session identity: context window, session name |

## Session status

The status icon is inferred from the transcript tail when Claude Code redraws
the status line — a redraw-time approximation, not a live event stream:

- `✅` idle — the last assistant turn appears complete
- `⏸️` paused — a running action was interrupted or cancelled (Esc); updates on the next redraw
- `💭` thinking — waiting for or receiving model output
- `⚙️` working — a tool result returned and Claude is processing it
- `🔧 <tool>` — a tool call is in progress (tool name shown when available)
