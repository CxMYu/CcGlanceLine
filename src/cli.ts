#!/usr/bin/env node
// ccglance —— Claude Code 双行/多行状态栏入口。
//
// 用法：
//   ccglance                 作为 statusLine command：读 stdin → 渲染 → 输出 → 后台刷新版本
//   ccglance preview         用内置样例预览当前固定渲染
//
// 核心数据来自 Claude Code 经 stdin 传入的 JSON；少数派生段会按需读 transcript 尾部。
// stdin 解析失败静默退出（exit 0）。
import type { StdinData } from './types';
import { readStdinData } from './readers';

// preview 子命令用的内置样例（覆盖默认状态栏会展示的常规字段）
const PREVIEW_SAMPLE: StdinData = {
  model: { display_name: 'Opus 4.8', id: 'claude-opus-4-8[1m]' },
  effort: { level: 'high' },
  fast_mode: true,
  context_window: {
    context_window_size: 1000000, total_input_tokens: 235000, total_output_tokens: 1200,
    used_percentage: 23.5, remaining_percentage: 76.5,
    current_usage: { output_tokens: 1200, cache_read_input_tokens: 172000, cache_creation_input_tokens: 15000 },
  },
  output_style: { name: 'default' },
  rate_limits: {
    five_hour: { used_percentage: 23.5, resets_at: Math.floor(Date.now() / 1000) + 2 * 3600 },
    seven_day: { used_percentage: 41.2, resets_at: Math.floor(Date.now() / 1000) + 3 * 86400 },
  },
  workspace: { current_dir: process.cwd() },
  worktree: { name: 'main', branch: 'main' },
  session_name: 'ccglance',
  cost: { total_cost_usd: 0.1234, total_duration_ms: 192000, total_lines_added: 156, total_lines_removed: 23 },
  version: '2.0.1',
};

const argv = process.argv.slice(2);

// 用法 + 「安装后要做什么」指引。终端直接运行或 --help 时打印；此路径绝不读 stdin。
function printHelp(): void {
  const version = (require('../package.json') as { version?: string }).version || '';
  process.stdout.write(
`ccglance ${version} — 面向 Claude Code 的多行状态栏 / a multi-line status line for Claude Code

用法 Usage:
  ccglance                作为 Claude Code statusLine 命令：从 stdin 读 JSON、渲染、输出后退出
                          (statusLine mode: reads JSON on stdin, renders, prints, exits)
  ccglance preview        用内置样例渲染一次，无需 stdin (render a built-in sample)
  ccglance --help, -h     显示本帮助 (show this help)
  ccglance --version, -v  显示版本号 (print version)

安装后配置 Setup — 装完必须做这一步 (required after \`npm install -g ccglance\`):
  把下面这段加进 ~/.claude/settings.json，然后重启 Claude Code。
  Add this to ~/.claude/settings.json, then restart Claude Code:

    {
      "statusLine": {
        "type": "command",
        "command": "ccglance"
      }
    }

  未全局安装？让 Node 直接指向编译产物 (not installed globally? point Node at the built file):
    "command": "node /absolute/path/to/dist/cli.js"

文档 Docs: https://github.com/CxMYu/CcGlanceLine
`);
}

if (argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
  printHelp();
  process.exit(0);
}

if (argv[0] === '--version' || argv[0] === '-v') {
  process.stdout.write(((require('../package.json') as { version?: string }).version || '') + '\n');
  process.exit(0);
}

// 子命令：preview —— 用内置样例按固定样式渲染
if (argv[0] === 'preview') {
  const { render, hasEnabledSegment } = require('./render') as typeof import('./render');
  const { DEFAULT_SPEC } = require('./defaults') as typeof import('./defaults');
  process.stdout.write(render(PREVIEW_SAMPLE, DEFAULT_SPEC, { previewStatus: { state: 'idle' } }));
  if (hasEnabledSegment(DEFAULT_SPEC, 'version')) {
    const { scheduleRefresh } = require('./runtime/version') as typeof import('./runtime/version');
    scheduleRefresh();
  }
  process.exit(0);
}

// 在真实终端直接运行（stdin 是 TTY、没有管道喂 JSON）时，显示帮助而非阻塞等待 stdin。
if (process.stdin.isTTY) {
  printHelp();
  process.exit(0);
}

// statusLine 模式：读 stdin（解析失败静默退出）
const data = readStdinData();
if (!data) process.exit(0);

// 先输出 —— 用户立即看到状态栏。
const { render, hasEnabledSegment } = require('./render') as typeof import('./render');
const { DEFAULT_SPEC } = require('./defaults') as typeof import('./defaults');
process.stdout.write(render(data, DEFAULT_SPEC));

if (data.version && hasEnabledSegment(DEFAULT_SPEC, 'version')) {
  const { scheduleRefresh } = require('./runtime/version') as typeof import('./runtime/version');
  scheduleRefresh();
}
