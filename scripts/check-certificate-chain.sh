#!/bin/bash
# check-certificate-chain.sh
# 检查 macOS Developer ID 证书链完整性

set -e

echo "═══════════════════════════════════════════════════════════"
echo "macOS Developer ID 证书链检查工具"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 1. 检查系统中的 Developer ID 证书
echo "📋 Step 1: 检查 Developer ID Application 证书"
echo "─────────────────────────────────────────────────────────"

if security find-certificate -c "Developer ID Application" -p > /dev/null 2>&1; then
  echo "✅ 找到 Developer ID Application 证书"

  # 导出证书到临时文件
  CERT_FILE="/tmp/dev-id-cert.pem"
  security find-certificate -c "Developer ID Application" -p > "$CERT_FILE"

  # 显示证书详情
  echo ""
  echo "证书详情:"
  openssl x509 -in "$CERT_FILE" -text -noout | grep -E "(Subject:|Issuer:|Not Before|Not After)"

  # 检查证书有效期
  echo ""
  EXPIRY_DATE=$(openssl x509 -in "$CERT_FILE" -enddate -noout | cut -d= -f2)
  echo "证书过期时间: $EXPIRY_DATE"

  # 检查是否已过期
  if openssl x509 -in "$CERT_FILE" -checkend 0 > /dev/null; then
    echo "✅ 证书未过期"
  else
    echo "❌ 证书已过期！"
  fi

else
  echo "❌ 未找到 Developer ID Application 证书"
  echo ""
  echo "请先导入证书:"
  echo "  security import keclaw.p12 -k login.keychain"
  exit 1
fi

echo ""
echo "─────────────────────────────────────────────────────────"
echo ""

# 2. 检查中间证书
echo "🔗 Step 2: 检查 Apple 中间证书"
echo "─────────────────────────────────────────────────────────"

# 检查 Developer ID Certification Authority (G2)
if security find-certificate -c "Developer ID Certification Authority" /Library/Keychains/System.keychain > /dev/null 2>&1; then
  echo "✅ 找到 Developer ID Certification Authority (G2)"
else
  echo "❌ 缺少 Developer ID Certification Authority (G2)"
  echo "   需要从 Apple 下载: https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer"
fi

# 检查 Apple WWDR CA
if security find-certificate -c "Apple Worldwide Developer Relations Certification Authority" /Library/Keychains/System.keychain > /dev/null 2>&1; then
  echo "✅ 找到 Apple WWDR CA"
else
  echo "⚠️  未找到 Apple WWDR CA (可能不是必需的)"
fi

# 检查 Apple Root CA
if security find-certificate -c "Apple Root CA" /Library/Keychains/System.keychain > /dev/null 2>&1; then
  echo "✅ 找到 Apple Root CA"
else
  echo "⚠️  未找到 Apple Root CA (通常已内置在系统中)"
fi

echo ""
echo "─────────────────────────────────────────────────────────"
echo ""

# 3. 测试证书链验证
echo "🔐 Step 3: 测试证书链验证"
echo "─────────────────────────────────────────────────────────"

# 创建测试文件
TEST_FILE="/tmp/test-sign-file"
echo "test" > "$TEST_FILE"

# 尝试签名测试文件
echo "尝试签名测试文件..."
if codesign --force --sign "Developer ID Application" "$TEST_FILE" 2>&1 | tee /tmp/codesign-test.log; then
  echo "✅ 测试签名成功"

  # 验证签名
  if codesign -vvv "$TEST_FILE" 2>&1; then
    echo "✅ 签名验证成功"
  else
    echo "⚠️  签名验证有警告"
  fi

else
  echo "❌ 测试签名失败"
  echo ""
  echo "错误信息:"
  cat /tmp/codesign-test.log

  # 分析错误
  if grep -q "unable to build chain" /tmp/codesign-test.log; then
    echo ""
    echo "❌ 问题诊断: 证书链不完整"
    echo "   需要安装 Apple 中间证书"
  elif grep -q "errSecInternalComponent" /tmp/codesign-test.log; then
    echo ""
    echo "❌ 问题诊断: 证书信任问题"
    echo "   可能需要重新导入证书或更新钥匙串设置"
  fi
fi

# 清理
rm -f "$TEST_FILE" /tmp/codesign-test.log

echo ""
echo "─────────────────────────────────────────────────────────"
echo ""

# 4. 显示完整的证书链
echo "📜 Step 4: 显示完整证书链"
echo "─────────────────────────────────────────────────────────"

if [ -f "$CERT_FILE" ]; then
  echo "证书主体 (Subject):"
  openssl x509 -in "$CERT_FILE" -subject -noout

  echo ""
  echo "证书颁发者 (Issuer):"
  openssl x509 -in "$CERT_FILE" -issuer -noout

  echo ""
  echo "完整证书链应该是:"
  echo "  1. Developer ID Application: [你的名字] (U8XX263HJS)"
  echo "     ↓ 签发者"
  echo "  2. Developer ID Certification Authority (G2)"
  echo "     ↓ 签发者"
  echo "  3. Apple Root CA"

  rm -f "$CERT_FILE"
fi

echo ""
echo "─────────────────────────────────────────────────────────"
echo ""

# 5. 检查钥匙串访问权限
echo "🔑 Step 5: 检查钥匙串访问权限"
echo "─────────────────────────────────────────────────────────"

# 检查 codesign 是否在允许列表中
echo "检查 codesign 工具访问权限..."
if security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
  echo "✅ codesign 可以访问签名证书"
else
  echo "⚠️  可能需要授予 codesign 访问权限"
  echo ""
  echo "运行以下命令授予权限:"
  echo "  security set-key-partition-list -S apple-tool:,apple: -s -k <keychain-password> login.keychain"
fi

echo ""
echo "─────────────────────────────────────────────────────────"
echo ""

# 6. 总结和建议
echo "📊 检查总结"
echo "═══════════════════════════════════════════════════════════"

ISSUES_FOUND=0

# 检查是否有 Developer ID 证书
if ! security find-certificate -c "Developer ID Application" -p > /dev/null 2>&1; then
  echo "❌ 缺少 Developer ID Application 证书"
  ((ISSUES_FOUND++))
fi

# 检查中间证书
if ! security find-certificate -c "Developer ID Certification Authority" /Library/Keychains/System.keychain > /dev/null 2>&1; then
  echo "❌ 缺少 Developer ID Certification Authority 中间证书"
  ((ISSUES_FOUND++))
fi

if [ $ISSUES_FOUND -eq 0 ]; then
  echo "✅ 证书链检查完成，未发现重大问题"
  echo ""
  echo "💡 下一步:"
  echo "   1. 如果构建仍然失败，尝试: bash scripts/build-dev.sh"
  echo "   2. 或者运行修复脚本: bash scripts/fix-certificate.sh"
  echo "   3. 然后重新构建: pnpm run package:mac"
else
  echo "⚠️  发现 $ISSUES_FOUND 个问题"
  echo ""
  echo "🔧 修复建议:"
  echo "   1. 运行修复脚本: bash scripts/fix-certificate.sh"
  echo "   2. 或者使用开发模式构建: bash scripts/build-dev.sh"
fi

echo "═══════════════════════════════════════════════════════════"
