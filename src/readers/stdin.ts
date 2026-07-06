// stdin 读取 —— Claude Code 每次重绘把状态栏 JSON 从 stdin 管道传入。
// 一次性同步读取；解析失败返回 null（调用方据此静默退出，绝不影响 CLI）。
import fs from 'fs';
import type { StdinData } from '../types';

export function readStdinData(): StdinData | null {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8')) as StdinData;
  } catch {
    return null;
  }
}
