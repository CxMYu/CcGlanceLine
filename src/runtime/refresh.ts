// 后台刷新调度 —— 渲染期间各段只「入队」（调用方先抢占各自的 .refresh marker），
// stdout 写出后由 cli 调 flushRefreshTasks() 一次性 spawn 单个 detached helper（bg.js）。
//
// 为什么不各自直接 spawn：Windows 上发起一个 node.exe 子进程的同步成本很高
// （CreateProcess + 杀软扫描，实测 ~80-110ms），冷缓存首帧会连发两个，直接拖慢状态栏。
// 合并为一次，并在 Windows 上经 cmd `start /b` 蹦床发起（实测 ~17ms）：node 的真实
// 启动成本由蹦床在本进程退出后承担，不再占用状态栏进程的生命周期。
// 任务负载写入 ~/.claude/ccglance/tasks/task-*.json，helper 只接收任务文件路径。
import fs from 'fs';
import path from 'path';
import { cacheDir } from '../utils/paths';

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

function writeTaskFile(tasks: RefreshTask[]): string {
  const dir = cacheDir('tasks');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `task-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(tasks));
  fs.renameSync(tmp, file);
  return file;
}

function quoteCmdArg(s: string): string {
  return `"${s}"`;
}

// 渲染输出完成后调用：把积累的刷新任务交给一个 detached 后台 helper 进程。
export function flushRefreshTasks(): void {
  if (!queue.length) return;
  const tasks = queue.splice(0);
  let taskFile = '';
  try {
    const helper = path.join(__dirname, 'bg.js');
    taskFile = writeTaskFile(tasks);
    const { spawn } = require('child_process') as typeof import('child_process');
    // Windows：node.exe 的 CreateProcess 同步成本很高（杀软扫描），改用 cmd `start /b`
    // 蹦床（发起 ~17ms），真正的 node 启动开销由蹦床在本进程退出后承担。
    // 任务本身在文件里；cmd 只需要转发 node/helper/taskFile 三个路径参数。
    const child = process.platform === 'win32'
      ? spawn('cmd.exe',
        ['/d', '/s', '/c', `start "" /b ${quoteCmdArg(process.execPath)} ${quoteCmdArg(helper)} ${quoteCmdArg(taskFile)}`],
        { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true })
      : spawn(process.execPath, [helper, taskFile], { detached: true, stdio: 'ignore' });
    child.on('error', () => {
      try { fs.rmSync(taskFile, { force: true }); } catch { /* ignore */ }
      removeMarkers(tasks);
    });
    child.unref();
  } catch {
    if (taskFile) {
      try { fs.rmSync(taskFile, { force: true }); } catch { /* ignore */ }
    }
    removeMarkers(tasks);
  }
}
