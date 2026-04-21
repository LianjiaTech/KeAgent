#!/bin/bash
# fix-errsecinternal.sh
# 修复 errSecInternalComponent 错误

echo "═══════════════════════════════════════════════════════════"
echo "修复 codesign errSecInternalComponent 错误"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 方法 1: 将证书导入系统钥匙串
echo "方法 1: 将证书导入系统钥匙串"
echo "─────────────────────────────────────────────────────────"
echo "这会将证书从用户钥匙串移动到系统钥匙串"
echo "需要管理员权限"
echo ""

read -p "是否继续？(y/n): " confirm
if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
    echo ""
    echo "正在导入证书..."

    # 导入到系统钥匙串
    sudo security import keagent.p12 \
        -k /Library/Keychains/System.keychain \
        -P wantt.564 \
        -T /usr/bin/codesign \
        -T /usr/bin/productbuild \
        -T /usr/bin/productsign

    echo "✅ 证书已导入到系统钥匙串"
    echo ""

    # 测试签名
    echo "测试签名..."
    echo "test" > /tmp/test-sign.txt
    if codesign --force --sign "Developer ID Application: tongtang wan (U8XX263HJS)" /tmp/test-sign.txt 2>&1 | grep -q "errSecInternalComponent"; then
        echo "❌ 仍然失败"
    else
        echo "✅ 签名成功！"
        echo ""
        echo "现在可以运行正式构建:"
        echo "  pnpm run package:mac"
    fi
else
    echo "已取消"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
