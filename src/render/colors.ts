// 上色与配色 —— ANSI 16-color，固定内置风格。
import { sanitizeText } from '../utils/sanitize';

const R = '\x1b[0m';

const GREEN = 92;
const RED = 91;
const YELLOW = 33;
const CYAN = 96;
const BLUE = 94;
const MAGENTA = 95;
const WHITE = 37;

export const paint = (code: number, s: string, bold = false): string =>
  `\x1b[${bold ? '1;' : ''}${code}m${sanitizeText(s)}${R}`;

export const C = {
  // 第一行（运行时）
  model: CYAN, effort: YELLOW, fast: GREEN,
  ctx: MAGENTA, cache: GREEN, style: CYAN,
  rate: CYAN,                       // rate_limits 主图标/标签
  rateReset: YELLOW,                // 配额重置时间
  safe: GREEN,                      // 正常/成功/新增
  caution: YELLOW,                  // 阈值染色：警戒
  danger: RED,                      // 阈值染色：危险/删除
  idle: GREEN,                      // 状态：空闲
  paused: YELLOW,                   // 状态：用户暂停/中断
  working: CYAN,                    // 状态：工作中/工具返回后处理
  stTool: BLUE,                     // 状态：调用工具
  stThink: MAGENTA,                 // 状态：等待模型/生成中
  // 第二行（项目 / 会话）
  name: MAGENTA, dirIcon: YELLOW, dirText: GREEN, git: WHITE,
  gitClean: GREEN, gitDirty: BLUE, gitConflict: RED,
  gitAhead: GREEN, gitBehind: BLUE,
  sess: CYAN, add: GREEN, del: RED,
  cost: YELLOW,                     // 美元成本
  wt: GREEN,                        // worktree
  ver: CYAN, upd: RED,              // 版本：默认同 style
};

export const SEP = paint(WHITE, ' | ');      // 段间白色分隔符（两侧各一空格）
export const DOT = ' · ';                     // 项内值与值分隔（中点，两侧各一空格）

// “图标 文字”同色段
export const seg = (
  color: number,
  icon: string,
  text: string,
  iconColor = color,
  textColor = color,
  bold = false,
): string => paint(iconColor, icon, bold) + ' ' + paint(textColor, text, bold);
