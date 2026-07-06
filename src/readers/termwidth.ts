// 终端宽度探测 —— 动态自适应布局的宽度来源，按优先级多级回退。
//
// 难点：Claude Code ≥2.1.139 常以「管道 stdio、无控制 TTY」方式 spawn statusline，
// 导致 process.stdout.columns 为 undefined。因此优先用 Claude Code 注入的 COLUMNS 环境
// 变量（2.1.153+，零成本），仅在都拿不到时才 fork 子进程兜底（Windows 跳过）。

function parsePos(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Unix 兜底：tput / stty（仅在无 COLUMNS 且无 TTY 时才走到，带超时避免挂起）
function unixWidth(): number | null {
  const tries = ['tput cols', 'stty size'];
  const { execSync } = require('child_process') as typeof import('child_process');
  for (const cmd of tries) {
    try {
      const out = execSync(`${cmd} 2>/dev/null`, {
        encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 400, windowsHide: true,
      }).trim();
      // stty size 输出 "行 列"，tput cols 输出 "列"
      const n = cmd.startsWith('stty') ? parsePos(out.split(/\s+/)[1]) : parsePos(out);
      if (n) return n;
    } catch { /* try next */ }
  }
  return null;
}

// 探测终端宽度。前 3 步零成本；第 4 步(fork)仅在前面全失败时执行。
export function detectWidth(fallback: number): number {
  // 1. 显式覆盖（调试 / 特殊 spawn 场景）
  const override = parsePos(process.env.CCGLANCE_WIDTH);
  if (override) return override;
  // 2. Claude Code 注入的 COLUMNS（首选，零成本）
  const cols = parsePos(process.env.COLUMNS);
  if (cols) return cols;
  // 3. 有 TTY 时的 stdout 列数
  const out = process.stdout as { columns?: number };
  if (out && typeof out.columns === 'number' && out.columns > 0) return out.columns;
  // 4. Unix 子进程兜底（Windows 跳过，避免无谓 fork）
  if (process.platform !== 'win32') {
    const w = unixWidth();
    if (w) return w;
  }
  // 5. 默认兜底宽度
  return fallback;
}
