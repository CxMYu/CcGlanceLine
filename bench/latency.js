#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(ROOT, 'test', 'fixtures');
const ITERATIONS = Number.parseInt(process.env.CCGLANCE_BENCH_ITERATIONS || '25', 10);
const COLD_GIT_ITERATIONS = Math.min(10, ITERATIONS);

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
}

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function summarize(times) {
  const sorted = [...times].sort((a, b) => a - b);
  return {
    min: sorted[0],
    p50: percentile(sorted, 0.50),
    p95: percentile(sorted, 0.95),
    avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
  };
}

function fmt(n) {
  return `${n.toFixed(1)}ms`;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function measure(label, args, options) {
  const iterations = options.iterations || ITERATIONS;
  const times = [];
  for (let i = 0; i < iterations; i++) {
    if (options.beforeEach) options.beforeEach(i);
    const input = typeof options.input === 'function' ? options.input(i) : options.input || '';
    const t0 = process.hrtime.bigint();
    const result = spawnSync(process.execPath, args, {
      input,
      encoding: 'utf8',
      env: options.env,
      windowsHide: true,
    });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (result.status !== 0) {
      throw new Error(`${label} failed: ${result.stderr || result.stdout}`);
    }
    times.push(ms);
    if (options.afterEach) options.afterEach(i);
  }
  return [label, summarize(times)];
}

function makeGitRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccglance-git-bench-'));
  const git = spawnSync('git', ['init', '--quiet', dir], { encoding: 'utf8', windowsHide: true });
  if (git.status !== 0) return null;
  fs.writeFileSync(path.join(dir, 'file.txt'), 'bench\n');
  return dir;
}

function run() {
  const sub = readJson('subscription.json');
  sub.transcript_path = path.join(FIXTURES, 'transcripts', 'idle.jsonl');
  const api = readJson('api.json');
  delete sub.version;
  delete api.version;
  // 隔离缓存目录：跑分用的临时仓库绝不能把缓存写进真实的 ~/.claude/ccglance/。
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccglance-bench-config-'));
  const benchEnv = { ...process.env, CCGLANCE_WIDTH: '180', CLAUDE_CONFIG_DIR: configDir };

  const cases = [
    measure('node empty', ['-e', ''], { env: process.env }),
    measure('api stdin, no git', [path.join(ROOT, 'dist', 'cli.js')], {
      input: JSON.stringify(api),
      env: benchEnv,
    }),
    measure('subscription + transcript, no git', [path.join(ROOT, 'dist', 'cli.js')], {
      input: JSON.stringify(sub),
      env: benchEnv,
    }),
  ];

  const repo = makeGitRepo();
  if (repo) {
    const gitInput = { ...api, workspace: { current_dir: repo } };
    spawnSync(process.execPath, [path.join(ROOT, 'dist', 'cli.js')], {
      input: JSON.stringify(gitInput),
      encoding: 'utf8',
      env: benchEnv,
      windowsHide: true,
    });
    sleep(900);
    cases.push(measure('git warm cache', [path.join(ROOT, 'dist', 'cli.js')], {
      input: JSON.stringify(gitInput),
      env: benchEnv,
    }));

    let coldInput = JSON.stringify(gitInput);
    cases.push(measure('git cold fallback', [path.join(ROOT, 'dist', 'cli.js')], {
      input: () => coldInput,
      env: benchEnv,
      iterations: COLD_GIT_ITERATIONS,
      beforeEach: () => {
        const coldRepo = makeGitRepo();
        if (coldRepo) coldInput = JSON.stringify({ ...api, workspace: { current_dir: coldRepo } });
      },
      afterEach: () => sleep(300),
    }));
  }

  console.log(`ccglance latency benchmark (${ITERATIONS} iterations; git cold ${COLD_GIT_ITERATIONS})`);
  console.log('case                         min      p50      p95      avg');
  for (const [label, s] of cases) {
    console.log(`${label.padEnd(28)} ${fmt(s.min).padStart(8)} ${fmt(s.p50).padStart(8)} ${fmt(s.p95).padStart(8)} ${fmt(s.avg).padStart(8)}`);
  }
}

run();
