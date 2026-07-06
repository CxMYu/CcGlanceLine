const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const SNAPSHOTS = path.join(__dirname, 'snapshots');
const FIXED_NOW_MS = 1893456000000;
process.env.CCGLANCE_WIDTH = '180';
// 隔离缓存目录（须在 require dist 之前设置：部分缓存路径在模块加载时固化）。
process.env.CLAUDE_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ccglance-render-config-'));

const { render } = require(path.join(ROOT, 'dist', 'render'));
const { DEFAULT_SPEC } = require(path.join(ROOT, 'dist', 'defaults'));

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
}

function snapshot(name) {
  return fs.readFileSync(path.join(SNAPSHOTS, name), 'utf8');
}

function visibleAnsi(s) {
  return s.replace(/\x1b/g, '\\x1b');
}

function withIdleTranscript(data) {
  return {
    ...data,
    transcript_path: path.join(FIXTURES, 'transcripts', 'idle.jsonl'),
  };
}

test('subscription fixture matches snapshot', () => {
  const actual = visibleAnsi(render(withIdleTranscript(fixture('subscription.json')), DEFAULT_SPEC, { nowMs: FIXED_NOW_MS, latest: '2.1.153' }));
  assert.equal(actual, snapshot('subscription.txt'));
});

test('api fixture hides subscription-only quota row', () => {
  const actual = visibleAnsi(render(withIdleTranscript(fixture('api.json')), DEFAULT_SPEC, { nowMs: FIXED_NOW_MS, latest: '2.1.153' }));
  assert.equal(actual, snapshot('api.txt'));
});

test('large context fixture matches danger snapshot', () => {
  const actual = visibleAnsi(render(withIdleTranscript(fixture('large-context.json')), DEFAULT_SPEC, { nowMs: FIXED_NOW_MS, latest: '2.1.153' }));
  assert.equal(actual, snapshot('large-context.txt'));
});

test('missing fields degrade without throwing', () => {
  assert.doesNotThrow(() => render(fixture('missing-fields.json'), DEFAULT_SPEC, { nowMs: FIXED_NOW_MS }));
});
