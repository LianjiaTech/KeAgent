#!/bin/bash
# fix-new-keychain.sh
# 创建新的专用钥匙串解决签名问题

set -e

echo "═══════════════════════════════════════════════════════════"
echo "创建新的专用钥匙串"
echo "═══════════════════════════════════════════════════════════"
echo ""

CERT_NAME="Developer ID Application: tongtang wan (U8XX263HJS)"

# 1. 创建新的钥匙串
echo "1. 创建新的钥匙串..."
KEYCHAIN_PATH="/tmp/codesign-$(date +%s).keychain"
security create-keychain -p "temp123" "$KEYCHAIN_PATH"
echo "✅ 新钥匙串已创建: $KEYCHAIN_PATH"
echo ""

# 2. 导入证书
echo "2. 导入证书到新钥匙串..."
security import keclaw.p12 \
    -k "$KEYCHAIN_PATH" \
    -P wantt.564 \
    -T /usr/bin/codesign \
    -T /usr/bin/productbuild
echo "✅ 证书已导入"
echo ""

# 3. 解锁钥匙串
echo "3. 解锁新钥匙串..."
security unlock-keychain -p "temp123" "$KEYCHAIN_PATH"
echo "✅ 钥匙串已解锁"
echo ""

# 4. 将新钥匙串添加到搜索列表
echo "4. 添加到钥匙串搜索列表..."
security list-keychains -d user -s "$KEYCHAIN_PATH" $(security list-keychains -d user | grep -v "$KEYCHAIN_PATH" | tr '\n' ' ')
echo "✅ 已添加到搜索列表"
echo ""

# 5. 测试签名
echo "5. 测试签名..."
echo "test" > /tmp/test-new-keychain.txt

if codesign --force --sign "$CERT_NAME" --keychain "$KEYCHAIN_PATH" /tmp/test-new-keychain.txt 2>&1 | grep -q "errSecInternalComponent"; then
    echo "❌ 签名仍然失败"
    echo ""
    echo "尝试不使用 --keychain 参数..."
    if codesign --force --sign "$CERT_NAME" /tmp/test-new-keychain.txt 2>&1 | grep -q "errSecInternalComponent"; then
        echo "❌ 仍然失败"
        echo ""
        echo "建议:"
        echo "1. 重启 Mac"
        echo "2. 在另一台 Mac 上签名"
        echo "3. 联系 Apple Developer Support"
    else
        echo "✅ 成功！"
        SUCCESS=true
    fi
else
    echo "✅ 签名成功！"
    SUCCESS=true
fi

echo ""
echo "═══════════════════════════════════════════════════════════"

if [ "$SUCCESS" = true ]; then
    echo "🎉 问题已解决！"
    echo ""
    echo "使用方法:"
    echo ""
    echo "方法 1: 设置环境变量自动使用新钥匙串"
    echo "  export CSC_KEYCHAIN=$KEYCHAIN_PATH"
    echo "  pnpm run package:mac"
    echo ""
    echo "方法 2: 每次构建前设置"
    echo "  export CSC_KEYCHAIN=$KEYCHAIN_PATH"
    echo "  pnpm run package:mac"
    echo ""
    echo "钥匙串路径: $KEYCHAIN_PATH"
    echo "钥匙串密码: temp123"
    echo ""
    echo "⚠️ 注意: 重启后需要重新创建钥匙串"
fi
