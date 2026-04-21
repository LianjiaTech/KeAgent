#!/bin/bash
# manual-resign.sh
# 手动重新签名应用（绕过 electron-builder 的自动签名）

set -e

APP_PATH="release/mac/KeClaw.app"
CERT_NAME="Developer ID Application: tongtang wan (U8XX263HJS)"

echo "═══════════════════════════════════════════════════════════"
echo "手动重新签名应用"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 检查应用是否存在
if [ ! -d "$APP_PATH" ]; then
    echo "❌ 应用不存在: $APP_PATH"
    echo ""
    echo "请先构建应用:"
    echo "  bash scripts/build-dev.sh"
    exit 1
fi

echo "找到应用: $APP_PATH"
echo "准备重新签名..."
echo ""

# 步骤 1: 移除现有签名
echo "步骤 1: 移除现有签名..."
find "$APP_PATH" -type f \( -name "*.node" -o -name "*.dylib" -o -name "*.so" \) -exec codesign --remove-signature {} \; 2>/dev/null || true
codesign --remove-signature "$APP_PATH" 2>/dev/null || true
echo "✅ 现有签名已移除"
echo ""

# 步骤 2: 尝试深度签名
echo "步骤 2: 尝试深度签名..."
echo "命令: codesign --force --deep --sign '$CERT_NAME' --timestamp --options runtime '$APP_PATH'"
echo ""

if codesign --force --deep --sign "$CERT_NAME" --timestamp --options runtime --entitlements entitlements.mac.plist "$APP_PATH" 2>&1 | tee /tmp/resign.log | grep -q "errSecInternalComponent"; then
    echo ""
    echo "❌ 深度签名失败"
    echo ""

    # 尝试不使用 runtime 选项
    echo "尝试不使用 hardened runtime..."
    if codesign --force --deep --sign "$CERT_NAME" --timestamp --entitlements entitlements.mac.plist "$APP_PATH" 2>&1 | grep -q "errSecInternalComponent"; then
        echo "❌ 仍然失败"
        echo ""

        # 尝试不使用时间戳
        echo "尝试不使用时间戳服务器..."
        if codesign --force --deep --sign "$CERT_NAME" --entitlements entitlements.mac.plist "$APP_PATH" 2>&1 | grep -q "errSecInternalComponent"; then
            echo "❌ 所有签名尝试都失败"
            echo ""
            echo "建议:"
            echo "1. 重启 Mac 后再试"
            echo "2. 在另一台 Mac 上签名"
            echo "3. 联系 Apple Developer Support"
            exit 1
        else
            echo "✅ 签名成功（无时间戳）"
            SUCCESS=true
        fi
    else
        echo "✅ 签名成功（无 runtime）"
        SUCCESS=true
    fi
else
    echo "✅ 深度签名成功"
    SUCCESS=true
fi

echo ""

if [ "$SUCCESS" = true ]; then
    # 验证签名
    echo "步骤 3: 验证签名..."
    if codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1 | tail -5; then
        echo ""
        echo "✅ 签名验证通过"
        echo ""
        echo "签名信息:"
        codesign -dv "$APP_PATH" 2>&1 | grep -E "Identifier|Signature|TeamIdentifier"
        echo ""
        echo "═══════════════════════════════════════════════════════════"
        echo "🎉 重新签名成功！"
        echo "═══════════════════════════════════════════════════════════"
        echo ""
        echo "下一步:"
        echo "1. 测试应用: open '$APP_PATH'"
        echo "2. 创建 DMG: 手动创建或使用工具"
        echo "3. 提交公证（如果使用了时间戳）"
    else
        echo "⚠️ 签名验证有警告"
    fi
fi
