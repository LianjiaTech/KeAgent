#!/bin/bash
# fix-comprehensive.sh
# 综合修复 errSecInternalComponent 错误

set -e

echo "═══════════════════════════════════════════════════════════"
echo "综合修复 errSecInternalComponent"
echo "═══════════════════════════════════════════════════════════"
echo ""

CERT_NAME="Developer ID Application: tongtang wan (U8XX263HJS)"

# 方案 2: 重置钥匙串权限
echo "方案 2: 重置钥匙串权限"
echo "─────────────────────────────────────────────────────────"
echo "请输入您的 Mac 登录密码:"
read -s LOGIN_PASSWORD
echo ""

echo "重置权限..."
security set-key-partition-list -S apple-tool:,apple: -s -k "$LOGIN_PASSWORD" login.keychain-db 2>&1 || true

echo "测试签名..."
echo "test" > /tmp/test-fix2.txt
if codesign --force --sign "$CERT_NAME" /tmp/test-fix2.txt 2>&1 | grep -q "errSecInternalComponent"; then
    echo "❌ 方案 2 失败"
    METHOD2_SUCCESS=false
else
    echo "✅ 方案 2 成功！"
    METHOD2_SUCCESS=true
fi
echo ""

if [ "$METHOD2_SUCCESS" = true ]; then
    echo "🎉 问题已解决！"
    echo "现在可以运行: pnpm run package:mac"
    exit 0
fi

# 方案 4: 创建新的专用钥匙串
echo "方案 4: 创建新的专用钥匙串"
echo "─────────────────────────────────────────────────────────"
echo "创建新钥匙串..."
security create-keychain -p "codesign123" /tmp/codesign-temp.keychain 2>/dev/null || true

echo "导入证书到新钥匙串..."
security import keagent.p12 \
    -k /tmp/codesign-temp.keychain \
    -P wantt.564 \
    -T /usr/bin/codesign \
    -T /usr/bin/productbuild

echo "设置钥匙串列表..."
security list-keychains -d user -s /tmp/codesign-temp.keychain "$(security list-keychains -d user | tr '\n' ' ')"

echo "测试使用新钥匙串签名..."
echo "test" > /tmp/test-fix4.txt
if codesign --force --sign "$CERT_NAME" --keychain /tmp/codesign-temp.keychain /tmp/test-fix4.txt 2>&1 | grep -q "errSecInternalComponent"; then
    echo "❌ 方案 4 失败"
    METHOD4_SUCCESS=false
else
    echo "✅ 方案 4 成功！"
    METHOD4_SUCCESS=true
fi
echo ""

if [ "$METHOD4_SUCCESS" = true ]; then
    echo "🎉 问题已解决！"
    echo ""
    echo "构建时使用:"
    echo "  export CSC_KEYCHAIN=/tmp/codesign-temp.keychain"
    echo "  pnpm run package:mac"
    exit 0
fi

# 方案 5: 不使用时间戳服务器
echo "方案 5: 不使用时间戳签名"
echo "─────────────────────────────────────────────────────────"
echo "测试签名（不使用时间戳）..."
echo "test" > /tmp/test-fix5.txt
if codesign --force --sign "$CERT_NAME" /tmp/test-fix5.txt 2>&1 | grep -q "errSecInternalComponent"; then
    echo "❌ 方案 5 失败"
    METHOD5_SUCCESS=false
else
    echo "✅ 方案 5 成功！"
    METHOD5_SUCCESS=true
fi
echo ""

if [ "$METHOD5_SUCCESS" = true ]; then
    echo "🎉 问题已解决！"
    echo ""
    echo "手动签名方法:"
    echo "  1. 先用 ad-hoc 构建: bash scripts/build-dev.sh"
    echo "  2. 然后手动签名:"
    echo "     codesign --force --deep --sign '$CERT_NAME' \\"
    echo "       --entitlements entitlements.mac.plist \\"
    echo "       release/mac/KeAgent.app"
    exit 0
fi

echo "═══════════════════════════════════════════════════════════"
echo "所有快速方案都已尝试"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "推荐的下一步:"
echo ""
echo "1. 重启 Mac (方案 3):"
echo "   sudo reboot"
echo "   重启后再测试签名"
echo ""
echo "2. 在另一台 Mac 上签名 (方案 6):"
echo "   - 用 ad-hoc 构建: bash scripts/build-dev.sh"
echo "   - 复制应用到另一台 Mac"
echo "   - 在另一台 Mac 上签名"
echo ""
echo "3. 联系 Apple Developer Support (方案 7):"
echo "   - 访问: https://developer.apple.com/support/"
echo "   - 说明 errSecInternalComponent 错误"
echo "   - 可能需要重新生成证书"
echo ""
echo "4. 继续使用 ad-hoc 签名进行开发:"
echo "   bash scripts/build-dev.sh"
echo ""
