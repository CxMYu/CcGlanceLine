// 响应式多行布局引擎。
//   输入：已渲染的逻辑行（每行是若干段的字符串，已过滤 null/空），join 用的分隔符，终端宽度，模式。
//   responsive：每个逻辑行按显示宽度贪心折成多物理行（行末不留分隔符）；组间强制换行。
//   fixed：每个逻辑行原样一行，不折。
import { stringWidth } from '../utils/width';
import type { LayoutMode } from '../types';

// 终端宽度探测已统一到 reader/termwidth.ts 的 detectWidth()。

export function layout(rows: string[][], sep: string, columns: number, mode: LayoutMode): string[] {
  const sepW = stringWidth(sep);
  const lines: string[] = [];

  for (const row of rows) {
    const segs = row.filter((s) => s && s.length > 0);
    if (segs.length === 0) continue;

    if (mode === 'fixed') {
      lines.push(segs.join(sep));
      continue;
    }

    // responsive：贪心装箱。
    // 最小保证「一行一个功能」：当前行为空时（cur.length===0）无条件放入该段，
    // 即使单段比整行还宽也让它独占一行 —— 宁可它自己占一行，也不与他段挤在一起被挡住。
    let cur: string[] = [];
    let curW = 0;
    for (const s of segs) {
      const w = stringWidth(s);
      const add = cur.length ? sepW + w : w;
      if (cur.length > 0 && curW + add > columns) {
        lines.push(cur.join(sep));
        cur = [s];
        curW = w;
      } else {
        cur.push(s);
        curW += add;
      }
    }
    if (cur.length > 0) lines.push(cur.join(sep));
  }

  return lines;
}
