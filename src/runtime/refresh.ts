// 后台刷新调度 —— 渲染期间各段只「入队」（调用方先抢占各自的 .refresh marker），
// stdout 写出后由 cli 调 flushRefreshTasks() 一次性 spawn 单个后台 helper（bg.js）。
// 合并为一次 spawn，避免冷缓存首帧连发两个后台进程；缓存都新鲜时 queue 为空、直接返回，
// 常规重绘不起任何后台进程。任务数据经 argv 直接传给 helper（不经 shell、无需临时文件）。
import fs from 'fs';
import path from 'path';

export interface GitRefreshTask {
  kind: 'git';
  root: string;
  cacheFile: string;
  marker: string;
}

export interface VersionRefreshTask {
  kind: 'version';
  cacheFile: string;
  marker: string;
}

export type RefreshTask = GitRefreshTask | VersionRefreshTask;

const queue: RefreshTask[] = [];

// 入队前调用方必须已独占抢到对应 marker（多进程节流语义保持不变）。
export function queueRefreshTask(task: RefreshTask): void {
  queue.push(task);
}

function removeMarkers(tasks: RefreshTask[]): void {
  for (const t of tasks) {
    try { fs.rmSync(t.marker, { force: true }); } catch { /* ignore */ }
  }
}

// 渲染输出完成后调用：把积累的刷新任务交给一个 detached 后台 helper 进程。
export function flushRefreshTasks(): void {
  if (!queue.length) return;
  const tasks = queue.splice(0);
  try {
    const helper = path.join(__dirname, 'bg.js');
    const payload = JSON.stringify(tasks);
    const { spawn } = require('child_process') as typeof import('child_process');
    // 直接 detached spawn node，不经 shell：
    // - 任务数据用一个 argv 参数（JSON）传给 helper；spawn 不走 shell，无引号/转义问题，
    //   因此不需要临时任务文件（历史上用过 task-*.json，是残留主因，已弃用）。
    // - detached 让 helper 脱离父进程独立跑完，并在结束时清理自己的 marker，避免残留。
    // - Windows 关键坑：绝不同时设 detached + windowsHide —— 两个 flag 冲突会意外弹出
    //   控制台黑窗。detached 单独即 DETACHED_PROCESS，本就不分配控制台，因此静默。
    const child = spawn(process.execPath, [helper, payload], {
      detached: true,
      stdio: 'ignore',
    });
    child.on('error', () => removeMarkers(tasks));
    child.unref();
  } catch {
    removeMarkers(tasks);
  }
}
