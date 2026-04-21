# 代码签名修复测试指南

## 快速测试

### 1. 验证脚本语法

```bash
# 检查新脚本的语法是否正确
node -c scripts/after-pack-resign.cjs
echo "✅ Syntax check passed"
```

### 2. 本地构建测试

```bash
# 设置测试环境变量（使用你的证书）
export APPLE_ID=your_apple_id@example.com
export APPLE_TEAM_ID=YOUR_TEAM_ID
export CSC_LINK=./keagent.p12
export CSC_KEY_PASSWORD=your_password

# 清理旧构建
rm -rf release dist dist-electron build

# 构建（不发布）
pnpm run package:mac
```

### 3. 验证签名

```bash
# 方法 1: 使用验证脚本
pnpm run verify:signatures release/mac-arm64/KeAgent.app

# 方法 2: 手动验证
codesign -vvv --deep --strict release/mac-arm64/KeAgent.app
```

### 4. 检查二进制文件

```bash
# 查看有多少二进制文件
find release/mac-arm64/KeAgent.app/Contents/Resources -type f \( -name "*.node" -o -name "*.dylib" -o -name "*.so" \) | wc -l

# 检查是否有未签名的文件
find release/mac-arm64/KeAgent.app/Contents/Resources -type f \( -name "*.node" -o -name "*.dylib" -o -name "*.so" \) -exec codesign -v {} \; 2>&1 | grep -v "valid on disk"
```

## 构建日志检查点

构建过程中应该看到以下日志：

### ✅ after-pack.cjs 阶段

```
[after-pack] Target: darwin/arm64
[after-pack] Copying X openclaw dependencies to ...
[after-pack] ✅ openclaw node_modules copied.
[after-pack] 🧹 Cleaning up unnecessary files ...
[after-pack] ✅ Removed X unnecessary files/directories.
[after-pack] ⚠️  Note: Native binaries (.node, .dylib, .so) will be re-signed by after-pack-resign.cjs
```

### ✅ after-pack-resign.cjs 阶段

```
[after-pack-resign] Starting binary re-signing process...
[after-pack-resign] Using signing identity: Developer ID Application
[after-pack-resign] App path: ...
[after-pack-resign] Scanning for native binaries...
[after-pack-resign] Found X native binaries
[after-pack-resign] Step 1/2: Removing existing signatures...
  Removing existing signature: /path/to/binary.node
[after-pack-resign] Removed X existing signatures
[after-pack-resign] Step 2/2: Re-signing binaries...
  ✓ Signed: /path/to/binary.node
[after-pack-resign] ═══════════════════════════════════
[after-pack-resign] ✅ Successfully re-signed: X binaries
[after-pack-resign] ═══════════════════════════════════
[after-pack-resign] ✓ Verification passed for: ...
```

## 常见问题排查

### 问题 1: "no identity found"

```bash
# 检查证书是否已导入
security find-identity -v -p codesigning

# 导入证书
security import keagent.p12 -k ~/Library/Keychains/login.keychain
```

### 问题 2: 某些文件仍未签名

```bash
# 找出未签名的文件
APP_PATH="release/mac-arm64/KeAgent.app"
find "$APP_PATH/Contents/Resources" -type f \( -name "*.node" -o -name "*.dylib" \) | while read file; do
  if ! codesign -v "$file" 2>/dev/null; then
    echo "Unsigned: $file"
  fi
done

# 手动签名
codesign --force --sign "Developer ID Application" \
  --entitlements entitlements.mac.plist \
  --timestamp --options runtime \
  path/to/unsigned-file.node
```

### 问题 3: "existing signature is invalid"

这表明签名冲突已经解决！如果还有这个错误：

```bash
# 强制移除所有签名
find release/mac-arm64/KeAgent.app -type f \( -name "*.node" -o -name "*.dylib" -o -name "*.so" \) -exec codesign --remove-signature {} \; 2>/dev/null

# 重新深度签名整个应用
codesign --force --deep --sign "Developer ID Application" \
  --entitlements entitlements.mac.plist \
  --timestamp --options runtime \
  release/mac-arm64/KeAgent.app
```

### 问题 4: 公证失败

```bash
# 获取公证历史
xcrun notarytool history --apple-id your@email.com --team-id TEAM_ID

# 查看最新公证的日志
xcrun notarytool log <submission-id> --apple-id your@email.com --team-id TEAM_ID > notarization.log

# 检查日志中的错误
grep -i "error\|invalid\|failed" notarization.log
```

## 测试清单

- [ ] 脚本语法检查通过
- [ ] 构建成功完成（无错误）
- [ ] after-pack-resign 日志显示正确
- [ ] 找到并重新签名了所有二进制文件
- [ ] 验证脚本通过（所有文件已签名）
- [ ] 主应用包签名有效
- [ ] 应用可以启动并运行
- [ ] 公证提交成功（如果启用）
- [ ] 公证验证通过（如果启用）

## 完整测试流程示例

```bash
#!/bin/bash
set -e

echo "🚀 开始完整测试..."

# 1. 清理
echo "1️⃣ 清理旧构建..."
rm -rf release dist dist-electron build

# 2. 语法检查
echo "2️⃣ 检查脚本语法..."
node -c scripts/after-pack-resign.cjs
echo "✅ Syntax OK"

# 3. 设置环境
echo "3️⃣ 设置环境变量..."
export APPLE_ID=your_apple_id@example.com
export APPLE_TEAM_ID=YOUR_TEAM_ID
export CSC_LINK=./keagent.p12
export CSC_KEY_PASSWORD=your_password

# 4. 构建
echo "4️⃣ 开始构建..."
pnpm run package:mac

# 5. 验证
echo "5️⃣ 验证签名..."
bash scripts/verify-signatures.sh release/mac-arm64/KeAgent.app

# 6. 测试运行
echo "6️⃣ 测试应用启动..."
open release/mac-arm64/KeAgent.app

echo "✅ 测试完成！"
```

## 性能基准

预期构建时间（M1 Max）：
- 清理和准备：~1 分钟
- Vite 构建：~30 秒
- OpenClaw 打包：~2 分钟
- electron-builder 打包：~1 分钟
- **重新签名二进制文件：~30 秒**（新增）
- 主应用签名：~10 秒
- 公证上传：~1 分钟
- 公证验证：~5-10 分钟

总计：约 15-20 分钟（包括公证）

## 调试技巧

### 查看签名详情

```bash
# 查看某个二进制的签名信息
codesign -dvvv path/to/binary.node

# 查看 entitlements
codesign -d --entitlements :- path/to/binary.node

# 查看所有签名的证书链
codesign -dvvv path/to/binary.node 2>&1 | grep Authority
```

### 模拟公证检查

```bash
# Gatekeeper 评估（模拟用户首次打开）
spctl --assess --verbose=4 --type execute KeAgent.app

# 检查公证票据
spctl --assess --verbose=4 --type install KeAgent.app
stapler validate KeAgent.app
```

### 监控构建过程

```bash
# 实时查看签名操作
tail -f ~/.npm/_logs/*.log | grep -i "sign\|codesign"

# 查看 electron-builder 调试输出
DEBUG=electron-builder pnpm run package:mac
```

## 回滚计划

如果新方案有问题，可以快速回滚：

```bash
# 1. 恢复旧的 after-pack.cjs
git checkout HEAD~1 scripts/after-pack.cjs

# 2. 移除新钩子
rm scripts/after-pack-resign.cjs

# 3. 恢复 electron-builder.yml
git checkout HEAD~1 electron-builder.yml

# 4. 重新构建
pnpm run package:mac
```

## 成功标志

所有这些检查应该通过：

```bash
# 1. 签名验证
codesign -vvv --deep --strict KeAgent.app
# 预期：KeAgent.app: valid on disk

# 2. Gatekeeper 评估
spctl --assess --verbose=4 KeAgent.app
# 预期：KeAgent.app: accepted

# 3. 二进制计数
find KeAgent.app -name "*.node" -o -name "*.dylib" | wc -l
# 预期：> 0（不应该被删除）

# 4. 全部已签名
find KeAgent.app -type f \( -name "*.node" -o -name "*.dylib" \) -exec codesign -v {} \; 2>&1 | grep -c "valid on disk"
# 预期：等于二进制文件总数
```
