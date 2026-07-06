import fs from 'fs';
import path from 'path';
import { cacheDir } from '../utils/paths';
import { queueRefreshTask } from './refresh';

const CACHE_TTL_MS = 4 * 3600 * 1000;
const REFRESH_THROTTLE_MS = 60 * 1000;
const cacheFile = path.join(cacheDir('version'), 'claude-code.json');
const refreshFile = path.join(cacheDir('version'), 'claude-code.refresh');

interface VersionCache {
  latest?: string;
  checkedAt?: number;
}

let memo: VersionCache | null = null;

function readCache(): VersionCache {
  if (memo) return memo;
  try {
    memo = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as VersionCache;
  } catch {
    memo = {};
  }
  return memo;
}

export function readCachedLatest(): string {
  return readCache().latest || '';
}

function shouldRefresh(): boolean {
  try {
    fs.mkdirSync(path.dirname(refreshFile), { recursive: true });
    fs.writeFileSync(refreshFile, String(Date.now()), { flag: 'wx' });
    return true;
  } catch {
    // Existing marker means another statusline process is already refreshing.
  }

  try {
    const st = fs.statSync(refreshFile);
    if (Date.now() - st.mtimeMs < REFRESH_THROTTLE_MS) return false;
    fs.rmSync(refreshFile, { force: true });
    fs.writeFileSync(refreshFile, String(Date.now()), { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

// 只入队不 spawn：实际后台进程由 cli 在 stdout 写出后统一 flush（见 runtime/refresh.ts）。
export function scheduleRefresh(): void {
  try {
    const age = Date.now() - (readCache().checkedAt || 0);
    if (age <= CACHE_TTL_MS) return;
    if (!shouldRefresh()) return;
    queueRefreshTask({ kind: 'version', cacheFile, marker: refreshFile });
  } catch {
    try { fs.rmSync(refreshFile, { force: true }); } catch { /* ignore */ }
    // Version refresh never affects statusline rendering.
  }
}
