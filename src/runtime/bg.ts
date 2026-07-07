// 后台刷新 helper —— 由 refresh.ts 以 detached 进程启动，绝不被状态栏进程等待。
// 任务列表从 argv[2]（JSON）读入，全部尽力而为、静默失败：
//   git     —— 单次有界 `git status --porcelain=v2 --branch`，解析后原子写缓存
//   version —— 拉 npm registry 的 Claude Code 最新版本，原子写缓存
// 每个任务无论成败都要移除自己的 .refresh marker，否则只能等节流窗口过期。
// 每次运行还顺手清理孤儿产物：过期的 .refresh / .tmp（及历史遗留的 tasks/ 目录）。
import fs from 'fs';
import path from 'path';
import type { RefreshTask } from './refresh';
import { appCacheDir } from '../utils/paths';

const GIT_TIMEOUT_MS = 700;

// 孤儿瞬时产物阈值：.refresh/.tmp 本应几秒内被删（helper 最长约 5s）；超过此值即视为
// 夭折进程的残留。每次运行开头 + 结尾各清一次，故取较短的 2 分钟让残留更快被接管清理。
const STALE_TRANSIENT_MS = 2 * 60 * 1000;
// 死缓存清理：缓存 key 是仓库/transcript 路径哈希，临时目录一去不返时对应 json 便成死条目。
// 每天最多清一次（stamp 节流），删除长期未刷新的缓存 json（活跃条目会被刷新持续续命）。
const PRUNE_INTERVAL_MS = 24 * 3600 * 1000;
const PRUNE_MAX_AGE_MS = 30 * 24 * 3600 * 1000;

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

// 每次运行都做的轻清理：删除过期的孤儿瞬时产物（.refresh / .tmp），以及历史遗留的
// tasks/ 目录内容。成本很低（这些目录文件很少），能让残留不再累积。
function pruneStaleTransient(nowMs = Date.now()): void {
  const root = appCacheDir();
  for (const sub of ['git', 'version', 'transcript', 'tasks']) {
    const dir = path.join(root, sub);
    let names: string[];
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const name of names) {
      // tasks/ 已弃用：其中任何文件都算历史遗留；其他目录只清 .refresh / .tmp 瞬时产物。
      if (sub !== 'tasks' && !name.endsWith('.refresh') && !name.endsWith('.tmp')) continue;
      const file = path.join(dir, name);
      try {
        if (nowMs - fs.statSync(file).mtimeMs > STALE_TRANSIENT_MS) fs.rmSync(file, { force: true });
      } catch { /* ignore */ }
    }
    if (sub === 'tasks') { try { fs.rmdirSync(dir); } catch { /* 非空/不存在都忽略 */ } }
  }
}

// 每天最多一次（stamp 节流）：删除长期未刷新的死缓存 json。
function pruneDeadCaches(nowMs = Date.now()): void {
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

  for (const sub of ['git', 'transcript', 'version']) {
    const dir = path.join(root, sub);
    let names: string[];
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const file = path.join(dir, name);
      try {
        if (nowMs - fs.statSync(file).mtimeMs > PRUNE_MAX_AGE_MS) fs.rmSync(file, { force: true });
      } catch { /* ignore */ }
    }
  }
}

function main(): void {
  const payload = process.argv[2] || '';
  // 开头先接管清理上一轮遗留的孤儿（含被强杀进程没来得及删的 marker）：即便本次任务中途
  // 被杀、finally 没跑到，这些残留也会在下一次后台刷新一启动时被清掉，不会长期堆积。
  try { pruneStaleTransient(); } catch { /* best effort */ }
  try {
    const tasks: RefreshTask[] = payload ? JSON.parse(payload) as RefreshTask[] : [];
    for (const task of tasks) {
      if (task.kind === 'git') {
        try { runGitTask(task.root, task.cacheFile); } catch { /* best effort */ }
        rmMarker(task.marker);
      } else if (task.kind === 'version') {
        try { runVersionTask(task.cacheFile, () => rmMarker(task.marker)); } catch { rmMarker(task.marker); }
      }
    }
  } catch {
    // payload 缺失 / 损坏：静默退出，仍走 finally 清理。
  } finally {
    try { pruneStaleTransient(); } catch { /* best effort */ }
    try { pruneDeadCaches(); } catch { /* best effort */ }
  }
}

if (require.main === module) main();
