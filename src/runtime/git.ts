// Git segment: one bounded git status call, cached on disk.
import fs from 'fs';
import path from 'path';
import { paint, seg, C } from '../render/colors';
import { cacheDir } from '../utils/paths';
import { queueRefreshTask } from './refresh';

const CACHE_DIR = cacheDir('git');
const DEFAULT_TTL_MS = 20 * 60 * 1000;
const REFRESH_THROTTLE_MS = 5000;

interface GitInfo {
  branch: string;
  glyph?: string;
  ahead: number;
  behind: number;
}

interface GitCache extends GitInfo {
  checkedAt: number;
}

export interface GitSegmentOptions {
  ttlMs?: number;
}

interface GitPaths {
  cwd: string;
  root: string | null;
  cacheFile: string;
  refreshFile: string;
}

function resolveGitPaths(cwd: string): GitPaths {
  const abs = path.resolve(cwd);
  const root = repoRootFor(abs);
  const key = hashString(root || abs);
  return {
    cwd: abs,
    root,
    cacheFile: path.join(CACHE_DIR, `git-${key}.json`),
    refreshFile: path.join(CACHE_DIR, `git-${key}.refresh`),
  };
}

function repoRootFor(cwd: string): string | null {
  try {
    let cur = path.resolve(cwd);
    while (true) {
      if (fs.existsSync(path.join(cur, '.git'))) return cur;
      const parent = path.dirname(cur);
      if (parent === cur) return null;
      cur = parent;
    }
  } catch {
    return null;
  }
}

function hashString(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

function readCache(paths: GitPaths): GitCache | null {
  try {
    const c = JSON.parse(fs.readFileSync(paths.cacheFile, 'utf8')) as GitCache;
    return c && c.branch && typeof c.checkedAt === 'number' ? c : null;
  } catch {
    return null;
  }
}

function shouldRefresh(paths: GitPaths): boolean {
  const marker = paths.refreshFile;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(marker, String(Date.now()), { flag: 'wx' });
    return true;
  } catch {
    // Existing marker means another statusline process is already refreshing.
  }

  try {
    const st = fs.statSync(marker);
    if (Date.now() - st.mtimeMs < REFRESH_THROTTLE_MS) return false;
    fs.rmSync(marker, { force: true });
    fs.writeFileSync(marker, String(Date.now()), { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

function readHeadFallback(root: string | null): GitInfo | null {
  if (!root) return null;
  try {
    const dotgit = path.join(root, '.git');
    let gitDir = dotgit;
    const st = fs.statSync(dotgit);
    if (st.isFile()) {
      const raw = fs.readFileSync(dotgit, 'utf8').trim();
      const m = /^gitdir:\s*(.+)$/i.exec(raw);
      if (!m) return null;
      gitDir = path.resolve(root, m[1]);
    }
    const headRaw = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(headRaw);
    const branch = ref ? ref[1] : headRaw.slice(0, 8);
    return branch ? { branch, ahead: 0, behind: 0 } : null;
  } catch {
    return null;
  }
}

function branchHintFallback(branchHint: string | undefined): GitInfo | null {
  const branch = branchHint && branchHint.trim();
  return branch ? { branch, ahead: 0, behind: 0 } : null;
}

// 只入队不 spawn：gitSegment 在渲染期间被调用，spawn 留到 stdout 写出后统一 flush。
function scheduleGitRefresh(paths: GitPaths): void {
  if (!paths.root || !shouldRefresh(paths)) return;
  queueRefreshTask({ kind: 'git', root: paths.root, cacheFile: paths.cacheFile, marker: paths.refreshFile });
}

function formatGit(info: GitInfo, icon: string, worktreeName?: string): string {
  const status: string[] = [];
  if (info.glyph) {
    const color = info.glyph === '⚠' ? C.gitConflict : info.glyph === '●' ? C.gitDirty : C.gitClean;
    status.push(paint(color, info.glyph));
  }
  if (info.ahead > 0) status.push(paint(C.gitAhead, '↑' + info.ahead));
  if (info.behind > 0) status.push(paint(C.gitBehind, '↓' + info.behind));
  const branch = seg(C.git, icon, info.branch);
  const details = status.length ? status.join(' ') : '';
  const worktree = worktreeName && worktreeName.trim() ? seg(C.wt, '🌲', worktreeName.trim()) : '';
  return [branch, details, worktree].filter(Boolean).join(' ');
}

// 分支 + 状态标记(✓/●/⚠)+ ↑ahead ↓behind；无分支或非仓库返回 null。
export function gitSegment(cwd: string, icon = '🌿', options: GitSegmentOptions = {}, branchHint?: string, worktreeName?: string): string | null {
  const ttlMs = typeof options.ttlMs === 'number' && options.ttlMs >= 0 ? options.ttlMs : DEFAULT_TTL_MS;
  const paths = resolveGitPaths(cwd);
  const fallback = branchHintFallback(branchHint) || readHeadFallback(paths.root);
  if (!fallback) return null;

  const cached = readCache(paths);
  const cacheFresh = cached && Date.now() - cached.checkedAt <= ttlMs;
  if (cacheFresh && cached.branch === fallback.branch) return formatGit(cached, icon, worktreeName);

  scheduleGitRefresh(paths);
  return formatGit(cacheFresh && cached.branch === fallback.branch ? cached : fallback, icon, worktreeName);
}
