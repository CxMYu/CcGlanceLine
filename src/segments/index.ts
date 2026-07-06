// 各状态栏段：每段一个 (ctx) => string | null 的纯函数（null = 无数据）。
// 是否启用由调用方（render.ts）按内置 segments[id].enabled 判定；此处只管“有数据就渲染”。
import type { StdinData, StatuslineSpec, SegmentOptions } from '../types';
import { paint, seg, C, DOT } from '../render/colors';
import { modelName, fmtTokens, fmtPct, fmtDuration, semverGt, fmtCost, fmtResetIn } from '../utils/format';
import { icon, type IconId } from '../render/icons';
import type { SessionStatus } from '../readers/transcript';

export interface SegCtx {
  data: StdinData;
  spec: StatuslineSpec;
  nowMs: number;
  latest: string;
  previewStatus?: SessionStatus;
}

export type SegmentFn = (ctx: SegCtx) => string | null;

const opt = (ctx: SegCtx, id: string): SegmentOptions => ctx.spec.segments[id] || {};

const optIcon = (ctx: SegCtx, id: string, fallback: IconId): string =>
  opt(ctx, id).icon || icon(fallback);

const optIconColor = (ctx: SegCtx, id: string, fallback: number): number =>
  opt(ctx, id).iconColor != null ? opt(ctx, id).iconColor as number : fallback;

const optTextColor = (ctx: SegCtx, id: string, fallback: number): number =>
  opt(ctx, id).textColor != null ? opt(ctx, id).textColor as number : fallback;

const optBold = (ctx: SegCtx, id: string): boolean => opt(ctx, id).textBold === true;

function iconSeg(ctx: SegCtx, id: string, fallbackColor: number, fallbackIcon: IconId, text: string): string {
  return seg(
    fallbackColor,
    optIcon(ctx, id, fallbackIcon),
    text,
    optIconColor(ctx, id, fallbackColor),
    optTextColor(ctx, id, fallbackColor),
    optBold(ctx, id),
  );
}

// 阈值染色：达到 danger 变红、达到 warn 变黄、否则常态色。
function pctColor(v: number, warn: number, danger: number, normal: number): number {
  return v >= danger ? C.danger : v >= warn ? C.caution : normal;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function nonNegative(v: unknown): number | null {
  const n = num(v);
  return n != null && n >= 0 ? n : null;
}

function positive(v: unknown): number | null {
  const n = num(v);
  return n != null && n > 0 ? n : null;
}

// ── 第一行：运行时 ────────────────────────────────────────────────────────────

function statusIcon(ctx: SegCtx, key: 'idle' | 'paused' | 'thinking' | 'working' | 'tool', fallback: string): string {
  return opt(ctx, 'status').statusIcons?.[key] || fallback;
}

function fmtRatePct(v: number): string {
  return Math.max(0, Math.min(100, Math.round(v))) + '%';
}

// 会话状态：读 transcript 尾部推断；默认仅显示图标，工具态附带工具名。
const status: SegmentFn = (ctx) => {
  const s = ctx.previewStatus || (ctx.data.transcript_path
    ? (require('../readers/transcript') as typeof import('../readers/transcript')).getRecentStatus(ctx.data.transcript_path)
    : null);
  if (!s) return null;
  switch (s.state) {
    case 'tool': return seg(C.stTool, statusIcon(ctx, 'tool', '🔧'), s.tool || 'tool');
    case 'idle': return opt(ctx, 'status').showIdle === false ? null : paint(C.idle, statusIcon(ctx, 'idle', '✅'));
    case 'paused': return paint(C.paused, statusIcon(ctx, 'paused', '⏸️'));
    case 'working': return paint(C.working, statusIcon(ctx, 'working', '⚙️'));
    case 'thinking': return paint(C.stThink, statusIcon(ctx, 'thinking', '💭'));
  }
  return null;
};

const model: SegmentFn = (ctx) =>
  ctx.data.model && (ctx.data.model.display_name || ctx.data.model.id)
    ? iconSeg(ctx, 'model', C.model, 'model', modelName(ctx.data.model)) : null;

const effort: SegmentFn = ({ data }) =>
  data.effort && data.effort.level ? seg(C.effort, '🧠', data.effort.level) : null;

const fast: SegmentFn = (ctx) =>
  ctx.data.fast_mode ? iconSeg(ctx, 'fast', C.fast, 'fast', 'fast') : null;

const context: SegmentFn = (ctx) => {
  const cw = ctx.data.context_window;
  if (!cw) return null;
  const cu = cw.current_usage || {};
  const used = nonNegative(cw.total_input_tokens) ?? nonNegative(cu.input_tokens) ?? 0;
  const out = nonNegative(cu.output_tokens) ?? nonNegative(cw.total_output_tokens) ?? 0;
  const size = positive(cw.context_window_size);
  if (!size) return null;
  const pct = num(cw.used_percentage) ?? used / size * 100;
  const remain = cw.remaining_percentage != null
    ? Math.round(cw.remaining_percentage / 100 * size)
    : Math.max(0, size - used);
  const o = opt(ctx, 'context');
  const normal = optTextColor(ctx, 'context', C.ctx);
  const col = pctColor(pct, o.warnPct != null ? o.warnPct : 75, o.dangerPct != null ? o.dangerPct : 90, normal);
  if (o.percentOnly) return iconSeg(ctx, 'context', col, 'context', fmtPct(pct));
  const parts = [fmtPct(pct), `↓${fmtTokens(used)}`, `↑${fmtTokens(out)}`];
  if (remain != null) parts.push(`→${fmtTokens(remain)}`);
  return iconSeg(ctx, 'context', col, 'context', parts.join(DOT));
};

const cache: SegmentFn = (ctx) => {
  const cw = ctx.data.context_window;
  if (!cw) return null;
  const cu = cw.current_usage || {};
  const used = nonNegative(cw.total_input_tokens) ?? nonNegative(cu.input_tokens) ?? 0;
  const read = nonNegative(cu.cache_read_input_tokens) ?? 0;
  const write = nonNegative(cu.cache_creation_input_tokens) ?? 0;
  const hitPct = used > 0 && read > 0 ? read / used * 100 : 0;
  return iconSeg(ctx, 'cache', C.cache, 'cache', `${fmtPct(hitPct)}${DOT}↓${fmtTokens(read)}${DOT}↑${fmtTokens(write)}`);
};

const rateLimits: SegmentFn = (ctx) => {
  const rl = ctx.data.rate_limits;
  if (!rl) return null;
  const o = opt(ctx, 'rate_limits');
  const show = o.show || 'all';
  const showReset = o.showReset !== false;
  const labels = {
    five_hour: o.labels?.five_hour || 'Hour',
    seven_day: o.labels?.seven_day || 'Week',
  };
  const normal = optTextColor(ctx, 'rate_limits', C.rate);
  const bold = optBold(ctx, 'rate_limits');
  const parts: string[] = [];
  let maxUsed = 0;

  const wants = (ids: string[]): boolean => ids.includes(show);
  const meter = (pct: number, color: number): string => {
    const glyph = pct >= 90 ? '🌕'
      : pct >= 60 ? '🌔'
        : pct >= 30 ? '🌓'
          : pct >= 10 ? '🌒' : '🌑';
    return paint(color, glyph, bold);
  };
  const pushWindow = (label: string, win: { used_percentage?: number; resets_at?: number } | undefined): void => {
    if (!win || win.used_percentage == null) return;
    const pct = win.used_percentage;
    const warn = o.warnPct != null ? o.warnPct : 70;
    const danger = o.dangerPct != null ? o.dangerPct : 90;
    const winColor = pctColor(pct, warn, danger, normal);
    const reset = showReset ? fmtResetIn(win.resets_at, ctx.nowMs) : null;
    const detail = [
      paint(normal, label, bold),
      meter(pct, winColor),
      paint(winColor, fmtRatePct(pct), bold),
    ];
    if (reset) detail.push(paint(C.rateReset, '⏳', bold), paint(C.rateReset, reset, bold));
    parts.push(detail.join(' '));
    maxUsed = Math.max(maxUsed, pct);
  };

  if (wants(['all', 'both', 'five_hour'])) {
    pushWindow(labels.five_hour, rl.five_hour);
  }
  if (wants(['all', 'both', 'seven_day'])) {
    pushWindow(labels.seven_day, rl.seven_day);
  }
  if (!parts.length) return null;
  const col = pctColor(maxUsed, o.warnPct != null ? o.warnPct : 70, o.dangerPct != null ? o.dangerPct : 90, normal);
  const rate = optIcon(ctx, 'rate_limits', 'rate_limits');
  return paint(optIconColor(ctx, 'rate_limits', col), rate, bold) + ' ' + parts.join(DOT);
};

const style: SegmentFn = (ctx) =>
  ctx.data.output_style && ctx.data.output_style.name ? iconSeg(ctx, 'style', C.style, 'style', ctx.data.output_style.name) : null;

// ── 第二行：项目 / 会话 ──────────────────────────────────────────────────────

const dir: SegmentFn = (ctx) => {
  const cwd = (ctx.data.workspace && ctx.data.workspace.current_dir) || ctx.data.cwd || '';
  if (!cwd) return null;
  const ic = optIcon(ctx, 'dir', 'dir');
  const iconColor = optIconColor(ctx, 'dir', C.dirIcon);
  const textColor = optTextColor(ctx, 'dir', C.dirText);
  const bold = optBold(ctx, 'dir');
  if (opt(ctx, 'dir').fullPath) return paint(iconColor, ic, bold) + ' ' + paint(textColor, cwd, bold);
  const name = cwd.replace(/[\\/]+$/, '').split(/[\\/]/).pop();
  return name ? paint(iconColor, ic, bold) + ' ' + paint(textColor, name, bold) : null;
};

const git: SegmentFn = (ctx) => {
  const cwd = (ctx.data.workspace && ctx.data.workspace.current_dir) || ctx.data.cwd || '';
  if (!cwd) return null;
  const { gitSegment } = require('../runtime/git') as typeof import('../runtime/git');
  return gitSegment(cwd, optIcon(ctx, 'git', 'git'), opt(ctx, 'git'), ctx.data.worktree?.branch, ctx.data.worktree?.name);
};

const sessionName: SegmentFn = ({ data }) =>
  data.session_name ? seg(C.name, '🏷️', data.session_name) : null;

const session: SegmentFn = (ctx) => {
  const cost = ctx.data.cost;
  if (!cost || cost.total_duration_ms == null) return null;
  const dur = fmtDuration(cost.total_duration_ms);
  if (!dur) return null;
  const added = cost.total_lines_added || 0;
  const removed = cost.total_lines_removed || 0;
  const diff = [paint(C.add, '+' + added), paint(C.del, '-' + removed)];
  return iconSeg(ctx, 'session', C.sess, 'session', dur) + ' ' + diff.join(' ');
};

const cost: SegmentFn = (ctx) => {
  const usd = ctx.data.cost && ctx.data.cost.total_cost_usd;
  return usd != null && usd > 0 ? iconSeg(ctx, 'cost', C.cost, 'cost', fmtCost(usd)) : null;
};

const version: SegmentFn = (ctx) => {
  const current = ctx.data.version;
  if (!current) return null;
  const bold = optBold(ctx, 'version');
  const iconColor = optIconColor(ctx, 'version', C.ver);
  const textColor = optTextColor(ctx, 'version', C.ver);
  let text = paint(iconColor, optIcon(ctx, 'version', 'version'), bold) + ' ' + paint(textColor, 'v' + current, bold);
  if (ctx.latest && semverGt(ctx.latest, current)) text += ' ' + paint(C.upd, '↑' + ctx.latest);
  return text;
};

export const SEGMENTS: Record<string, SegmentFn> = {
  // 运行时
  status, model, effort, fast, context, cache, style,
  // 订阅
  rate_limits: rateLimits,
  // 项目 / 会话
  dir, git, session_name: sessionName, session, cost, version,
};
