#!/bin/bash
# install-from-url.sh - 从 GitHub URL 安装技能/智能体
# 支持从 GitHub 仓库 URL 直接克隆技能或智能体到本地

set -e

# 配置
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
LOCAL_HUB_DIR="${LOCAL_HUB_DIR:-/home/ubuntu/openclaw-hub}"
SKILLS_DIR="$LOCAL_HUB_DIR/skills"
AGENTS_DIR="$LOCAL_HUB_DIR/agents"
TEMP_DIR="/tmp/openclaw_install_$$"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📦 从 GitHub URL 安装技能/智能体..."
echo "时间：$(date)"
echo "========================"

# 解析 URL
parse_github_url() {
    local url="$1"
    
    # 提取 owner/repo
    if [[ $url =~ github\.com/([^/]+)/([^/]+) ]]; then
        GITHUB_OWNER="${BASH_REMATCH[1]}"
        GITHUB_REPO="${BASH_REMATCH[2]}"
        
        # 提取路径（如果有）
        if [[ $url =~ /tree/[^/]+/(.*) ]]; then
            REPO_PATH="${BASH_REMATCH[1]}"
        elif [[ $url =~ /blob/[^/]+/(.*) ]]; then
            REPO_PATH="${BASH_REMATCH[1]}"
            # 如果是文件，取目录
            REPO_PATH=$(dirname "$REPO_PATH")
        else
            REPO_PATH=""
        fi
        
        echo "✓ URL 解析成功"
        echo "  仓库：$GITHUB_OWNER/$GITHUB_REPO"
        echo "  路径：${REPO_PATH:-根目录}"
        return 0
    else
        echo "❌ 无效的 GitHub URL"
        return 1
    fi
}

# 克隆仓库
clone_repo() {
    echo ""
    echo "[1/4] 克隆仓库..."
    
    mkdir -p "$TEMP_DIR"
    cd "$TEMP_DIR"
    
    local repo_url="https://github.com/$GITHUB_OWNER/$GITHUB_REPO.git"
    
    if [ -n "$GITHUB_TOKEN" ]; then
        repo_url="https://$GITHUB_TOKEN@github.com/$GITHUB_OWNER/$GITHUB_REPO.git"
    fi
    
    if git clone --depth 1 "$repo_url" . 2>&1; then
        echo "✓ 仓库克隆完成"
        return 0
    else
        echo "❌ 仓库克隆失败"
        return 1
    fi
}

# 识别类型（skill 或 agent）
identify_type() {
    echo ""
    echo "[2/4] 识别类型..."
    
    local source_path="$TEMP_DIR"
    if [ -n "$REPO_PATH" ]; then
        source_path="$TEMP_DIR/$REPO_PATH"
    fi
    
    # 检查是否为 skill（查找 SKILL.md）
    if [ -f "$source_path/SKILL.md" ] || [ -f "$source_path/skill.md" ]; then
        INSTALL_TYPE="skill"
        TARGET_DIR="$SKILLS_DIR"
        echo "✓ 识别为：技能 (skill)"
        return 0
    fi
    
    # 检查是否为 agent（查找 AGENT.md 或 agent.md）
    if [ -f "$source_path/AGENT.md" ] || [ -f "$source_path/agent.md" ]; then
        INSTALL_TYPE="agent"
        TARGET_DIR="$AGENTS_DIR"
        echo "✓ 识别为：智能体 (agent)"
        return 0
    fi
    
    # 检查目录名
    if [[ "$source_path" =~ skills/ ]] || [[ "$REPO_PATH" =~ ^skills ]]; then
        INSTALL_TYPE="skill"
        TARGET_DIR="$SKILLS_DIR"
        echo "✓ 根据路径识别为：技能 (skill)"
        return 0
    fi
    
    if [[ "$source_path" =~ agents/ ]] || [[ "$REPO_PATH" =~ ^agents ]]; then
        INSTALL_TYPE="agent"
        TARGET_DIR="$AGENTS_DIR"
        echo "✓ 根据路径识别为：智能体 (agent)"
        return 0
    fi
    
    # 无法识别
    echo "⚠️  无法自动识别类型，请手动指定"
    echo "  1) skill - 技能"
    echo "  2) agent - 智能体"
    read -p "请选择 (1/2): " choice
    
    case $choice in
        1|skill)
            INSTALL_TYPE="skill"
            TARGET_DIR="$SKILLS_DIR"
            ;;
        2|agent)
            INSTALL_TYPE="agent"
            TARGET_DIR="$AGENTS_DIR"
            ;;
        *)
            echo "❌ 无效选择"
            return 1
            ;;
    esac
    
    return 0
}

# 安装到本地
install_local() {
    echo ""
    echo "[3/4] 安装到本地..."
    
    local source_path="$TEMP_DIR"
    if [ -n "$REPO_PATH" ]; then
        source_path="$TEMP_DIR/$REPO_PATH"
    fi
    
    # 检查源路径
    if [ ! -d "$source_path" ]; then
        echo "❌ 源路径不存在：$source_path"
        return 1
    fi
    
    # 确定目标目录名
    local dir_name
    if [ -n "$REPO_PATH" ]; then
        dir_name=$(basename "$REPO_PATH")
    else
        dir_name="$GITHUB_REPO"
    fi
    
    # 清理名称（移除可能的后缀）
    dir_name=$(echo "$dir_name" | sed 's/-skill$//' | sed 's/-agent$//')
    
    local target_path="$TARGET_DIR/$dir_name"
    
    # 检查是否已存在
    if [ -d "$target_path" ]; then
        echo "⚠️  目录已存在：$target_path"
        read -p "是否覆盖？(y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            echo "取消安装"
            return 1
        fi
        rm -rf "$target_path"
    fi
    
    # 复制文件
    mkdir -p "$TARGET_DIR"
    cp -r "$source_path" "$target_path"
    
    echo "✓ 安装完成：$target_path"
    return 0
}

# 验证安装
verify_install() {
    echo ""
    echo "[4/4] 验证安装..."
    
    local target_path="$TARGET_DIR/$(basename "$TARGET_DIR"/*)"
    
    # 检查必要文件
    if [ "$INSTALL_TYPE" = "skill" ]; then
        if [ -f "$target_path/SKILL.md" ]; then
            echo "✓ SKILL.md 存在"
        else
            echo "⚠️  警告：未找到 SKILL.md"
        fi
    else
        if [ -f "$target_path/AGENT.md" ]; then
            echo "✓ AGENT.md 存在"
        else
            echo "⚠️  警告：未找到 AGENT.md"
        fi
    fi
    
    # 显示目录结构
    echo ""
    echo "安装的目录结构："
    find "$target_path" -maxdepth 2 -type f | head -20
    
    echo ""
    echo "========================"
    echo "✅ 安装完成！"
    echo "类型：$INSTALL_TYPE"
    echo "路径：$target_path"
    echo ""
    echo "下一步："
    if [ "$INSTALL_TYPE" = "skill" ]; then
        echo "1. 检查 SKILL.md 中的使用说明"
        echo "2. 配置必要的环境变量"
        echo "3. 在 OpenClaw 中启用该技能"
    else
        echo "1. 检查 AGENT.md 中的使用说明"
        echo "2. 配置必要的环境变量"
        echo "3. 在 OpenClaw 配置中添加该智能体"
    fi
}

# 清理
cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}

# 主流程
main() {
    # 检查参数
    if [ $# -lt 1 ]; then
        echo "用法：$0 <GitHub URL>"
        echo ""
        echo "示例："
        echo "  $0 https://github.com/user/repo"
        echo "  $0 https://github.com/user/repo/tree/main/skills/skill-name"
        echo "  $0 https://github.com/user/repo/blob/main/agents/agent-name"
        exit 1
    fi
    
    local url="$1"
    
    # 设置清理陷阱
    trap cleanup EXIT
    
    # 1. 解析 URL
    if ! parse_github_url "$url"; then
        exit 1
    fi
    
    # 2. 克隆仓库
    if ! clone_repo; then
        exit 1
    fi
    
    # 3. 识别类型
    if ! identify_type; then
        exit 1
    fi
    
    # 4. 安装
    if ! install_local; then
        exit 1
    fi
    
    # 5. 验证
    verify_install
}

# 执行
main "$@"
