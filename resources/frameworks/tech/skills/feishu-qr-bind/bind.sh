#!/bin/bash
# feishu-bind.sh - 飞书机器人一键绑定脚本
# 用法：./bind.sh [agent_id] [user_open_id]

set -e

# 默认值
AGENT_ID="${1:-tech}"
USER_OPEN_ID="${2:-ou_d6f374a3c5f7b1c0472ad5dd178e9441}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "🦞 飞书机器人绑定脚本"
echo "========================================"
echo ""
echo "参数配置:"
echo "  - Agent: ${AGENT_ID}"
echo "  - User:  ${USER_OPEN_ID}"
echo ""

# 检查技能目录
SKILL_DIR="/home/ubuntu/.keagent/workspace-tech/skills/feishu-qr-bind"
if [ ! -d "$SKILL_DIR" ]; then
    echo -e "${RED}❌ 错误：技能目录不存在${NC}"
    echo "路径：$SKILL_DIR"
    exit 1
fi

cd "$SKILL_DIR"

# 检查依赖
if [ ! -f "test-bind.js" ]; then
    echo -e "${RED}❌ 错误：test-bind.js 不存在${NC}"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  安装依赖...${NC}"
    npm install --silent
fi

echo ""
echo "========================================"
echo "📱 开始飞书机器人绑定"
echo "========================================"
echo ""

# 执行绑定脚本
node test-bind.js --send-to-feishu --user-open-id "$USER_OPEN_ID"

RESULT=$?

echo ""
echo "========================================"
if [ $RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ 绑定流程已完成！${NC}"
    echo ""
    echo "下一步:"
    echo "1. 查看飞书消息中的二维码"
    echo "2. 使用飞书 App 扫描二维码"
    echo "3. 确认授权"
    echo ""
    echo "验证绑定:"
    echo "  openclaw feishu-diagnose"
else
    echo -e "${RED}❌ 绑定失败，退出码：$RESULT${NC}"
fi
echo "========================================"

exit $RESULT
