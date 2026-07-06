// transcript(.jsonl)流式读取 —— 只从文件「尾部」读固定字节，绝不把整个文件读进内存
// （优于把整份 readFile 后 split 的做法）。派生指标按 path+mtime+size 落盘缓存，未变化则复用，
// 从而不阻塞状态栏：默认无 transcript 段时根本不调用；启用时也只做一次有上限的尾部读。
import fs from 'fs';
import path from 'path';
import { cacheDir } from '../utils/paths';

const TAIL_BYTES = 64 * 1024; // 尾部读取上限：足够覆盖最近若干条消息

export interface TranscriptUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

function cacheFileFor(p: string): string {
  const h = hashString(path.resolve(p));
  return path.join(cacheDir('transcript'), `${h}.usage.json`);
}

function statusCacheFileFor(p: string): string {
  const h = hashString(path.resolve(p));
  return path.join(cacheDir('transcript'), `${h}.status.json`);
}

function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

// 流式尾部读：只读最后 maxBytes 字节，丢弃被截断的首行，返回完整 JSONL 行。
export function readTailLines(filePath: string, maxBytes = TAIL_BYTES): string[] {
  let fd: number | undefined;
  try {
    const st = fs.statSync(filePath);
    const size = st.size;
    if (size <= 0) return [];
    const start = size > maxBytes ? size - maxBytes : 0;
    const len = size - start;
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.allocUnsafe(len);
    fs.readSync(fd, buf, 0, len, start);
    let text = buf.toString('utf8');
    if (start > 0) {
      const nl = text.indexOf('\n'); // 丢弃因截断产生的不完整首行
      if (nl >= 0) text = text.slice(nl + 1);
    }
    return text.split('\n').filter((l) => l.trim().length > 0);
  } catch {
    return [];
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* ignore */ } }
  }
}

interface TranscriptEntry {
  type?: string;
  message?: { usage?: Record<string, number> };
}

// 从尾部行里取最近一条 assistant 消息的 usage（倒序找）。
function extractLatestUsage(lines: string[]): TranscriptUsage | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    let e: TranscriptEntry;
    try { e = JSON.parse(lines[i]) as TranscriptEntry; } catch { continue; }
    if (e.type === 'assistant' && e.message && e.message.usage) {
      const u = e.message.usage;
      return {
        inputTokens: u.input_tokens || 0,
        outputTokens: u.output_tokens || 0,
        cacheReadTokens: u.cache_read_input_tokens || 0,
        cacheCreationTokens: u.cache_creation_input_tokens || 0,
      };
    }
  }
  return null;
}

interface DiskCache {
  mtimeMs: number;
  size: number;
  usage: TranscriptUsage | null;
}

// 取最近 usage：优先命中「文件未变化」的落盘缓存，否则尾部流式读一次并回写缓存。
export function getLatestTranscriptUsage(transcriptPath: string | undefined | null): TranscriptUsage | null {
  if (!transcriptPath) return null;
  let st: fs.Stats;
  try { st = fs.statSync(transcriptPath); } catch { return null; }

  const cf = cacheFileFor(transcriptPath);
  try {
    const c = JSON.parse(fs.readFileSync(cf, 'utf8')) as DiskCache;
    if (c.mtimeMs === st.mtimeMs && c.size === st.size) return c.usage; // 未变化 → 复用
  } catch { /* 无缓存 / 坏缓存 */ }

  const usage = extractLatestUsage(readTailLines(transcriptPath));
  try {
    fs.mkdirSync(path.dirname(cf), { recursive: true });
    const payload: DiskCache = { mtimeMs: st.mtimeMs, size: st.size, usage };
    fs.writeFileSync(cf, JSON.stringify(payload));
  } catch { /* 缓存尽力而为 */ }
  return usage;
}

interface ContentBlock { type?: string; name?: string; text?: string; content?: string }
interface StatusEntry {
  type?: string;
  isMeta?: boolean;
  message?: { stop_reason?: string | null; content?: ContentBlock[] | ContentBlock | string };
}

export type StatusState = 'idle' | 'paused' | 'tool' | 'working' | 'thinking';
export interface SessionStatus { state: StatusState; tool?: string }

const blocks = (c: ContentBlock[] | ContentBlock | string | undefined): ContentBlock[] => {
  if (Array.isArray(c)) return c;
  if (c && typeof c === 'object') return [c];
  return [];
};
const contentText = (c: ContentBlock[] | ContentBlock | string | undefined): string => {
  if (typeof c === 'string') return c;
  return blocks(c).map((b) => b.text || b.content || '').filter(Boolean).join('\n');
};

function isInterruptedEntry(e: StatusEntry): boolean {
  if (e.type !== 'user') return false;
  const text = contentText(e.message && e.message.content).trim();
  if (!text) return false;
  const loose = /\b(interrupted|interrupt|aborted|abort|cancelled|canceled|keyboardinterrupt)\b|中断|取消/i;
  if (e.isMeta) return loose.test(text);
  return /^\[?\s*(request\s+)?(interrupted|cancelled|canceled|aborted)(\s+by\s+user)?\.?\s*\]?$/i.test(text)
    || /^\[?\s*user\s+(interrupted|cancelled|canceled|aborted)(\s+the\s+request)?\.?\s*\]?$/i.test(text)
    || /^keyboardinterrupt$/i.test(text);
}

// 会话状态推断：从尾部倒序找「最后一条对话消息」(跳过 mode/title 等元数据行)，细分为：
//   tool     —— assistant 请求工具(tool_use)，带工具名        (正在调用/运行工具)
//   idle     —— assistant end_turn/stop_sequence               (回合结束)
//   paused   —— 用户中断 / Esc 取消
//   working  —— user 消息含 tool_result                        (工具已返回，模型继续处理)
//   thinking —— user 纯提示 / assistant 未结束且无工具         (等待模型响应/生成中)
function extractRecentStatus(lines: string[]): SessionStatus | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    let e: StatusEntry;
    try { e = JSON.parse(lines[i]) as StatusEntry; } catch { continue; }
    const msg = e.message;
    if (isInterruptedEntry(e)) return { state: 'paused' };
    if (e.type === 'assistant') {
      const content = blocks(msg && msg.content);
      const toolUse = content.find((b) => b && b.type === 'tool_use');
      if (toolUse) return { state: 'tool', tool: toolUse.name };
      // 已产出文本/思考内容 = 回合结束 → idle。
      // 注意：Claude Code transcript 常把完成的文本回复记为 stop_reason:null（而非 end_turn），
      // 所以判 idle 看「有内容」而非 stop_reason，否则正常回复会被误判成 thinking。
      const hasText = content.some((b) => b && (b.type === 'text' || b.type === 'thinking'))
        || (typeof (msg && msg.content) === 'string' && String(msg && msg.content).length > 0);
      return { state: hasText ? 'idle' : 'thinking' };
    }
    if (e.type === 'user') {
      const hasToolResult = blocks(msg && msg.content).some((b) => b && b.type === 'tool_result');
      return { state: hasToolResult ? 'working' : 'thinking' };
    }
  }
  return null;
}

interface StatusDiskCache {
  mtimeMs: number;
  size: number;
  status: SessionStatus | null;
}

// 局限：statusLine 仅在重绘时被 spawn，故这是「重绘时刻的近似态」，非实时事件流。
export function getRecentStatus(transcriptPath: string | undefined | null): SessionStatus | null {
  if (!transcriptPath) return null;
  let st: fs.Stats;
  try { st = fs.statSync(transcriptPath); } catch { return null; }

  const cf = statusCacheFileFor(transcriptPath);
  try {
    const c = JSON.parse(fs.readFileSync(cf, 'utf8')) as StatusDiskCache;
    if (c.mtimeMs === st.mtimeMs && c.size === st.size) return c.status;
  } catch {
    // Cache miss.
  }

  const status = extractRecentStatus(readTailLines(transcriptPath));
  try {
    fs.mkdirSync(path.dirname(cf), { recursive: true });
    const payload: StatusDiskCache = { mtimeMs: st.mtimeMs, size: st.size, status };
    fs.writeFileSync(cf, JSON.stringify(payload));
  } catch {
    // Cache is best effort.
  }
  return status;
}
