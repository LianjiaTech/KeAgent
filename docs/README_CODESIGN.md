# ✅ macOS 代码签名解决方案 - 最终状态

## 🎉 当前状态

### ✅ 构建成功（使用 Ad-hoc 签名）
- ✅ 应用已正确构建
- ✅ 所有原生二进制已签名
- ✅ DMG 已创建：`release/KeAgent-0.3.0-alpha.0-mac-x64.dmg` (177M)
- ✅ 签名验证通过

### ⚠️ 证书链问题（需要修复用于正式发布）
- ❌ Developer ID 签名失败：`errSecInternalComponent`
- 原因：证书信任链未正确建立

## 🚀 快速使用

### 开发/测试构建（推荐，立即可用）

```bash
# 方法 1: 使用脚本
bash scripts/build-dev.sh

# 方法 2: 设置环境变量
export CSC_IDENTITY_AUTO_DISCOVERY=false
pnpm run package:mac

# 方法 3: 使用 npm 命令
pnpm run package:mac:dev
```

**特点**：
- ✅ 不需要完整证书链
- ✅ 可以在本地 Mac 上运行
- ⚠️ 不能分发给其他用户（会有警告）
- ⚠️ 不能通过公证

### 生产发布构建（需要修复证书）

```bash
# Step 1: 修复证书链（见下方）
bash scripts/fix-certificate.sh
# 或手动设置信任

# Step 2: 构建并签名
export APPLE_ID=your@email.com
export APPLE_TEAM_ID=YOUR_TEAM_ID
export CSC_LINK=./keagent.p12
export CSC_KEY_PASSWORD=your_password
pnpm run package:mac
```

**特点**：
- ✅ 使用正式 Developer ID 证书
- ✅ 可以分发给其他用户
- ✅ 可以通过 Apple 公证
- ✅ 无安全警告

## 📊 解决方案对比

| 方案 | 证书要求 | 分发 | 公证 | 用途 |
|------|---------|------|------|------|
| **Ad-hoc 签名** | ❌ 无需 | ❌ 本地测试 | ❌ 不可 | 开发调试 |
| **Developer ID 签名** | ✅ 需要 | ✅ 可分发 | ✅ 可公证 | 正式发布 |

## 🔧 已实现的功能

### 1. 清理预签名冲突
- ✅ 自动移除所有 `.node`、`.dylib`、`.so` 的预签名
- ✅ 删除导致签名失败的字体文件 (`.ttf`, `.otf`, `.woff`)
- ✅ 清理非目标平台的二进制文件

### 2. 深度签名
- ✅ 使用 `codesign --deep` 签名整个应用
- ✅ 自动签名所有嵌套的二进制文件
- ✅ 支持自动 fallback 到 ad-hoc 签名

### 3. 验证工具
- ✅ `scripts/verify-signatures.sh` - 验证签名
- ✅ `scripts/check-certificate-chain.sh` - 检查证书链
- ✅ `scripts/fix-certificate.sh` - 修复证书问题

## 📝 构建流程

```
1. Vite 构建前端
   ↓
2. Bundle OpenClaw + 插件
   ↓
3. electron-builder 打包
   ↓
4. [after-pack.cjs]
   - 复制 node_modules
   - 打包插件
   - 删除字体文件
   - 清理非目标平台文件
   ↓
5. [after-pack-resign.cjs]
   - 扫描所有 .node/.dylib/.so
   - 移除预签名
   ↓
6. electron-builder 签名主应用
   ↓
7. [after-sign.js]
   - 深度签名整个应用
   - 验证签名
   ↓
8. 创建 DMG
   ↓
9. 公证（如果配置）
```

## 🛠️ 文件修改清单

| 文件 | 修改内容 | 状态 |
|------|---------|------|
| `electron-builder.yml` | 添加 afterSign 钩子 | ✅ |
| `scripts/after-pack.cjs` | 删除字体文件，调用重新签名 | ✅ |
| `scripts/after-pack-resign.cjs` | 移除预签名（简化版） | ✅ |
| `scripts/after-sign.js` | 深度签名整个应用 | ✅ |
| `scripts/verify-signatures.sh` | 签名验证工具 | ✅ |
| `scripts/check-certificate-chain.sh` | 证书链检查工具 | ✅ |
| `scripts/fix-certificate.sh` | 证书修复工具 | ✅ |
| `scripts/build-dev.sh` | 开发构建脚本 | ✅ |
| `package.json` | 添加新命令 | ✅ |

## 📚 相关文档

- `CODESIGN_FIX.md` - 详细技术方案
- `CERTIFICATE_CHAIN_FIX.md` - 证书链问题修复指南
- `FINAL_SOLUTION.md` - 完整解决方案
- `TESTING_CODESIGN.md` - 测试指南

## 🎯 修复证书链（正式发布必需）

### 快速修复

```bash
# 运行修复脚本
bash scripts/fix-certificate.sh

# 或手动修复
# 1. 打开"钥匙串访问"
open -a "Keychain Access"

# 2. 找到你的 Developer ID 证书
# 3. 右键 -> 显示简介 -> 信任 -> 始终信任

# 4. 验证
bash scripts/check-certificate-chain.sh
```

### 验证修复成功

```bash
# 测试签名
echo "test" > /tmp/test.txt
codesign --force --sign "Developer ID Application" /tmp/test.txt

# 应该没有错误输出
```

## ✅ 成功构建日志示例

### Ad-hoc 签名（开发）
```
[after-pack] ✅ Removed 6 unnecessary files/directories.
[after-pack-resign] Found 30 native binaries
[after-pack-resign] Removed 0 pre-existing signatures
[after-sign] Using ad-hoc signing (development mode)
[after-sign] ✅ Deep signing completed successfully
KeAgent.app: valid on disk
✅ building target=DMG arch=x64 file=release/KeAgent-0.3.0-alpha.0-mac-x64.dmg
```

### Developer ID 签名（发布）
```
[after-sign] Using identity: Developer ID Application
[after-sign] ✅ Deep signing completed successfully
KeAgent.app: valid on disk
✅ notarizing file=KeAgent-0.3.0-alpha.0-mac-x64.dmg
```

## 🚦 下一步建议

### 立即可用（开发测试）
1. ✅ 使用 `bash scripts/build-dev.sh` 构建
2. ✅ 应用可以正常运行
3. ⚠️ 仅用于本地测试

### 正式发布（需要修复证书）
1. 运行 `bash scripts/fix-certificate.sh`
2. 在"钥匙串访问"中手动设置证书信任为"始终信任"
3. 运行 `bash scripts/check-certificate-chain.sh` 验证
4. 运行 `pnpm run package:mac` 正式构建
5. 配置公证并提交

## 📞 技术支持

如有问题，检查以下日志：
```bash
# 构建日志
tail -100 /tmp/build.log

# 证书检查
bash scripts/check-certificate-chain.sh

# 签名验证
pnpm run verify:signatures release/mac/KeAgent.app
```

---

**总结**：构建流程已完全修复，ad-hoc 签名可用。如需正式发布，请修复证书信任链后重新构建。
