# 开发

ccglance 的构建、测试、基准、代码结构、贡献范式与缓存内部细节。

[← 返回 README](../README.zh-CN.md)

## 源码构建

```bash
git clone https://github.com/CxMYu/CcGlanceLine.git
cd CcGlanceLine
npm install              # 安装 devDeps，并执行 prepare -> build

npm run build            # 编译 src/ → dist/
npm run typecheck        # tsc --noEmit(strict)
npm test                 # 构建 + node:test fixtures/snapshots/smoke
npm run benchmark        # 构建 + 启动耗时基准
ccglance preview         # 预览全局/软链命令

# 用样例 stdin 冒烟测试:
printf '%s' '{"model":{"display_name":"Claude Opus 4.8 (1M context)","id":"claude-opus-4-8[1m]"}}' | node dist/cli.js
```

本地试用建议构建后执行 `npm link`，然后在 Claude Code 里配置 `"command": "ccglance"`。不做全局链接时，直接配置 `node /绝对路径/ccglance/dist/cli.js`。

## 验证

- `test/fixtures/` 放订阅、API 风格、字段缺失、高上下文占用等 stdin 样例。
- `test/snapshots/` 固定 ANSI 彩色渲染结果，图标、间距、颜色、换行变化都必须是有意修改。
- `test/*.test.js` 使用 Node 内置 `node:test`，不额外引入运行时测试框架。
- `bench/latency.js` 会同时测空 Node 基线、无 git、订阅+transcript、git warm cache、
  git cold fallback。Windows 上空 Node 冷启动通常占大头，判断 ccglance 成本时应看相对基线的增量。

## Agent 构建范式

- `src/` 是唯一源码；不要手改 `dist/`，用 `npm run build` 重新生成。
- 保持固定内置风格：不要加用户配置读取、外部样式文件、运行时样式发现。
- 保持运行时零依赖；新增依赖只能是构建期依赖，并说明必要性。
- 改代码后执行 `npm run typecheck`、`npm run build`、`ccglance preview`。
- 修改图标或间距时，检查去掉 ANSI 后的 preview，并用至少一个合成 stdin 覆盖被改的 segment。

## 代码结构

```text
src/
  cli.ts              # 命令入口：preview / statusLine stdin
  defaults/           # 固定内置风格与显示顺序
  readers/            # stdin、transcript 尾读、终端宽度
  render/             # 颜色、图标、布局、最终渲染
  segments/           # 每个显示项的渲染逻辑
  runtime/            # git、Claude Code 版本缓存等运行时能力
  types/              # Claude Code stdin 与渲染类型
  utils/              # 格式化、显示宽度计算
test/
  fixtures/           # 代表性的 Claude Code stdin 和 transcript 数据
  snapshots/          # 固定渲染输出基准
bench/
  latency.js          # 启动耗时与缓存路径基准
```

发布到 npm 的只有编译后的 `dist/`；`npm run build` 会先清空 `dist` 再编译，避免旧平铺产物混入包里。

## git 缓存内部细节

- 缓存 key 使用 Git worktree 根目录，同一仓库里的多个 Claude Code 终端共享一份 git 缓存。
- 分支名优先使用 Claude Code stdin 里的 `worktree.branch`；没有该字段时，每次渲染都会从
  `.git/HEAD` 快速读取，所以普通切换分支也会立即显示。
- dirty/冲突和 ahead/behind 细节使用缓存；20 分钟内且仍属于当前分支的缓存会直接返回。
- 本地状态(`✓` / `●` / `⚠`)和上游状态(`↑领先` / `↓落后`)来自同一次
  `git status --porcelain=v2 --branch` 缓存快照，所以 TTL 相同。如果本地和远程状态同时存在，
  会一起显示，例如 `main ● ↑1 ↓1`。
- 缓存过期、无缓存或分支变化时仍立即渲染：用 `.git/HEAD` 快速只显示分支，再后台刷新 `git status`。
- 刷新使用独占 `.refresh` 标记，写入使用临时文件 rename，多个终端并发不会写坏缓存。
- 没有心跳，也没有常驻 watcher。刷新是懒触发：Claude Code 重绘 statusline 时启动 ccglance，
  ccglance 检查缓存年龄，只有过期时才启动 detached 后台刷新进程。
