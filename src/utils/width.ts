// 显示宽度计算 —— 响应式折行的基础。零依赖，按项目内置图标做保守估算。
//   stripAnsi：去掉 ANSI 颜色转义（不占显示宽度）。
//   stringWidth：CJK/emoji 记 2 列，VS16/ZWJ/组合符记 0 列，其余 1 列。

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}

// 记 0 宽的码点：变体选择符(FE00–FE0F)、ZWJ(200D)、组合用记号(0300–036F)、
// 零宽空格/连接符(200B–200F)。
function isZeroWidth(cp: number): boolean {
  return (
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0xfe00 && cp <= 0xfe0f) ||
    cp === 0x2060 ||
    cp === 0xfeff
  );
}

function isVariationSelector(cp: number): boolean {
  return cp >= 0xfe00 && cp <= 0xfe0f;
}

function isCjkWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||   // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0x303e) ||   // CJK 部首 / 康熙
    (cp >= 0x3041 && cp <= 0x33ff) ||   // 平假名/片假名/CJK 符号
    (cp >= 0x3400 && cp <= 0x4dbf) ||   // CJK 扩展 A
    (cp >= 0x4e00 && cp <= 0x9fff) ||   // CJK 统一表意
    (cp >= 0xa000 && cp <= 0xa4cf) ||   // 彝文
    (cp >= 0xac00 && cp <= 0xd7a3) ||   // 谚文音节
    (cp >= 0xf900 && cp <= 0xfaff) ||   // CJK 兼容表意
    (cp >= 0xfe30 && cp <= 0xfe4f) ||   // CJK 兼容形式
    (cp >= 0xff00 && cp <= 0xff60) ||   // 全角 ASCII
    (cp >= 0xffe0 && cp <= 0xffe6) ||   // 全角符号
    (cp >= 0x20000 && cp <= 0x3fffd)    // CJK 扩展 B+
  );
}

function isEmojiPresentation(cp: number): boolean {
  return (
    (cp >= 0x1f300 && cp <= 0x1faff) || // emoji & 符号扩展
    (cp >= 0x1f000 && cp <= 0x1f2ff) || // 麻将/多米诺/扑克/字母符号
    cp === 0x231a || cp === 0x231b ||
    (cp >= 0x23e9 && cp <= 0x23ec) ||
    cp === 0x23f0 || cp === 0x23f3 ||
    cp === 0x25fd || cp === 0x25fe ||
    cp === 0x2614 || cp === 0x2615 ||
    (cp >= 0x2648 && cp <= 0x2653) ||
    cp === 0x267f || cp === 0x2693 || cp === 0x26a1 ||
    cp === 0x26aa || cp === 0x26ab ||
    cp === 0x26bd || cp === 0x26be ||
    cp === 0x26c4 || cp === 0x26c5 || cp === 0x26ce ||
    cp === 0x26d4 || cp === 0x26ea ||
    cp === 0x26f2 || cp === 0x26f3 || cp === 0x26f5 ||
    cp === 0x26fa || cp === 0x26fd ||
    cp === 0x2705 || cp === 0x270a || cp === 0x270b ||
    cp === 0x2728 || cp === 0x274c || cp === 0x274e ||
    (cp >= 0x2753 && cp <= 0x2755) ||
    cp === 0x2757 ||
    (cp >= 0x2795 && cp <= 0x2797) ||
    cp === 0x27b0 || cp === 0x27bf ||
    cp === 0x2b50 || cp === 0x2b55
  );
}

function isEmojiCapable(cp: number): boolean {
  return isEmojiPresentation(cp) ||
    cp === 0x23f1 || cp === 0x23f2 || cp === 0x23f8 ||
    (cp >= 0x2600 && cp <= 0x27bf);
}

// 记 2 宽的码点：东亚全角/宽字符 + emoji presentation。
function isWide(cp: number): boolean {
  return (
    isCjkWide(cp) ||
    isEmojiPresentation(cp)
  );
}

export function stringWidth(s: string): number {
  const plain = stripAnsi(s);
  let w = 0;
  const chars = Array.from(plain);
  for (let i = 0; i < chars.length; i++) {
    const cp = chars[i].codePointAt(0);
    if (cp == null) continue;
    if (isZeroWidth(cp)) continue;
    const next = chars[i + 1]?.codePointAt(0);
    if (next != null && isVariationSelector(next) && isEmojiCapable(cp)) {
      w += 2;
      i++;
      continue;
    }
    w += isWide(cp) ? 2 : 1;
  }
  return w;
}
