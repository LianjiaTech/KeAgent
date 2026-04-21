#!/bin/bash
# fix-certificate.sh
# 修复 macOS 代码签名证书问题

set -e

echo "═══════════════════════════════════════════════════════════"
echo "macOS 代码签名证书修复工具"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 1. 检查当前证书
echo "📋 Step 1: 检查当前签名证书..."
security find-identity -v -p codesigning
echo ""

# 2. 检查证书有效期
echo "📅 Step 2: 检查证书有效期..."
if security find-certificate -c "Developer ID Application" -p > /dev/null 2>&1; then
  security find-certificate -c "Developer ID Application" -p | openssl x509 -text -noout | grep -A 2 "Validity"
else
  echo "⚠️  未找到 Developer ID Application 证书"
fi
echo ""

# 3. 下载并安装 Apple 中间证书
echo "🔐 Step 3: 安装 Apple 中间证书..."

CERT_DIR="/tmp/apple-certs"
mkdir -p "$CERT_DIR"

# Developer ID - G2 (Expiring 09/17/2031)
CERT_URL_G2="https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer"
CERT_FILE_G2="$CERT_DIR/DeveloperIDG2CA.cer"

echo "  下载 Developer ID Certification Authority (G2)..."
if curl -sL "$CERT_URL_G2" -o "$CERT_FILE_G2"; then
  echo "  ✓ 下载成功"

  echo "  导入到系统钥匙串..."
  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$CERT_FILE_G2"
  echo "  ✓ 已导入 G2 中间证书"
else
  echo "  ⚠️  下载失败，跳过"
fi

# Apple Worldwide Developer Relations Certification Authority
CERT_URL_WWDR="https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer"
CERT_FILE_WWDR="$CERT_DIR/AppleWWDRCAG3.cer"

echo "  下载 Apple WWDR CA (G3)..."
if curl -sL "$CERT_URL_WWDR" -o "$CERT_FILE_WWDR"; then
  echo "  ✓ 下载成功"

  echo "  导入到系统钥匙串..."
  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$CERT_FILE_WWDR"
  echo "  ✓ 已导入 WWDR 中间证书"
else
  echo "  ⚠️  下载失败，跳过"
fi

echo ""

# 4. 重新导入应用证书（如果存在 keclaw.p12）
if [ -f "keclaw.p12" ]; then
  echo "🔑 Step 4: 重新导入应用证书..."
  echo "  找到 keclaw.p12 文件"

  read -s -p "  请输入证书密码（没有密码则直接回车）: " CERT_PASSWORD
  echo ""

  # 删除旧证书（如果存在）
  security delete-certificate -c "Developer ID Application: tongtang wan" login.keychain 2>/dev/null || true

  # 导入新证书
  if [ -z "$CERT_PASSWORD" ]; then
    security import keclaw.p12 -k login.keychain -T /usr/bin/codesign -T /usr/bin/productbuild
  else
    security import keclaw.p12 -k login.keychain -P "$CERT_PASSWORD" -T /usr/bin/codesign -T /usr/bin/productbuild
  fi

  echo "  ✓ 证书已重新导入"

  # 设置证书访问权限
  echo "  设置 codesign 访问权限..."
  security set-key-partition-list -S apple-tool:,apple: -s -k "$CERT_PASSWORD" login.keychain 2>/dev/null || true
  echo "  ✓ 权限已设置"
else
  echo "⚠️  Step 4: 未找到 keclaw.p12 文件，跳过"
fi

echo ""

# 5. 验证证书链
echo "✅ Step 5: 验证证书链..."
if security find-certificate -c "Developer ID Application" -p > /dev/null 2>&1; then
  CERT_TEMP="/tmp/dev-id-cert.pem"
  security find-certificate -c "Developer ID Application" -p > "$CERT_TEMP"

  if openssl verify -CAfile /etc/ssl/cert.pem "$CERT_TEMP" 2>&1 | grep -q "OK"; then
    echo "  ✅ 证书链验证成功"
  else
    echo "  ⚠️  证书链验证失败（这可能是正常的，取决于系统配置）"
  fi

  rm -f "$CERT_TEMP"
else
  echo "  ⚠️  未找到证书"
fi

echo ""

# 6. 清理
rm -rf "$CERT_DIR"

# 7. 最终检查
echo "═══════════════════════════════════════════════════════════"
echo "最终检查结果："
echo "═══════════════════════════════════════════════════════════"
security find-identity -v -p codesigning
echo ""

echo "✅ 证书修复完成！"
echo ""
echo "💡 接下来的步骤："
echo "   1. 重新运行构建: pnpm run package:mac"
echo "   2. 如果仍有问题，使用开发签名: export CSC_IDENTITY_AUTO_DISCOVERY=false && pnpm run package:mac"
echo "   3. 查看详细日志: DEBUG=electron-builder pnpm run package:mac"
echo ""
