#!/bin/bash
# search-agents.sh - 搜索 GitHub 智能体仓库
# 每天 6 点执行，搜索 AI agent/framework 相关仓库

set -e

# 配置
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
OUTPUT_DIR="/tmp/github_monitor_agents_$(date +%Y%m%d)"
SEARCH_KEYWORDS=("openclaw agent" "ai agent framework" "claude agent" "autonomous agent" "ai assistant framework")
RESULTS_FILE="$OUTPUT_DIR/agents-results.csv"

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

echo "🤖 开始搜索 GitHub 智能体仓库..."
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
    
    # 提取仓库信息（过滤 Star>=10 的仓库）
    jq -r '.items[] | select(.stargazers_count >= 10) | [.full_name, .html_url, (.description // "无描述"), .stargazers_count, .forks_count, .updated_at, (.language // "Unknown")] | @csv' \
        "$input_file" >> "$RESULTS_FILE"
}

# 检测 trending 仓库（近期 star 增长快）
detect_trending() {
    local trending_file="$OUTPUT_DIR/trending.json"
    local seven_days_ago=$(date -d '7 days ago' -Iseconds 2>/dev/null || date -v-7d -Iseconds 2>/dev/null || echo "2026-03-15T00:00:00Z")
    
    echo "[]" > "$trending_file"
    
    for file in "$OUTPUT_DIR"/*.json; do
        if [ -f "$file" ]; then
            # 筛选最近一周更新且 Star>100 的仓库
            jq --arg date "$seven_days_ago" \
               '.items[] | select(.updated_at > $date) | select(.stargazers_count > 100)' \
               "$file" >> "$trending_file" 2>/dev/null || true
        fi
    done
    
    local trending_count=$(jq -s 'length' "$trending_file" 2>/dev/null || echo 0)
    echo "发现 trending 仓库：$trending_count 个"
}

# 生成统计报告
generate_report() {
    local report_file="$OUTPUT_DIR/report.md"
    
    cat > "$report_file" << EOF
# GitHub 智能体仓库监控报告

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
    
    # Trending 仓库
    if [ -f "$OUTPUT_DIR/trending.json" ] && [ -s "$OUTPUT_DIR/trending.json" ]; then
        local trending_count=$(jq -s 'length' "$OUTPUT_DIR/trending.json" 2>/dev/null || echo 0)
        if [ "$trending_count" -gt 0 ]; then
            echo "" >> "$report_file"
            echo "## 🔥 Trending 仓库（近 7 天）" >> "$report_file"
            echo "" >> "$report_file"
            jq -r '.[] | "- [\( .full_name )](\( .html_url )) - ⭐ \( .stargazers_count )"' \
                "$OUTPUT_DIR/trending.json" >> "$report_file" 2>/dev/null || true
        fi
    fi
    
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
    
    # 3. 检测 trending
    echo ""
    echo "检测 trending 仓库..."
    detect_trending
    
    # 4. 生成报告
    echo ""
    echo "生成统计报告..."
    generate_report
    
    # 5. 显示摘要
    echo ""
    echo "========================"
    echo "监控完成！"
    echo "结果目录：$OUTPUT_DIR"
    echo "总仓库数：$(tail -n +2 "$RESULTS_FILE" | wc -l)"
    echo "结果文件：$RESULTS_FILE"
}

# 执行
main
