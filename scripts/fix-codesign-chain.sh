#!/bin/bash
# fix-codesign-chain.sh
# 修复 codesign 无法构建证书链的问题

set -e

echo "═══════════════════════════════════════════════════════════"
echo "修复 codesign 证书链问题"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 步骤 1: 检查当前状态
echo "📋 步骤 1: 检查当前证书状态"
echo "─────────────────────────────────────────────────────────"
security find-identity -v -p codesigning
echo ""

# 步骤 2: 确保所有证书都在系统钥匙串
echo "🔐 步骤 2: 将证书导入系统钥匙串"
echo "─────────────────────────────────────────────────────────"
echo "这需要管理员权限..."
echo ""

# 导出证书
security find-certificate -c "Developer ID Application" -p > /tmp/dev-id-cert.pem
security find-certificate -c "Developer ID Certification Authority" -p > /tmp/dev-id-ca.pem
security find-certificate -c "Apple Root CA" -p > /tmp/apple-root.pem

# 导入到系统钥匙串
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain /tmp/apple-root.pem
sudo security add-trusted-cert -d -r trustAsRoot -k /Library/Keychains/System.keychain /tmp/dev-id-ca.pem

# 导入 p12 到系统钥匙串
sudo security import keagent.p12 \
  -k /Library/Keychains/System.keychain \
  -P wantt.564 \
  -T /usr/bin/codesign \
  -T /usr/bin/productbuild

echo "✅ 证书已导入到系统钥匙串"
echo ""

# 步骤 3: 清理并重建钥匙串索引
echo "🔄 步骤 3: 重建钥匙串索引"
echo "─────────────────────────────────────────────────────────"
# 方法 1: 重启安全服务
echo "重启 SecurityServer..."
sudo killall securityd 2>/dev/null || true
sleep 2
echo "✅ SecurityServer 已重启"
echo ""

# 步骤 4: 测试签名
echo "🧪 步骤 4: 测试签名"
echo "─────────────────────────────────────────────────────────"
echo "test" > /tmp/test-codesign.txt

echo "测试 1: 不使用 runtime 选项..."
if codesign --force --sign "Developer ID Application: tongtang wan (U8XX263HJS)" /tmp/test-codesign.txt 2>&1 | grep -q "errSecInternalComponent"; then
  echo "❌ 失败: errSecInternalComponent"
  echo ""
  echo "测试 2: 使用系统钥匙串..."
  codesign --force --sign "Developer ID Application: tongtang wan (U8XX263HJS)" \
    --keychain /Library/Keychains/System.keychain \
    /tmp/test-codesign.txt 2>&1
else
  echo "✅ 签名成功！"
  codesign -dv /tmp/test-codesign.txt 2>&1 | grep -E "Identifier|Signature"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "诊断完成"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "如果仍然失败，请尝试："
echo "1. 重启 Mac"
echo "2. 在另一台 Mac 上签名"
echo "3. 联系 Apple Developer Support"
echo "4. 使用 ad-hoc 签名: bash scripts/build-dev.sh"
