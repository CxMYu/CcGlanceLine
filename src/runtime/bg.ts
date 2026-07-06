// 后台刷新 helper —— 由 refresh.ts 以 detached 进程启动，绝不被状态栏进程等待。
// 任务列表从 argv[2] 指向的 task-*.json 读入，全部尽力而为、静默失败：
//   git     —— 单次有界 `git status --porcelain=v2 --branch`，解析后原子写缓存
//   version —— 拉 npm registry 的 Claude Code 最新版本，原子写缓存
// 每个任务无论成败都要移除自己的 .refresh marker，否则只能等节流窗口过期。
import fs from 'fs';
import path from 'path';
import type { RefreshTask } from './refresh';
import { appCacheDir } from '../utils/paths';

const GIT_TIMEOUT_MS = 700;

// 缓存清理：每天最多一次（stamp 节流）。缓存 key 是仓库/transcript 路径的哈希，
// 临时目录一去不返时对应 json 便成死条目，按 mtime 过期删除（活跃条目会被刷新持续续命）。
const PRUNE_INTERVAL_MS = 24 * 3600 * 1000;
const PRUNE_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const PRUNE_TRANSIENT_MAX_AGE_MS = 3600 * 1000; // 残留 .refresh 标记 / .tmp 半成品 / task 文件

interface GitInfo {
  branch: string;
  glyph?: string;
  ahead: number;
  behind: number;
}

// git status --porcelain=v2 --branch 输出解析（与渲染端 GitCache 结构保持一致）。
function parseStatus(out: string): GitInfo | null {
  let head = '';
  let oid = '';
  let ahead = 0;
  let behind = 0;
  let dirty = false;
  let conflict = false;

  for (const raw of out.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line) continue;

    if (line.startsWith('# branch.head ')) {
      head = line.slice('# branch.head '.length).trim();
      continue;
    }
    if (line.startsWith('# branch.oid ')) {
      oid = line.slice('# branch.oid '.length).trim();
      continue;
    }
    if (line.startsWith('# branch.ab ')) {
      const m = /# branch\.ab \+(\d+) -(\d+)/.exec(line);
      if (m) {
        ahead = parseInt(m[1], 10) || 0;
        behind = parseInt(m[2], 10) || 0;
      }
      continue;
    }
    if (line[0] === '#') continue;
    if (line.startsWith('u ')) conflict = true;
    if (!line.startsWith('! ')) dirty = true;
  }

  const branch = head && head !== '(detached)' ? head : oid.slice(0, 8);
  if (!branch) return null;
  return { branch, glyph: conflict ? '⚠' : dirty ? '●' : '✓', ahead, behind };
}

function atomicWrite(file: string, data: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

function rmMarker(marker: string): void {
  try { fs.rmSync(marker, { force: true }); } catch { /* ignore */ }
}

function runGitTask(root: string, cacheFile: string): void {
  const { execFileSync } = require('child_process') as typeof import('child_process');
  const out = execFileSync('git', ['--no-optional-locks', '-C', root, 'status', '--porcelain=v2', '--branch'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });
  const info = parseStatus(out);
  if (info) atomicWrite(cacheFile, JSON.stringify({ ...info, checkedAt: Date.now() }));
}

function runVersionTask(cacheFile: string, done: () => void): void {
  let prev = '';
  try {
    prev = (JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { latest?: string }).latest || '';
  } catch { /* no previous cache */ }

  let finished = false;
  const finish = (latest: string): void => {
    if (finished) return;
    finished = true;
    try { atomicWrite(cacheFile, JSON.stringify({ latest: latest || prev, checkedAt: Date.now() })); } catch { /* ignore */ }
    done();
  };

  try {
    const https = require('https') as typeof import('https');
    const req = https.get('https://registry.npmjs.org/@anthropic-ai/claude-code/latest', (r) => {
      if (r.statusCode !== 200) { r.resume(); return finish(''); }
      let d = '';
      r.on('data', (c) => { d += c; });
      r.on('end', () => {
        try { finish((JSON.parse(d) as { version?: string }).version || ''); } catch { finish(''); }
      });
    });
    req.on('error', () => finish(''));
    req.setTimeout(5000, () => { req.destroy(); finish(''); });
  } catch {
    finish('');
  }
}

// 过期清理：正常缓存 json 超过 30 天未被刷新（mtime）视为死条目；
// .refresh / .tmp / tasks 超过 1 小时视为进程夭折的残留。逐文件尽力而为。
function pruneCaches(nowMs = Date.now()): void {
  const root = appCacheDir();
  const stamp = path.join(root, 'prune.stamp');
  try {
    if (nowMs - fs.statSync(stamp).mtimeMs < PRUNE_INTERVAL_MS) return;
  } catch { /* 无 stamp → 首次清理 */ }
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(stamp, String(nowMs));
  } catch {
    return;
  }

  for (const sub of ['git', 'transcript', 'version', 'tasks']) {
    const dir = path.join(root, sub);
    let names: string[];
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const name of names) {
      const file = path.join(dir, name);
      try {
        const st = fs.statSync(file);
        if (!st.isFile()) continue;
        const age = nowMs - st.mtimeMs;
        const transient = sub === 'tasks' || name.endsWith('.refresh') || name.endsWith('.tmp');
        if (age > (transient ? PRUNE_TRANSIENT_MAX_AGE_MS : PRUNE_MAX_AGE_MS)) {
          fs.rmSync(file, { force: true });
        }
      } catch { /* ignore */ }
    }
  }
}

function main(): void {
  const taskFile = process.argv[2] || '';
  try {
    // 任务文件已由 refresh.ts 原子写入；读损坏时 markers 交给节流窗口 + prune 兜底。
    const tasks: RefreshTask[] = taskFile ? JSON.parse(fs.readFileSync(taskFile, 'utf8')) as RefreshTask[] : [];
    for (const task of tasks) {
      if (task.kind === 'git') {
        try { runGitTask(task.root, task.cacheFile); } catch { /* best effort */ }
        rmMarker(task.marker);
      } else if (task.kind === 'version') {
        try { runVersionTask(task.cacheFile, () => rmMarker(task.marker)); } catch { rmMarker(task.marker); }
      }
    }
  } catch {
    // 任务文件缺失 / 损坏：静默退出，仍走 finally 清理。
  } finally {
    if (taskFile) { try { fs.rmSync(taskFile, { force: true }); } catch { /* ignore */ } }
    try { pruneCaches(); } catch { /* best effort */ }
  }
}

if (require.main === module) main();
