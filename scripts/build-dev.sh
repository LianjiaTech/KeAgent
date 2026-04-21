#!/bin/bash
# build-dev.sh
# 开发模式构建（使用 ad-hoc 签名，不需要 Developer ID）

set -e

echo "═══════════════════════════════════════════════════════════"
echo "KeAgent 开发模式构建"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "⚠️  使用 ad-hoc 签名（仅用于本地开发测试）"
echo "⚠️  此构建无法分发给其他用户"
echo ""

# 禁用自动证书发现和公证
export CSC_IDENTITY_AUTO_DISCOVERY=false
export SKIP_NOTARIZATION=true

# 清理旧构建（可选）
if [ "$1" = "--clean" ]; then
  echo "🧹 清理旧构建..."
  rm -rf release dist dist-electron build
  echo ""
fi

# 构建
echo "🔨 开始构建..."
pnpm run package:mac

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ 开发构建完成！"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📦 构建位置: release/mac-arm64/KeAgent.app"
echo ""
echo "🚀 运行应用:"
echo "   open release/mac-arm64/KeAgent.app"
echo ""
echo "⚠️  首次运行可能需要在系统设置中允许该应用"
echo "   系统设置 > 隐私与安全性 > 允许从以下位置下载的 App"
echo ""
