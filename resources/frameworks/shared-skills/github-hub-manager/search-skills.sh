#!/bin/bash
# search-skills.sh - 搜索 GitHub 技能仓库
# 每天 6 点执行，搜索 openclaw/claude skill 相关仓库

set -e

# 配置
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
OUTPUT_DIR="/tmp/github_monitor_skills_$(date +%Y%m%d)"
SEARCH_KEYWORDS=("openclaw skill" "claude skill" "openclaw skills" "claude-code skill")
RESULTS_FILE="$OUTPUT_DIR/skills-results.csv"

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

echo "🔍 开始搜索 GitHub 技能仓库..."
echo "时间：$(date)"
echo "========================"

# 初始化结果文件
echo "仓库名称，URL，描述，Star 数，Fork 数，更新时间，主要语言" > "$RESULTS_FILE"

# 搜索函数
search_github() {
    local keyword="$1"
    local output_file="$OUTPUT_DIR/${keyword// /_}.json"
    
    echo "搜索：$keyword"
    
    # GitHub Search API
    if [ -n "$GITHUB_TOKEN" ]; then
        curl -s -H "Authorization: token $GITHUB_TOKEN" \
             "https://api.github.com/search/repositories?q=$keyword&sort=stars&order=desc&per_page=50" \
             > "$output_file"
    else
        echo "⚠️  警告：未配置 GITHUB_TOKEN，使用未认证请求（限流 60 次/小时）"
        curl -s \
             "https://api.github.com/search/repositories?q=$keyword&sort=stars&order=desc&per_page=50" \
             > "$output_file"
    fi
    
    # 检查是否有限流
    if grep -q "API rate limit exceeded" "$output_file"; then
        echo "❌ GitHub API 限流，请稍后再试或配置 GITHUB_TOKEN"
        return 1
    fi
    
    echo "✓ 完成：$output_file"
}

# 解析结果并提取信息
parse_results() {
    local input_file="$1"
    
    if [ ! -f "$input_file" ] || [ ! -s "$input_file" ]; then
        return
    fi
    
    # 提取仓库信息（跳过已处理的）
    jq -r '.items[] | select(.stargazers_count >= 10) | [.full_name, .html_url, (.description // "无描述"), .stargazers_count, .forks_count, .updated_at, (.language // "Unknown")] | @csv' \
        "$input_file" >> "$RESULTS_FILE"
}

# 生成统计报告
generate_report() {
    local report_file="$OUTPUT_DIR/report.md"
    
    cat > "$report_file" << EOF
# GitHub 技能仓库监控报告

**生成时间**: $(date '+%Y-%m-%d %H:%M:%S')

## 统计摘要

EOF
    
    # 统计总数
    local total=$(tail -n +2 "$RESULTS_FILE" | wc -l)
    echo "- **总仓库数**: $total" >> "$report_file"
    
    # 统计 Star 数
    local total_stars=$(tail -n +2 "$RESULTS_FILE" | cut -d',' -f4 | awk '{sum+=$1} END {print sum}')
    echo "- **总 Star 数**: $total_stars" >> "$report_file"
    
    # 按语言统计
    echo "" >> "$report_file"
    echo "## 按语言分布" >> "$report_file"
    echo '```' >> "$report_file"
    tail -n +2 "$RESULTS_FILE" | cut -d',' -f7 | sort | uniq -c | sort -rn >> "$report_file"
    echo '```' >> "$report_file"
    
    # Top 10 仓库
    echo "" >> "$report_file"
    echo "## Top 10 热门仓库" >> "$report_file"
    echo "" >> "$report_file"
    echo "| 排名 | 仓库 | Star | 更新 |" >> "$report_file"
    echo "|------|------|------|------|" >> "$report_file"
    tail -n +2 "$RESULTS_FILE" | sort -t',' -k4 -rn | head -10 | \
        awk -F',' '{printf "| %d | [%s](%s) | %s | %s |\n", NR, $1, $2, $4, $6}' >> "$report_file"
    
    echo "✓ 报告已生成：$report_file"
}

# 主流程
main() {
    local success_count=0
    local fail_count=0
    
    # 1. 搜索关键词
    for keyword in "${SEARCH_KEYWORDS[@]}"; do
        if search_github "$keyword"; then
            success_count=$((success_count + 1))
        else
            fail_count=$((fail_count + 1))
        fi
    done
    
    echo ""
    echo "搜索完成：成功 $success_count 个，失败 $fail_count 个"
    
    # 2. 解析结果
    echo ""
    echo "解析搜索结果..."
    for file in "$OUTPUT_DIR"/*.json; do
        if [ -f "$file" ]; then
            parse_results "$file"
        fi
    done
    
    # 去重（按仓库名称）
    if [ -f "$RESULTS_FILE" ]; then
        head -1 "$RESULTS_FILE" > "$RESULTS_FILE.tmp"
        tail -n +2 "$RESULTS_FILE" | sort -t',' -k1 -u >> "$RESULTS_FILE.tmp"
        mv "$RESULTS_FILE.tmp" "$RESULTS_FILE"
    fi
    
    # 3. 生成报告
    echo ""
    echo "生成统计报告..."
    generate_report
    
    # 4. 显示摘要
    echo ""
    echo "========================"
    echo "监控完成！"
    echo "结果目录：$OUTPUT_DIR"
    echo "总仓库数：$(tail -n +2 "$RESULTS_FILE" | wc -l)"
    echo "结果文件：$RESULTS_FILE"
}

# 执行
main
