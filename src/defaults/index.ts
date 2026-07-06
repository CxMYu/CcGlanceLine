import type { StatuslineSpec } from '../types';

export const DEFAULT_SPEC: StatuslineSpec = {
  layout: {
    mode: 'responsive',
    separator: ' | ',
    rows: [
      ['model', 'effort', 'status', 'fast', 'context', 'cache', 'style'], // 运行时
      ['rate_limits'],                                                    // 订阅(无订阅→整行消失)
      ['dir', 'git', 'session_name', 'session', 'cost', 'version'], // 项目/会话
    ],
    minWidth: 80,
  },
  segments: {
    status: {
      enabled: true,
      showIdle: true,
      statusIcons: { idle: '✅', paused: '⏸️', thinking: '💭', working: '⚙️', tool: '🔧' },
    },
    model: { enabled: true },
    effort: { enabled: true },
    fast: { enabled: true },
    context: { enabled: true, percentOnly: false, warnPct: 75, dangerPct: 90 },
    cache: { enabled: true },
    rate_limits: {
      enabled: true,
      show: 'both',
      warnPct: 70,
      dangerPct: 90,
      showReset: true,
      labels: { five_hour: 'Hour', seven_day: 'Week' },
    },
    style: { enabled: true },
    dir: { enabled: true, fullPath: false },
    git: { enabled: true, ttlMs: 20 * 60 * 1000 },
    session_name: { enabled: true },
    session: { enabled: true },
    cost: { enabled: true },
    version: { enabled: true },
  },
};
