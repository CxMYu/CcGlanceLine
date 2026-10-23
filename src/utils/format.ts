// 格式化工具函数。
import type { Model } from '../types';

const TOKEN_CASE: Record<string, string> = {
  glm: 'GLM',
  chatglm: 'ChatGLM',
  kimi: 'Kimi',
  qwen: 'Qwen',
  deepseek: 'DeepSeek',
  doubao: 'Doubao',
  minimax: 'MiniMax',
  coder: 'Coder',
  turbo: 'Turbo',
  chat: 'Chat',
  instruct: 'Instruct',
  thinking: 'Thinking',
  gpt: 'GPT',
  llm: 'LLM',
  vl: 'VL',
};

function contextSuffix(id: string, size?: number): string {
  // New default-1M models may no longer carry [1m]. A valid live size also
  // overrides a stale display-name/id hint when the session uses a smaller window.
  if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
    return size >= 1000000 ? `${Number((size / 1000000).toFixed(2))}M` : '';
  }
  return /\[1m\]/i.test(id) ? '1M' : '';
}

function appendContextSuffix(name: string, id: string, size?: number): string {
  if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
    name = name.replace(/\s+\d+(?:\.\d+)?\s*[km]$/i, '').trim();
  }
  const suffix = contextSuffix(id, size);
  return suffix && !new RegExp(`\\b${suffix.replace(/\./g, '\\.')}\\b`, 'i').test(name) ? `${name} ${suffix}` : name;
}

function matchClaudeFamily(raw: string): string | null {
  const source = raw.toLowerCase();
  for (const [keyword, label] of [['sonnet', 'Sonnet'], ['opus', 'Opus'], ['haiku', 'Haiku']] as const) {
    const post = new RegExp(`${keyword}[-_\\s]+(\\d{1,2})(?:[-_.\\s]+(\\d{1,2}))?(?=$|[-_\\s\\[])`).exec(source);
    const pre = new RegExp(`(\\d{1,2})(?:[-_.\\s]+(\\d{1,2}))?[-_\\s]+${keyword}(?=$|[-_\\s\\[])`).exec(source);
    const match = post || pre;
    if (!match) continue;
    const major = match[1];
    const minor = match[2];
    return `${label} ${major}${minor ? `.${minor}` : ''}`;
  }
  return null;
}

function normalizeDisplayName(displayName: string): string {
  return displayName
    .replace(/^Claude\s+/i, '')
    .replace(/\s*\((\d+(?:\.\d+)?)\s*([km])(?:\s+context)?\)/i, ' $1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleToken(token: string): string {
  const lower = token.toLowerCase();
  if (TOKEN_CASE[lower]) return TOKEN_CASE[lower];
  const compact = /^([a-z]+)(\d+(?:\.\d+)?)$/i.exec(token);
  if (compact) {
    const head = TOKEN_CASE[compact[1].toLowerCase()]
      || (compact[1][0].toUpperCase() + compact[1].slice(1).toLowerCase());
    return head + compact[2];
  }
  if (/^[rv]\d+(?:\.\d+)?$/i.test(token)) return token.toUpperCase();
  if (/^[a-z]{2,3}$/i.test(token)) return token.toUpperCase();
  return token[0] ? token[0].toUpperCase() + token.slice(1).toLowerCase() : token;
}

function readableModelId(id: string): string {
  const base = id
    .replace(/\[[^\]]+\]/g, '')
    .split('/')
    .filter(Boolean)
    .pop() || id;
  const rawTokens = base.split(/[-_\s]+/).filter(Boolean);
  const tokens: string[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    if (/^\d+$/.test(rawTokens[i]) && i + 1 < rawTokens.length && /^\d+$/.test(rawTokens[i + 1])) {
      tokens.push(`${rawTokens[i]}.${rawTokens[i + 1]}`);
      i++;
    } else {
      tokens.push(rawTokens[i]);
    }
  }
  return tokens.map(titleToken).join(' ').trim();
}

// 模型名以 Claude Code stdin 的 display_name 为准；id 只在 display_name 缺失时兜底。
export function modelName(model: Model, contextWindowSize?: number): string {
  const id = (model.id || '').trim();
  const displayName = (model.display_name || '').trim();
  const normalizedDisplay = normalizeDisplayName(displayName);
  const baseName = normalizedDisplay || matchClaudeFamily(id) || readableModelId(id);
  return appendContextSuffix(baseName, id, contextWindowSize);
}

// 12345 → 12.3k
export const fmtTokens = (n: number | null | undefined): string =>
  n == null ? '0' : n < 1000 ? String(n)
    : (Number.isInteger(n / 1000) ? (n / 1000).toFixed(0) : (n / 1000).toFixed(1)) + 'k';

// 整数省小数: 12 → 12% / 12.3 → 12.3%
export const fmtPct = (v: number): string =>
  (Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)) + '%';

export function fmtDuration(ms: number | null | undefined): string | null {
  if (ms == null) return null;
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return Math.floor(ms / 1000) + 's';
  if (ms < 3600000) {
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    return s ? `${m}m${s}s` : `${m}m`;
  }
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return m ? `${h}h${m}m` : `${h}h`;
}

// a > b ?
export const semverGt = (a: string, b: string): boolean => {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
};

// 美元成本: <1 保留 3 位、否则 2 位。 0.0123→$0.012  1.5→$1.50
export const fmtCost = (usd: number): string =>
  '$' + (usd < 1 ? usd.toFixed(3) : usd.toFixed(2));

// 距重置的剩余时长（epoch 秒 → 短格式 "2h" / "3d" / "45m"）；已过期或无值返回 null
export function fmtResetIn(epochSec: number | null | undefined, nowMs: number): string | null {
  if (epochSec == null) return null;
  const ms = epochSec * 1000 - nowMs;
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86400000);
  if (d >= 1) { const h = Math.floor((ms % 86400000) / 3600000); return h ? `${d}d${h}h` : `${d}d`; }
  return fmtDuration(ms);
}
