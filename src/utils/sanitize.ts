const MAX_TEXT_CHARS = 200;

export function sanitizeText(value: string): string {
  let s = String(value);
  s = s
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)?/g, '')
    .replace(/\x9d[^\x07\x9c]*(?:\x07|\x9c)?/g, '')
    .replace(/\x1b[P^_][\s\S]*?(?:\x1b\\|$)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x9b[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[@-Z\\-_]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');

  const chars = Array.from(s);
  return chars.length > MAX_TEXT_CHARS ? chars.slice(0, MAX_TEXT_CHARS - 3).join('') + '...' : s;
}
