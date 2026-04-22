# Scripts

## 发版

### `release.sh` — 一键发版

```bash
./scripts/release.sh patch          # 0.3.0 → 0.3.1
./scripts/release.sh minor          # 0.3.0 → 0.4.0
./scripts/release.sh major          # 0.3.0 → 1.0.0
./scripts/release.sh 0.4.0-beta.1   # 指定版本
```

自动完成：bump `package.json` 版本 → `git commit` → 打 tag → push，触发 GitHub Actions 全平台构建和发布。

---

## macOS 构建与签名

> 日常发版走 CI（`release.sh`），以下脚本用于本地调试或手动签名场景。
>
> 前提：`.env` 文件已配置 `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`、`CSC_LINK`、`CSC_KEY_PASSWORD`。

### `notarize-macos.sh` — 本地构建 + 公证

```bash
./scripts/notarize-macos.sh           # 增量构建
./scripts/notarize-macos.sh --clean   # 清除 release/ 后重新构建
```

从 `.env` 读取凭据，调用 `pnpm package:mac`，完成后验证公证状态。耗时约 10–20 分钟。

### `build-macos.sh` — 交互式构建

```bash
./scripts/build-macos.sh
```

交互式输入 Apple ID、Team ID 和证书密码，适合在没有 `.env` 的环境临时构建。

### `verify-signatures.sh` — 验证签名

```bash
./scripts/verify-signatures.sh release/mac-arm64/KeAgent.app
./scripts/verify-signatures.sh release/mac/KeAgent.app
```

检查 app bundle 内所有原生二进制（`.node`、`.dylib`）的签名状态，输出验证/失败/未签名数量汇总。

### `create-dmg.sh` — 手动打 DMG

```bash
./scripts/create-dmg.sh
```

从 `release/mac/KeAgent.app` 打包为带背景图和 Applications 链接的标准 DMG，输出到 `release/`。通常不需要手动执行，`pnpm package:mac` 已包含此步骤。

---

## 构建辅助（由 `pnpm` 脚本调用，不需手动执行）

| 脚本 | 调用时机 |
|------|---------|
| `bundle-openclaw.mjs` | `pnpm build` / `pnpm package` |
| `bundle-openclaw-plugins.mjs` | `pnpm build` / `pnpm package` |
| `bundle-preinstalled-skills.mjs` | `pnpm build` / `pnpm package` |
| `bundle-frameworks.mjs` | `pnpm build` / `pnpm package` |
| `download-bundled-uv.mjs` | `pnpm uv:download` |
| `download-bundled-node.mjs` | `pnpm node:download:win` |
| `after-pack.cjs` | electron-builder `afterPack` hook |
| `installer.nsh` | electron-builder Windows NSIS |
| `linux/` | electron-builder Linux deb hooks |
| `generate-icons.mjs` | `pnpm icons`（需要 sharp） |
| `prepare-preinstalled-skills-dev.mjs` | `pnpm dev`（开发环境技能准备） |

---

## 回归测试（`comms/`）

用于通讯模块的消息回归测试，由 CI 的 `comms-regression` workflow 自动运行。

```bash
node scripts/comms/baseline.mjs   # 记录基线
node scripts/comms/compare.mjs    # 对比结果
node scripts/comms/replay.mjs     # 回放消息
```
