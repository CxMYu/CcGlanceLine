// 状态栏组装：收集各段渲染结果（按内置 layout.rows 顺序），交给布局引擎按终端宽度分行。
import type { StdinData, StatuslineSpec } from '../types';
import { paint } from './colors';
import { SEGMENTS, type SegCtx } from '../segments';
import { layout } from './layout';
import { detectWidth } from '../readers/termwidth';
import type { SessionStatus } from '../readers/transcript';

export function hasEnabledSegment(spec: StatuslineSpec, id: string): boolean {
  return spec.segments[id]?.enabled !== false && spec.layout.rows.some((row) => row.includes(id));
}

export interface RenderOptions {
  previewStatus?: SessionStatus;
  nowMs?: number;
  latest?: string;
}

export function render(data: StdinData, spec: StatuslineSpec, options: RenderOptions = {}): string {
  const latest = options.latest !== undefined
    ? options.latest
    : data.version && hasEnabledSegment(spec, 'version')
      ? (require('../runtime/version') as typeof import('../runtime/version')).readCachedLatest()
      : '';
  const ctx: SegCtx = {
    data,
    spec,
    nowMs: options.nowMs ?? Date.now(),
    latest,
    previewStatus: options.previewStatus,
  };

  // 按逻辑行收集：跳过 enabled:false，调用段函数，过滤 null。
  const rendered: string[][] = spec.layout.rows.map((row) =>
    row
      .filter((id) => spec.segments[id] == null || spec.segments[id].enabled !== false)
      .map((id) => {
        const fn = SEGMENTS[id];
        return fn ? fn(ctx) : null;
      })
      .filter((s): s is string => s != null && s.length > 0)
  );

  // 固定白色段分隔符。
  const coloredSep = paint(37, spec.layout.separator);
  // 多级健壮宽度探测（CCGLANCE_WIDTH → COLUMNS → stdout.columns → unix 兜底 → minWidth）
  const columns = detectWidth(spec.layout.minWidth);
  const lines = layout(rendered, coloredSep, columns, spec.layout.mode);
  if (!lines.length) return '';

  // 每行前缀 \x1b[0m：覆盖 Claude Code 施加给状态栏的 dim(发灰)，让配色正常显示。
  const RESET = '\x1b[0m';
  return lines.map((l) => RESET + l).join('\n') + '\n';
}
