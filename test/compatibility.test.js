const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ccglance-compat-test-'));
process.env.CLAUDE_CONFIG_DIR = CONFIG_DIR;
const { modelName } = require('../dist/utils/format');
const { getRecentStatus } = require('../dist/readers/transcript');

test('model window size prefers live capacity and falls back to legacy hints', () => {
  const plain = { id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5' };
  const legacy = { id: 'claude-opus-5-5[1m]', display_name: 'Claude Opus 5.5 (1M context)' };
  assert.equal(modelName(plain, 1000000), 'Opus 5.5 1M');
  assert.equal(modelName(plain, 1500000), 'Opus 5.5 1.5M');
  assert.equal(modelName(legacy, 2000000), 'Opus 5.5 2M');
  assert.equal(modelName(legacy, 200000), 'Opus 5.5');
  assert.equal(modelName(legacy, 1000000), 'Opus 5.5 1M');
  for (const missing of [undefined, null, 0, -1, NaN, Infinity]) {
    assert.equal(modelName(legacy, missing), 'Opus 5.5 1M');
  }
  assert.equal(modelName({ id: 'claude-opus-5-5[1m]' }), 'Opus 5.5 1M');
  assert.equal(modelName({ display_name: 'Claude Opus 5.5 (1M context)' }), 'Opus 5.5 1M');
  assert.equal(modelName({ id: 'custom-llm', display_name: 'My Model' }, 1000000), 'My Model 1M');
});

test('transcript tracks thinking, tools, completion and interruption across redraws', () => {
  const file = path.join(CONFIG_DIR, 'status-sequence.jsonl');
  const entries = [];
  const append = (entry, expected) => {
    entries.push(entry);
    fs.writeFileSync(file, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
    assert.deepEqual(getRecentStatus(file), expected);
    assert.deepEqual(getRecentStatus(file), expected, 'unchanged transcript reuses its status');
  };
  append({ type: 'user', message: { content: 'start' } }, { state: 'thinking' });
  append({ type: 'assistant', message: { stop_reason: null, content: [{ type: 'thinking', thinking: 'work' }] } }, { state: 'thinking' });
  append({ type: 'assistant', message: { content: [{ type: 'redacted_thinking', data: 'redacted' }] } }, { state: 'thinking' });
  append({ type: 'assistant', message: { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'Read' }] } }, { state: 'tool', tool: 'Read' });
  append({ type: 'user', message: { content: [{ type: 'tool_result', content: 'result' }] } }, { state: 'working' });
  append({ type: 'assistant', message: { stop_reason: null, content: [{ type: 'text', text: 'done' }] } }, { state: 'idle' });
  append({ type: 'user', isMeta: true, message: { content: 'system note' } }, { state: 'idle' });
  append({ type: 'user', message: { content: 'next prompt' } }, { state: 'thinking' });
  append({ type: 'user', isMeta: true, message: { content: '[Request interrupted by user]' } }, { state: 'paused' });
  append({ type: 'assistant', message: { stop_reason: 'end_turn', content: [] } }, { state: 'idle' });
  append({ type: 'assistant', message: { stop_reason: 'stop_sequence', content: [] } }, { state: 'idle' });
  append({ type: 'assistant', message: { stop_reason: null, content: 'legacy reply' } }, { state: 'idle' });
  append({ type: 'assistant', message: { content: [{ type: 'text', text: '' }] } }, { state: 'thinking' });
  append({ type: 'system', subtype: 'api_request', request: { tools: [] } }, { state: 'thinking' });
});

test('upgrading invalidates old status caches even when the transcript is unchanged', () => {
  const file = path.join(CONFIG_DIR, 'old-cache.jsonl');
  const dir = path.join(CONFIG_DIR, 'ccglance', 'transcript');
  const previousFiles = new Set(fs.existsSync(dir) ? fs.readdirSync(dir) : []);
  fs.writeFileSync(file, JSON.stringify({ type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'work' }] } }) + '\n');
  assert.deepEqual(getRecentStatus(file), { state: 'thinking' });
  const name = fs.readdirSync(dir).find(name => !previousFiles.has(name));
  assert.ok(name);
  const cacheFile = path.join(dir, name);
  const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  delete cache.version;
  cache.status = { state: 'idle' };
  fs.writeFileSync(cacheFile, JSON.stringify(cache));
  assert.deepEqual(getRecentStatus(file), { state: 'thinking' });
});
