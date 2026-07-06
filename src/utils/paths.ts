import os from 'os';
import path from 'path';

function envPath(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value : null;
}

// ccglance 依赖 Claude Code 运行，缓存统一落在 Claude 的配置目录下（而非系统级 cache），
// 便于随 Claude 目录一起备份/迁移/清理：~/.claude/ccglance/<git|version|transcript>。
// 尊重 Claude Code 的 CLAUDE_CONFIG_DIR 覆盖（未设置时用 ~/.claude）。
function claudeConfigDir(): string {
  return envPath('CLAUDE_CONFIG_DIR') || path.join(os.homedir(), '.claude');
}

export function appCacheDir(): string {
  return path.join(claudeConfigDir(), 'ccglance');
}

export function cacheDir(...parts: string[]): string {
  return path.join(appCacheDir(), ...parts);
}
