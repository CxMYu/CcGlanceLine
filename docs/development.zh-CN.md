# 开发

ccglance 的构建、测试、基准、代码结构、贡献范式与缓存内部细节。

[← 返回 README](../README.zh-CN.md)

## 源码构建

```bash
git clone https://github.com/CxMYu/CcGlanceLine.git
cd CcGlanceLine
npm install              # 安装 devDeps，并执行 prepare -> build

npm run build            # 编译 src/ -> dist/
npm run typecheck        # tsc --noEmit(strict)
npm test                 # 构建 + node:test fixtures/snapshots/smoke
npm run benchmark        # 构建 + 启动耗时基准
npm run preview          # 预览「本仓库 dist/」的渲染（不经 PATH，绝不误跑全局版）

# 用样例 stdin 冒烟测试（CLAUDE_CONFIG_DIR 指向临时目录，避免写真实缓存）:
CLAUDE_CONFIG_DIR=$(mktemp -d) sh -c \
  'printf "%s" "{\"model\":{\"display_name\":\"Claude Opus 4.8 (1M context)\",\"id\":\"claude-opus-4-8[1m]\"}}" | node dist/cli.js'
```

## 与全局安装隔离

本地开发和已发布的全局安装（`npm install -g @cxmyu/ccglance`）很容易互相干扰，约定如下：

- **验证本地改动一律走 `npm run preview` / `node dist/cli.js`**，不要敲裸的 `ccglance`——
  那是 PATH 上的全局版，跑的不是你刚构建的代码。
- **不要用 `npm link` 做日常试用**：它会用软链覆盖全局安装的 `ccglance` 命令，之后
  `npm update -g` 又会把它换回去，命令指向会在两者之间反复横跳。想让 Claude Code
  跑本地开发版，直接把 settings.json 指向仓库产物：
  `"command": "node D:\\绝对路径\\ccglance\\dist\\cli.js"`；验证完再改回 `"ccglance"` 即可。
- **测试与基准不会碰真实缓存**：`test/*.test.js` 和 `bench/latency.js` 都会把
  `CLAUDE_CONFIG_DIR` 指到临时目录，跑完不在 `~/.claude/ccglance/` 留任何文件。
  手动管道冒烟时也建议按上面示例带上临时 `CLAUDE_CONFIG_DIR`，否则临时仓库的 git
  缓存会写进真实缓存目录成为死条目。

### 需要链接全局命令时

如果确实想让终端里的裸命令 `ccglance` 指向当前源码目录，可以在仓库根目录执行：

```bash
npm link
```

`npm link` 会把全局包入口链接到当前仓库；之后每次 `npm run build` 生成的新 `dist/`
会立刻被全局 `ccglance` 命令使用，不需要重复 link。验证链接状态：

```bash
npm ls -g @cxmyu/ccglance     # 链接状态会显示 -> D:\Pyprojects\ccglance
ccglance --version            # 应显示本地 package.json 的版本号
```

用完后退回已发布的正式版：

```bash
npm unlink -g @cxmyu/ccglance
npm install -g @cxmyu/ccglance
```

注意：link 期间全局 `ccglance` 就是开发版；如果同时跑 `npm update -g`，命令指向可能被换回发布版。
日常验证仍推荐 `npm run preview` 或让 Claude Code 直接指向 `node <repo>/dist/cli.js`。

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
- 改代码后执行 `npm run typecheck`、`npm run build`、`npm run preview`
  （不要用全局的 `ccglance`，那是已发布的安装版）。
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

## 后台刷新与首帧延时

- git 与版本刷新在渲染期间只「入队」（各自先抢占 `.refresh` 标记）；stdout 写出后由
  `flushRefreshTasks()` 启动**单个**后台 helper（`dist/runtime/bg.js`）执行。各段缓存都新鲜时
  queue 为空、不 spawn 任何进程，所以常规重绘完全不起后台进程。
- 任务列表作为一个 JSON argv 参数传入（不经 shell、无需临时文件），因此不会留下
  `task-*.json` 残留。
- helper 跨平台统一以 `detached` + `stdio:'ignore'` 启动，从而脱离父进程、跑完写缓存。
  Windows 上**不要**再加 `windowsHide`——`detached`(`DETACHED_PROCESS`) 与
  `windowsHide`(`CREATE_NO_WINDOW`) 是冲突组合，会闪出控制台黑窗；`detached` 单独即不分配
  控制台、静默。
- helper 每次运行都清理：孤儿 `.refresh` / `.tmp`（及历史遗留的 `tasks/` 目录）立即删除，
  死缓存 json（约 30 天）每天最多清一次。
