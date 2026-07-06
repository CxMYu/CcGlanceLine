// Claude Code 经 stdin 传入的 JSON 形状（字段均按可选处理，缺失时静默降级）。
// 依据官方 statusline 文档 + 实测；不同 Claude Code 版本字段可能增减。

export interface Model {
  display_name?: string;
  id?: string;
}

export interface Effort {
  level?: string;
}

export interface CurrentUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface ContextWindow {
  context_window_size?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
  used_percentage?: number | null;
  remaining_percentage?: number | null;
  current_usage?: CurrentUsage | null;
}

export interface OutputStyle {
  name?: string;
}

export interface Repo {
  host?: string;
  owner?: string;
  name?: string;
}

export interface Workspace {
  current_dir?: string;
  project_dir?: string;
  added_dirs?: string[];
  git_worktree?: string;
  repo?: Repo;
}

export interface Cost {
  total_cost_usd?: number;
  total_duration_ms?: number;
  total_api_duration_ms?: number;
  total_lines_added?: number;
  total_lines_removed?: number;
}

export interface RateLimitWindow {
  used_percentage?: number;
  resets_at?: number; // Unix epoch 秒
}

export interface RateLimits {
  five_hour?: RateLimitWindow;
  seven_day?: RateLimitWindow;
}

export interface Worktree {
  name?: string;
  path?: string;
  branch?: string;
  original_cwd?: string;
  original_branch?: string;
}

export interface Vim {
  mode?: string;
}

export interface StdinData {
  // 元数据
  session_id?: string;
  prompt_id?: string;
  transcript_path?: string;
  cwd?: string;
  version?: string;
  // 运行时
  model?: Model;
  effort?: Effort;
  fast_mode?: boolean;
  context_window?: ContextWindow;
  output_style?: OutputStyle;
  rate_limits?: RateLimits;
  // 项目 / 会话
  workspace?: Workspace;
  session_name?: string;
  cost?: Cost;
  worktree?: Worktree;
  vim?: Vim;
}

// ── 内置渲染规格 ──────────────────────────────────────────────────────────────

export type LayoutMode = 'responsive' | 'fixed';
export type RateShow = 'five_hour' | 'seven_day' | 'both' | 'all';

export interface LayoutSpec {
  mode: LayoutMode;
  separator: string;
  rows: string[][];   // 有序逻辑分组；每项为该组的 segment id 列表
  minWidth: number;   // COLUMNS 缺失时的兜底宽度
}

export interface SegmentOptions {
  enabled?: boolean;
  icon?: string;
  iconColor?: number;
  textColor?: number;
  textBold?: boolean;
  // dir
  fullPath?: boolean;
  // status
  showIdle?: boolean;
  statusIcons?: {
    idle?: string;
    paused?: string;
    thinking?: string;
    working?: string;
    tool?: string;
  };
  // rate_limits
  show?: RateShow;
  showReset?: boolean;
  labels?: {
    five_hour?: string;
    seven_day?: string;
  };
  // usage / context
  percentOnly?: boolean;
  // 阈值染色（context / rate_limits）：达到 warnPct 变黄、dangerPct 变红
  warnPct?: number;
  dangerPct?: number;
  // git
  ttlMs?: number;
}

export interface StatuslineSpec {
  layout: LayoutSpec;
  segments: Record<string, SegmentOptions>;
}
