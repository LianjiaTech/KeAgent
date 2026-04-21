#!/bin/bash
# install-apple-root-ca.sh
# 安装 Apple Root CA 以完成证书链

set -e

echo "═══════════════════════════════════════════════════════════"
echo "安装 Apple Root CA 证书"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 1. 下载 Apple Root CA
echo "📥 Step 1: 下载 Apple Root CA..."
curl -sL https://www.apple.com/certificateauthority/AppleIncRootCertificate.cer -o /tmp/AppleIncRootCertificate.cer
ls -lh /tmp/AppleIncRootCertificate.cer
echo "✅ 下载完成"
echo ""

# 2. 验证证书
echo "🔍 Step 2: 验证证书..."
openssl x509 -in /tmp/AppleIncRootCertificate.cer -inform DER -text -noout | grep -E "Subject:|Issuer:|Not After"
echo ""

# 3. 导入到系统钥匙串
echo "🔐 Step 3: 导入到系统钥匙串（需要管理员密码）..."
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain /tmp/AppleIncRootCertificate.cer
echo "✅ 导入完成"
echo ""

# 4. 验证安装
echo "✅ Step 4: 验证安装..."
if security find-certificate -c "Apple Root CA" /Library/Keychains/System.keychain > /dev/null 2>&1; then
  echo "✅ Apple Root CA 已成功安装"
else
  echo "❌ Apple Root CA 未找到"
fi
echo ""

# 5. 测试签名
echo "🧪 Step 5: 测试签名..."
echo "test" > /tmp/test-sign.txt
if codesign --force --sign "Developer ID Application: tongtang wan (U8XX263HJS)" --timestamp --options runtime /tmp/test-sign.txt 2>&1 | grep -q "errSecInternalComponent"; then
  echo "❌ 签名仍然失败"
  echo "请检查证书链是否完整"
else
  echo "✅ 签名测试成功！"
  echo ""
  echo "现在可以运行: pnpm run package:mac"
fi

echo "═══════════════════════════════════════════════════════════"
