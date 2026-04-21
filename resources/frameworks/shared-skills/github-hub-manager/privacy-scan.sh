#!/bin/bash
# privacy-scan.sh - 隐私信息检测脚本
# 检测代码/文档中的敏感信息（token、secret、password 等）

set -e

# 配置
SCAN_DIR="${1:-/home/ubuntu/openclaw-hub}"
REPORT_FILE="/tmp/privacy_scan_$(date +%Y%m%d_%H%M%S).txt"
EXCLUDE_DIRS=(".git" "node_modules" "__pycache__" ".venv" "vendor")
INCLUDE_EXTENSIONS=("*.md" "*.json" "*.yaml" "*.yml" "*.toml" "*.sh" "*.py" "*.js" "*.ts")

echo "🔒 开始隐私信息扫描..."
echo "扫描目录：$SCAN_DIR"
echo "时间：$(date)"
echo "========================"

# 构建排除参数
build_exclude_args() {
    local args=""
    for dir in "${EXCLUDE_DIRS[@]}"; do
        args="$args -path '*/$dir' -prune -o"
    done
    echo "$args"
}

# 检测模式
declare -A PRIVACY_PATTERNS=(
    ["GitHub Token"]="ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}"
    ["Generic Token"]="token['\"]?\\s*[:=]\\s*['\"][a-zA-Z0-9_\\-]{20,}['\"]"
    ["Secret"]="secret['\"]?\\s*[:=]\\s*['\"][a-zA-Z0-9_\\-]{10,}['\"]"
    ["Password"]="password['\"]?\\s*[:=]\\s*['\"][^'\"]{6,}['\"]"
    ["API Key"]="api[_-]?key['\"]?\\s*[:=]\\s*['\"][a-zA-Z0-9_\\-]{16,}['\"]"
    ["Access Key"]="access[_-]?key['\"]?\\s*[:=]\\s*['\"][a-zA-Z0-9_\\-]{16,}['\"]"
    ["Private Key"]="-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"
    ["AWS Key"]="AKIA[0-9A-Z]{16}"
    ["Email"]="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"
    ["IP Address"]="\\b(\\d{1,3}\\.){3}\\d{1,3}\\b"
)

# 扫描函数
scan_directory() {
    local dir="$1"
    local found_issues=0
    
    # 创建报告文件
    > "$REPORT_FILE"
    
    echo "扫描中..."
    echo ""
    
    # 遍历所有模式
    for pattern_name in "${!PRIVACY_PATTERNS[@]}"; do
        local pattern="${PRIVACY_PATTERNS[$pattern_name]}"
        local temp_file="/tmp/privacy_scan_temp_$$"
        
        # 构建 find 命令
        local find_cmd="find '$dir'"
        for exclude_dir in "${EXCLUDE_DIRS[@]}"; do
            find_cmd="$find_cmd -path '*/$exclude_dir' -prune -o"
        done
        
        # 添加文件类型过滤
        find_cmd="$find_cmd -type f \\("
        local first=true
        for ext in "${INCLUDE_EXTENSIONS[@]}"; do
            if [ "$first" = true ]; then
                find_cmd="$find_cmd -name '$ext'"
                first=false
            else
                find_cmd="$find_cmd -o -name '$ext'"
            fi
        done
        find_cmd="$find_cmd \\) -print0"
        
        # 执行搜索
        if eval "$find_cmd" 2>/dev/null | xargs -0 grep -nE "$pattern" 2>/dev/null > "$temp_file" || true; then
            if [ -s "$temp_file" ]; then
                echo "⚠️  发现 [$pattern_name]:" >> "$REPORT_FILE"
                echo "----------------------------------------" >> "$REPORT_FILE"
                cat "$temp_file" >> "$REPORT_FILE"
                echo "" >> "$REPORT_FILE"
                found_issues=$((found_issues + 1))
                
                # 显示前 5 条
                echo "  $(head -5 "$temp_file" | wc -l) 个匹配项（前 5 条显示）"
            fi
        fi
        
        rm -f "$temp_file"
    done
    
    return $found_issues
}

# 生成报告
generate_report() {
    local issue_count="$1"
    
    echo ""
    echo "========================"
    echo "扫描完成！"
    echo ""
    
    if [ "$issue_count" -gt 0 ]; then
        echo "❌ 发现 $issue_count 类潜在隐私信息"
        echo ""
        echo "详细报告：$REPORT_FILE"
        echo ""
        echo "建议操作："
        echo "1. 检查报告中的文件"
        echo "2. 确认是否为误报（如示例代码、文档说明）"
        echo "3. 如为真实敏感信息，立即移除或使用环境变量"
        echo "4. 如已泄露，立即更换相关凭证"
        return 1
    else
        echo "✅ 未发现隐私信息"
        return 0
    fi
}

# 检查特定文件（快速模式）
quick_check() {
    local file="$1"
    local found=0
    
    echo "快速检查：$file"
    
    for pattern_name in "${!PRIVACY_PATTERNS[@]}"; do
        local pattern="${PRIVACY_PATTERNS[$pattern_name]}"
        
        if grep -nE "$pattern" "$file" 2>/dev/null; then
            echo "⚠️  发现 [$pattern_name]"
            found=1
        fi
    done
    
    return $found
}

# 主流程
main() {
    # 检查目录是否存在
    if [ ! -d "$SCAN_DIR" ]; then
        echo "❌ 目录不存在：$SCAN_DIR"
        exit 1
    fi
    
    # 判断扫描模式
    if [ -f "$SCAN_DIR" ]; then
        # 单文件模式
        quick_check "$SCAN_DIR"
        exit $?
    fi
    
    # 目录模式
    local issue_count=0
    scan_directory "$SCAN_DIR"
    issue_count=$?
    
    generate_report "$issue_count"
    exit $?
}

# 执行
main
