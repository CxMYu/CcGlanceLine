<div align="center">

# ccglance

**面向 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 的快速、零依赖多行状态栏**

模型 · effort · 上下文 · 缓存 · git · 会话 —— 一眼尽览

[![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22-3c873a)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [GitHub](https://github.com/CxMYu/CcGlanceLine)

![ccglance 预览](./docs/assets/preview.png)

</div>

> **stdin 优先 · 运行时零依赖 · 固定 emoji 风格** —— 渲染 Claude Code 经 stdin 传入的 JSON;仅 `status` 段读取 transcript 尾部固定字节。TypeScript 编写,以编译后的 JavaScript 发布,可在 Node.js ≥ 22 或 Bun 上运行。

**文档:** [概览](./docs/overview.zh-CN.md) · [字段与图标](./docs/segments.zh-CN.md) · [开发](./docs/development.zh-CN.md)

## 安装

### 方式 A —— npm 全局安装(推荐)

```bash
npm install -g @cxmyu/ccglance          # npm
yarn global add @cxmyu/ccglance         # 或 yarn
pnpm add -g @cxmyu/ccglance             # 或 pnpm
bun add -g @cxmyu/ccglance              # 或 bun
```

registry 慢?用国内镜像:

```bash
npm install -g @cxmyu/ccglance --registry https://registry.npmmirror.com
```

npm 会下载**预编译好的 `dist/`**(本机不跑编译器),并把 `ccglance` 命令装到 `PATH`。
需要 Node.js **>= 22**。

安装之后:

- ✅ `ccglance` 命令全局可用。
- ⚙️ **只装不会自动生效** —— 必须把 `statusLine` 块加进 `~/.claude/settings.json`
  (见 [配置](#配置)),然后重启 Claude Code。
- 🔎 用 `ccglance preview`(样例渲染)或 `ccglance --help`(用法 + 完整 settings.json
  配置)验证。在普通终端直接敲 `ccglance` 只会打印这份帮助。

后续可用 `npm update -g @cxmyu/ccglance` 更新、`npm uninstall -g @cxmyu/ccglance` 卸载。

### 方式 B —— 从源码构建

```bash
git clone https://github.com/CxMYu/CcGlanceLine.git
cd CcGlanceLine
npm install             # 安装 devDeps；随后 prepare 脚本自动编译 src/ -> dist/
npm link                # 可选：把 ccglance 链到本机 PATH
```

`npm install` 已经通过 `prepare` 生命周期脚本帮你构建好 `dist/`,**无需再单独跑构建**。
编译产物入口为 `dist/cli.js`;`ccglance` bin 命令和 `node dist/cli.js` 是同一个文件。验证:

```bash
node dist/cli.js preview
```

## 配置

在 `~/.claude/settings.json` 加入 `statusLine`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "ccglance",
    "padding": 0
  }
}
```

若未全局安装,直接用 Node 指向编译后的文件:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /绝对路径/ccglance/dist/cli.js"
  }
}
```

Windows 用完整路径,例如 `node D:\\path\\to\\ccglance\\dist\\cli.js`。

> **跨平台路径**:Claude Code v2.1.47+ 会在所有平台展开命令开头的 `~`,所以
> `node ~/path/to/dist/cli.js` 也能用。优先用 `~` 而非 `%USERPROFILE%`(近版本不可靠);
> 全局的 `ccglance` 命令则完全不需要写路径。`"padding": 0` 去掉 Claude Code 默认的左侧缩进,
> 让状态栏从最左开始。

> **Windows 提速小贴士**:若在意状态栏启动延时,可把 `command` 直接指向编译产物
> `node D:\\绝对路径\\ccglance\\dist\\cli.js`,通常比走全局 `ccglance` 命令更快一些。

## 贡献

欢迎提 issue 和 PR。改代码前请先跑 `npm run typecheck`、`npm run build`、`npm run preview`;
请保持**运行时零依赖**和固定风格(不加配置加载器)。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=CxMYu/CcGlanceLine&type=Date)](https://star-history.com/#CxMYu/CcGlanceLine&Date)

## 许可

[MIT](./LICENSE) © 2026 CxMYu
