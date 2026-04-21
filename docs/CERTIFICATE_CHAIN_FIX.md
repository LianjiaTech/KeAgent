# 证书链问题诊断与修复指南

## 🎯 问题诊断结果

### ✅ 证书状态
```
✅ Developer ID Application: tongtang wan (U8XX263HJS) - 存在，有效
✅ Developer ID Certification Authority (G2) - 已安装
✅ Apple WWDR CA - 存在
```

### ❌ 签名失败原因
```
Warning: unable to build chain to self-signed root
errSecInternalComponent
```

**根本原因**：证书链信任关系未正确建立

## 🔧 解决方案

### 方案 1: 重新导入证书到系统钥匙串（推荐）

```bash
# Step 1: 删除旧证书
security delete-certificate -c "Developer ID Application: tongtang wan" login.keychain || true

# Step 2: 重新导入证书（需要证书密码）
security import keclaw.p12 -k login.keychain -P <你的密码> -T /usr/bin/codesign -T /usr/bin/productbuild

# Step 3: 设置钥匙串访问权限（允许 codesign 访问）
security set-key-partition-list -S apple-tool:,apple: -s -k <钥匙串密码> login.keychain

# Step 4: 验证证书
security find-identity -v -p codesigning
```

### 方案 2: 使用系统钥匙串

```bash
# 导入到系统钥匙串（需要管理员权限）
sudo security import keclaw.p12 -k /Library/Keychains/System.keychain -P <密码>

# 设置信任
sudo security add-trusted-cert -d -r trustAsRoot -k /Library/Keychains/System.keychain keclaw.p12
```

### 方案 3: 修复钥匙串信任设置

```bash
# 1. 打开"钥匙串访问"应用
open -a "Keychain Access"

# 2. 找到你的 Developer ID 证书
# 3. 右键 -> 显示简介 -> 信任 -> 选择"始终信任"
# 4. 关闭窗口，输入密码确认
```

### 方案 4: 使用开发模式签名（快速测试）

```bash
# 使用 ad-hoc 签名（不需要证书链）
bash scripts/build-dev.sh

# 或手动设置
export CSC_IDENTITY_AUTO_DISCOVERY=false
export CSC_IDENTITY="-"
pnpm run package:mac
```

## 🧪 验证步骤

### 1. 检查证书链
```bash
bash scripts/check-certificate-chain.sh
```

### 2. 测试签名
```bash
# 创建测试文件
echo "test" > /tmp/test.txt

# 尝试签名
codesign --force --sign "Developer ID Application" /tmp/test.txt

# 如果成功，应该没有错误输出
```

### 3. 构建测试
```bash
# 清理
rm -rf release dist dist-electron build

# 构建
pnpm run package:mac
```

## 📊 当前构建状态

### ✅ Ad-hoc 签名（成功）
```
✅ 构建成功
✅ 签名验证通过
✅ DMG 已创建：release/KeClaw-0.3.0-alpha.0-mac-x64.dmg (177M)
✅ 所有原生二进制已签名
✅ 字体文件已清理
```

### ❌ Developer ID 签名（失败）
```
❌ 证书链信任问题
❌ errSecInternalComponent 错误
```

## 🚀 快速修复命令

### 如果你有 keclaw.p12 和密码：

```bash
# 一键修复脚本
cat > /tmp/fix-cert.sh << 'EOF'
#!/bin/bash
set -e

echo "🔑 请输入证书密码（没有则直接回车）:"
read -s CERT_PASSWORD

# 删除旧证书
security delete-certificate -c "Developer ID Application: tongtang wan" login.keychain 2>/dev/null || true

# 导入证书
if [ -z "$CERT_PASSWORD" ]; then
  security import keclaw.p12 -k login.keychain -T /usr/bin/codesign
else
  security import keclaw.p12 -k login.keychain -P "$CERT_PASSWORD" -T /usr/bin/codesign
fi

# 设置访问权限
echo "🔑 请输入登录钥匙串密码（通常是你的 Mac 登录密码）:"
read -s KEYCHAIN_PASSWORD
security set-key-partition-list -S apple-tool:,apple: -s -k "$KEYCHAIN_PASSWORD" login.keychain

# 验证
echo ""
echo "✅ 证书导入完成"
security find-identity -v -p codesigning

# 测试签名
echo ""
echo "🧪 测试签名..."
echo "test" > /tmp/test-sign.txt
if codesign --force --sign "Developer ID Application" /tmp/test-sign.txt 2>&1; then
  echo "✅ 签名测试成功！"
  echo ""
  echo "现在可以运行: pnpm run package:mac"
else
  echo "❌ 签名测试失败"
  echo "请使用开发模式: bash scripts/build-dev.sh"
fi
EOF

chmod +x /tmp/fix-cert.sh
/tmp/fix-cert.sh
```

## 💡 临时解决方案（推荐用于开发）

```bash
# 使用 ad-hoc 签名构建
bash scripts/build-dev.sh

# 或添加到 package.json
# "scripts": {
#   "build:dev": "bash scripts/build-dev.sh",
#   "build:prod": "pnpm run package:mac"
# }
```

## 🔍 详细诊断

如果上述方案都不work，运行详细诊断：

```bash
# 1. 检查所有证书
security find-identity -v

# 2. 检查钥匙串状态
security show-keychain-info

# 3. 检查证书详情
security find-certificate -c "Developer ID Application" -p | openssl x509 -text -noout

# 4. 检查中间证书
security find-certificate -c "Developer ID Certification Authority" /Library/Keychains/System.keychain

# 5. 尝试手动签名
codesign --force --sign "Developer ID Application: tongtang wan (U8XX263HJS)" --timestamp --options runtime /tmp/test.txt -v
```

## 📝 已修改的文件

1. ✅ `scripts/after-pack.cjs` - 添加字体文件删除
2. ✅ `scripts/after-pack-resign.cjs` - 简化为仅移除签名
3. ✅ `scripts/after-sign.js` - 深度签名整个应用
4. ✅ `electron-builder.yml` - 添加 afterSign 钩子

## ✅ 成功标志

### Ad-hoc 签名（开发）
```
[after-sign] Using ad-hoc signing (development mode)
[after-sign] ✅ Deep signing completed successfully
KeClaw.app: valid on disk
✅ DMG created: 177M
```

### Developer ID 签名（发布）
```
[after-sign] Using identity: Developer ID Application
[after-sign] ✅ Deep signing completed successfully
KeClaw.app: valid on disk
✅ Notarization submitted
```

## 🎯 下一步

1. **开发测试**：使用 `bash scripts/build-dev.sh` ✅ 已成功
2. **修复证书**：运行上述修复命令或手动在钥匙串中设置信任
3. **生产构建**：修复证书后运行 `pnpm run package:mac`
4. **公证**：配置 `APPLE_ID` 和 `APPLE_TEAM_ID` 后自动公证

## 📞 需要帮助？

如果证书链问题仍无法解决，请提供：
1. `security find-identity -v -p codesigning` 的输出
2. `codesign --force --sign "Developer ID Application" /tmp/test.txt` 的错误信息
3. 证书是否是从 Apple Developer Portal 导出的 .p12 文件
