# macOS 代码签名冲突修复方案

## 问题描述

应用包中包含预签名的动态库（如 `.dylib`、`.node`、`.so` 文件），导致苹果代码签名工具冲突，无法完成完整的公证（notarization）。

### 常见错误

```
errSecInternalComponent
existing signature is invalid
The signature of the binary is invalid
```

## 根本原因

1. **预签名冲突**：npm 依赖包中包含已经签名的原生二进制文件
2. **签名身份不一致**：预签名使用的证书与应用主签名证书不同
3. **签名顺序错误**：electron-builder 无法正确处理深层嵌套的二进制文件

## 解决方案

本修复方案采用**重新签名策略**而非删除文件：

### 1. 新增 `after-pack-resign.cjs` 钩子

位置：`scripts/after-pack-resign.cjs`

功能：
- 扫描所有 `.node`、`.dylib`、`.so` 文件
- 移除现有签名
- 使用应用签名证书重新签名
- 应用正确的 entitlements

### 2. 修改 `after-pack.cjs`

移除了以下错误逻辑：
- ❌ 删除 `.node`、`.dylib`、`.so` 文件
- ❌ 删除 `bins/` 和 `prebuilds/` 目录
- ✅ 保留所有二进制文件，交由签名钩子处理

### 3. 更新 `electron-builder.yml` 和 `after-pack.cjs`

`electron-builder.yml`:
```yaml
afterPack: ./scripts/after-pack.cjs  # 主钩子会调用 after-pack-resign.cjs

mac:
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: entitlements.mac.plist
  entitlementsInherit: entitlements.mac.plist
  notarize: true
  binaries: []  # 不自动签名，由 after-pack-resign.cjs 处理
```

`after-pack.cjs` 末尾添加：
```javascript
// 5. Re-sign native binaries on macOS
if (platform === 'darwin') {
  console.log('[after-pack] 🔐 Re-signing native binaries...');
  const resignHandler = require('./after-pack-resign.cjs');
  await resignHandler.default(context);
}
```

### 4. Entitlements 配置

文件：`entitlements.mac.plist`

关键权限：
- `com.apple.security.cs.allow-unsigned-executable-memory` - Electron 必需
- `com.apple.security.cs.allow-jit` - V8 JIT 编译
- `com.apple.security.cs.disable-library-validation` - 允许加载动态库
- `com.apple.security.cs.allow-dyld-environment-variables` - 子进程支持

## 构建流程

### 方法 1：使用自动化脚本（推荐）

```bash
# 设置环境变量
export APPLE_ID=your_apple_id@example.com
export APPLE_TEAM_ID=YOUR_TEAM_ID
export CSC_LINK=./keagent.p12
export CSC_KEY_PASSWORD=your_password

# 构建
pnpm run package:mac
```

### 方法 2：使用交互式脚本

```bash
zx scripts/macos-sign-and-build.mjs
```

## 验证签名

使用验证脚本检查所有签名是否正确：

```bash
./scripts/verify-signatures.sh release/mac-arm64/KeAgent.app
```

输出示例：
```
═══════════════════════════════════════════════════════════
Verifying signatures for: release/mac-arm64/KeAgent.app
═══════════════════════════════════════════════════════════

🔍 Finding native binaries...
Found 42 native binaries

🔐 Verifying signatures...

✅ koffi.node
✅ sharp-darwin-arm64.node
✅ clipboard.darwin-arm64.node
...

═══════════════════════════════════════════════════════════
Summary:
  ✅ Verified: 42
  ❌ Failed:   0
  ⚠️  Unsigned: 0
═══════════════════════════════════════════════════════════

✅ Main app bundle signature is valid
```

## 手动验证命令

```bash
# 验证单个二进制文件
codesign -vvv --deep --strict path/to/binary.node

# 验证整个 app bundle
codesign -vvv --deep --strict KeAgent.app

# 查看签名信息
codesign -dvvv KeAgent.app

# 检查 entitlements
codesign -d --entitlements :- KeAgent.app
```

## 公证（Notarization）

签名完成后，electron-builder 会自动提交公证：

```bash
# 检查公证状态
xcrun notarytool history --apple-id your@email.com --team-id TEAM_ID

# 查看公证日志
xcrun notarytool log <submission-id> --apple-id your@email.com --team-id TEAM_ID
```

## 常见问题

### Q1: 签名后仍然报错 "existing signature is invalid"

**原因**：某些二进制文件签名失败但未被检测到

**解决**：
```bash
# 找出所有未签名或签名无效的文件
find KeAgent.app/Contents/Resources -type f \( -name "*.node" -o -name "*.dylib" \) -exec codesign -v {} \; 2>&1 | grep -v "valid on disk"

# 手动重新签名
codesign --force --sign "Developer ID Application" --entitlements entitlements.mac.plist --timestamp --options runtime path/to/binary
```

### Q2: 公证时提示 "The binary is not signed"

**原因**：某些嵌套的二进制文件未被签名

**解决**：使用 `--deep` 选项对整个 app bundle 进行深度签名：

```bash
codesign --force --deep --sign "Developer ID Application" --entitlements entitlements.mac.plist --timestamp --options runtime KeAgent.app
```

### Q3: 某些 .node 文件无法签名

**原因**：文件权限问题或已损坏

**解决**：
```bash
# 修复权限
chmod 644 path/to/binary.node

# 如果文件已损坏，需要重新构建依赖
rm -rf node_modules build
pnpm install
pnpm run package
```

## 技术细节

### 签名顺序

1. `after-pack.cjs` - 复制文件、清理、平台特定优化
2. `after-pack.cjs` 调用 `after-pack-resign.cjs` - 重新签名所有二进制文件
3. electron-builder - 签名主应用包
4. electron-builder - 提交公证
5. `after-sign.js` - 可选的后处理（当前为空）

### 为什么不能删除二进制文件？

删除预签名的二进制文件会导致：
- ❌ 功能缺失（如 node-llama-cpp 无法工作）
- ❌ 应用崩溃（缺少必需的原生模块）
- ❌ 错误的依赖树（pnpm 依赖损坏）

正确做法是**重新签名**而非删除。

### Hardened Runtime 要求

macOS 10.14+ 公证要求：
- ✅ 必须启用 Hardened Runtime
- ✅ 必须使用时间戳服务器
- ✅ 必须签名所有可执行代码（包括 .node、.dylib）
- ✅ 必须使用 Developer ID Application 证书

## 参考资源

- [Apple Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)
- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [Notarizing macOS Software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

## 更新日志

- 2026-03-25: 初始版本，实现重新签名策略
- 修复了删除二进制文件导致的功能缺失问题
- 添加了自动化签名验证脚本
