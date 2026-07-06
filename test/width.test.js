const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const { stringWidth, stripAnsi } = require(path.join(ROOT, 'dist', 'utils', 'width'));

test('stripAnsi removes color escape sequences', () => {
  assert.equal(stripAnsi('\x1b[92m✅\x1b[0m'), '✅');
});

test('status emoji keep expected display width', () => {
  for (const glyph of ['✅', '⏸️', '💭', '⚙️', '🔧', '🌑', '🌒', '🌓', '🌔', '🌕']) {
    assert.equal(stringWidth(glyph), 2, glyph);
  }
});

test('ascii git glyphs stay single column', () => {
  for (const glyph of ['✓', '●', '↑', '↓']) {
    assert.equal(stringWidth(glyph), 1, glyph);
  }
});
