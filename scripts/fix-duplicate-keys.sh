#!/bin/bash
# fix-duplicate-keys.sh
# 清理重复的私钥并重新授权

set -e

echo "═══════════════════════════════════════════════════════════"
echo "清理重复私钥并重新授权"
echo "═══════════════════════════════════════════════════════════"
echo ""

CERT_NAME="Developer ID Application: tongtang wan (U8XX263HJS)"

echo "问题：发现 4 个重复的私钥，可能导致权限混乱"
echo ""

# 步骤 1: 删除所有重复的证书和私钥
echo "步骤 1: 清理重复的证书和私钥"
echo "─────────────────────────────────────────────────────────"
echo "这将删除所有 Developer ID Application 证书和私钥"
echo ""
read -p "确认删除？(yes/no): " confirm

if [ "$confirm" = "yes" ]; then
    echo "正在删除..."
    security delete-certificate -c "$CERT_NAME" login.keychain 2>/dev/null || true
    security delete-certificate -c "Developer ID Certification Authority" login.keychain 2>/dev/null || true

    # 删除私钥（通过删除整个证书项）
    security dump-keychain login.keychain 2>/dev/null | grep -B 5 "$CERT_NAME" | grep "0x80001000" | awk '{print $3}' | while read key_hash; do
        security delete-generic-password -a "$key_hash" login.keychain 2>/dev/null || true
    done

    echo "✅ 清理完成"
else
    echo "已取消"
    exit 1
fi

echo ""

# 步骤 2: 重新导入证书并明确授权 codesign
echo "步骤 2: 重新导入证书并授权"
echo "─────────────────────────────────────────────────────────"
echo "导入证书并授权 codesign 访问私钥..."
echo ""

security import keclaw.p12 \
    -k login.keychain \
    -P wantt.564 \
    -T /usr/bin/codesign \
    -T /usr/bin/productbuild \
    -T /usr/bin/productsign

echo "✅ 证书已导入并授权"
echo ""

# 步骤 3: 验证只有一个身份
echo "步骤 3: 验证身份数量"
echo "─────────────────────────────────────────────────────────"
IDENTITY_COUNT=$(security find-identity -v -p codesigning | grep -c "$CERT_NAME")
echo "找到 $IDENTITY_COUNT 个身份"

if [ "$IDENTITY_COUNT" -eq 1 ]; then
    echo "✅ 正常，只有一个身份"
else
    echo "⚠️  仍然有多个身份，但可能来自不同钥匙串"
fi

echo ""

# 步骤 4: 测试签名
echo "步骤 4: 测试签名"
echo "─────────────────────────────────────────────────────────"
echo "test" > /tmp/test-fix-duplicate.txt

echo "测试签名命令:"
echo "codesign --force --sign '$CERT_NAME' /tmp/test-fix-duplicate.txt"
echo ""

if codesign --force --sign "$CERT_NAME" /tmp/test-fix-duplicate.txt 2>&1 | tee /tmp/sign-test.log | grep -q "errSecInternalComponent"; then
    echo ""
    echo "❌ 仍然失败"
    echo ""
    echo "下一步建议:"
    echo "1. 打开'钥匙串访问'应用"
    echo "2. 找到 Developer ID Application 私钥"
    echo "3. 右键 -> 显示简介 -> 访问控制"
    echo "4. 选择'允许所有应用程序访问此项'"
    echo "5. 保存后重试"
else
    echo ""
    echo "✅ 签名成功！"
    echo ""
    codesign -dv /tmp/test-fix-duplicate.txt 2>&1 | grep -E "Identifier|Signature"
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "🎉 问题已解决！"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "现在可以运行正式构建:"
    echo "  pnpm run package:mac"
fi
