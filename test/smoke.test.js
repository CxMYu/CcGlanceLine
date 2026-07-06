const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');

function env() {
  return { ...process.env, CCGLANCE_WIDTH: '160' };
}

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function runGit(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
}

function renderForDir(dir) {
  const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'api.json'), 'utf8'));
  delete data.version;
  data.workspace = { current_dir: dir };
  return renderData(data);
}

function renderData(data) {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'dist', 'cli.js')], {
    input: JSON.stringify(data),
    encoding: 'utf8',
    env: env(),
    windowsHide: true,
  });
  assert.equal(result.status, 0);
  return stripAnsi(result.stdout);
}

test('cli renders valid stdin', () => {
  const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'api.json'), 'utf8'));
  delete data.version;
  const input = JSON.stringify(data);
  const result = spawnSync(process.execPath, [path.join(ROOT, 'dist', 'cli.js')], {
    input,
    encoding: 'utf8',
    env: env(),
    windowsHide: true,
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Sonnet 4\.5/);
  assert.equal(result.stderr, '');
});

test('cli strips terminal control sequences from rendered text', () => {
  const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'api.json'), 'utf8'));
  delete data.version;
  data.session_name = 'ok\u001b]52;c;QUJD\u0007bad\nnext';
  const result = spawnSync(process.execPath, [path.join(ROOT, 'dist', 'cli.js')], {
    input: JSON.stringify(data),
    encoding: 'utf8',
    env: env(),
    windowsHide: true,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.includes('\u001b]52'), false);
  assert.equal(result.stdout.includes('\u0007'), false);
  assert.match(result.stdout, /okbad next/);
});

test('cli exits quietly for invalid stdin', () => {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'dist', 'cli.js')], {
    input: '{',
    encoding: 'utf8',
    env: env(),
    windowsHide: true,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('preview covers default display segments without fake optional fields', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ccglance-preview-test-'));
  const result = spawnSync(process.execPath, [path.join(ROOT, 'dist', 'cli.js'), 'preview'], {
    encoding: 'utf8',
    env: env(),
    cwd,
    windowsHide: true,
  });
  assert.equal(result.status, 0);
  const out = stripAnsi(result.stdout);
  for (const expected of [
    'Opus 4.8 1M',
    'high',
    '✅',
    'fast',
    '💾',
    'Hour',
    'Week',
    path.basename(cwd),
    '🌿 main 🌲 main',
    '🌲 main',
    '$0.123',
    'v2.0.1',
  ]) {
    assert.match(out, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('cache segment renders zero values when usage fields are missing', () => {
  const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'api.json'), 'utf8'));
  delete data.version;
  data.context_window = {
    context_window_size: 1000000,
    total_input_tokens: 0,
    total_output_tokens: 0,
    used_percentage: 0,
    remaining_percentage: 100,
  };
  const out = renderData(data);
  assert.match(out, /💾 0% · ↓0 · ↑0/);
});

test('model display prefers stdin display_name and falls back to readable id', () => {
  const cases = [
    [{ id: 'glm-4.5', display_name: 'Zhipu GLM 4.5' }, 'Zhipu GLM 4.5'],
    [{ id: 'moonshotai/kimi-k2-turbo-preview', display_name: 'Kimi Latest' }, 'Kimi Latest'],
    [{ id: 'qwen3-coder', display_name: '' }, 'Qwen3 Coder'],
    [{ id: 'deepseek/deepseek-r1', display_name: '' }, 'DeepSeek R1'],
    [{ id: 'minimax/minimax-2-1', display_name: '' }, 'MiniMax 2.1'],
    [{ id: 'claude-opus-4-8[1m]', display_name: '' }, 'Opus 4.8 1M'],
  ];

  for (const [model, expected] of cases) {
    const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'api.json'), 'utf8'));
    delete data.version;
    data.model = model;
    assert.match(renderData(data), new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('git branch updates immediately after branch switch', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ccglance-branch-test-'));
  const init = runGit(['init', '--quiet'], repo);
  if (init.status !== 0) {
    t.skip('git is not available');
    return;
  }

  const firstBranch = runGit(['symbolic-ref', '--short', 'HEAD'], repo).stdout.trim() || 'main';
  assert.match(renderForDir(repo), new RegExp(`\\b${firstBranch}\\b`));

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 900);

  const nextBranch = `ccglance-${process.pid}-${Date.now()}`;
  const checkout = runGit(['checkout', '-b', nextBranch, '--quiet'], repo);
  assert.equal(checkout.status, 0, checkout.stderr);

  const afterSwitch = renderForDir(repo);
  assert.match(afterSwitch, /ccglance-/);
});

test('git branch prefers stdin worktree branch when provided', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ccglance-stdin-branch-test-'));
  const init = runGit(['init', '--quiet'], repo);
  if (init.status !== 0) return;

  const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'api.json'), 'utf8'));
  delete data.version;
  data.workspace = { current_dir: repo };
  data.worktree = { branch: 'stdin-branch', name: 'stdin-worktree' };

  const out = renderData(data);
  assert.match(out, /🌿 stdin-branch 🌲 stdin-worktree/);
});
