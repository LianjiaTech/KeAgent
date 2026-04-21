#!/bin/bash
# sync-to-github.sh - 本地智能体同步到 GitHub
# 每天 0 点执行，检查本地更新并推送到 GitHub

set -e

# 配置
GITHUB_REPO="${GITHUB_REPO:-https://github.com/username/openclaw-hub.git}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
LOCAL_HUB_DIR="${LOCAL_HUB_DIR:-/home/ubuntu/openclaw-hub}"
REMOTE_BRANCH="main"
BACKUP_DIR="/tmp/sync_backup_$(date +%Y%m%d_%H%M%S)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔄 开始同步本地智能体到 GitHub..."
echo "时间：$(date)"
echo "========================"

# 1. 备份当前状态
backup_current() {
    echo "[1/7] 备份当前状态..."
    mkdir -p "$BACKUP_DIR"
    
    # 备份关键目录
    if [ -d "$LOCAL_HUB_DIR/skills" ]; then
        cp -r "$LOCAL_HUB_DIR/skills" "$BACKUP_DIR/"
    fi
    if [ -d "$LOCAL_HUB_DIR/agents" ]; then
        cp -r "$LOCAL_HUB_DIR/agents" "$BACKUP_DIR/"
    fi
    if [ -d "$LOCAL_HUB_DIR/docs" ]; then
        cp -r "$LOCAL_HUB_DIR/docs" "$BACKUP_DIR/"
    fi
    
    echo "✓ 备份完成：$BACKUP_DIR"
}

# 2. 克隆/更新远程仓库
sync_remote() {
    echo "[2/7] 同步远程仓库..."
    REMOTE_DIR="/tmp/openclaw-hub-remote"
    
    if [ -d "$REMOTE_DIR/.git" ]; then
        cd "$REMOTE_DIR"
        git pull origin "$REMOTE_BRANCH"
    else
        rm -rf "$REMOTE_DIR"
        git clone "$GITHUB_REPO" "$REMOTE_DIR"
        cd "$REMOTE_DIR"
    fi
    
    echo "✓ 远程仓库同步完成"
}

# 3. 对比差异
check_diff() {
    echo "[3/7] 检查差异..."
    
    DIFF_FILE="$REMOTE_DIR/diff_report.txt"
    > "$DIFF_FILE"
    
    # 对比 skills 目录
    if [ -d "$LOCAL_HUB_DIR/skills" ]; then
        echo "对比：skills" >> "$DIFF_FILE"
        if [ -d "$REMOTE_DIR/skills" ]; then
            diff -rq "$LOCAL_HUB_DIR/skills" "$REMOTE_DIR/skills" >> "$DIFF_FILE" 2>/dev/null || true
        fi
    fi
    
    # 对比 agents 目录
    if [ -d "$LOCAL_HUB_DIR/agents" ]; then
        echo "对比：agents" >> "$DIFF_FILE"
        if [ -d "$REMOTE_DIR/agents" ]; then
            diff -rq "$LOCAL_HUB_DIR/agents" "$REMOTE_DIR/agents" >> "$DIFF_FILE" 2>/dev/null || true
        fi
    fi
    
    # 对比 docs 目录
    if [ -d "$LOCAL_HUB_DIR/docs" ]; then
        echo "对比：docs" >> "$DIFF_FILE"
        if [ -d "$REMOTE_DIR/docs" ]; then
            diff -rq "$LOCAL_HUB_DIR/docs" "$REMOTE_DIR/docs" >> "$DIFF_FILE" 2>/dev/null || true
        fi
    fi
    
    # 显示差异
    if [ -s "$DIFF_FILE" ]; then
        echo "发现差异："
        cat "$DIFF_FILE"
    else
        echo "✓ 无差异，无需同步"
        exit 0
    fi
}

# 4. 安全检测（调用 privacy-scan.sh）
security_check() {
    echo "[4/7] 安全检测..."
    
    PRIVACY_SCAN_SCRIPT="$SCRIPT_DIR/privacy-scan.sh"
    
    if [ -x "$PRIVACY_SCAN_SCRIPT" ]; then
        if ! "$PRIVACY_SCAN_SCRIPT" "$LOCAL_HUB_DIR"; then
            echo "❌ 安全检测失败，请检查隐私信息"
            exit 1
        fi
    else
        echo "⚠️  隐私扫描脚本不存在，使用内置检测..."
        
        # 内置检测逻辑
        PRIVACY_PATTERNS=(
            "token['\"]?\\s*[:=]\\s*['\"][^'\"]{20,}['\"]"
            "secret['\"]?\\s*[:=]\\s*['\"][^'\"]{10,}['\"]"
            "password['\"]?\\s*[:=]\\s*['\"][^'\"]{6,}['\"]"
            "api_key['\"]?\\s*[:=]\\s*['\"][^'\"]{16,}['\"]"
        )
        
        FOUND_ISSUES=0
        
        for pattern in "${PRIVACY_PATTERNS[@]}"; do
            if grep -rE "$pattern" "$LOCAL_HUB_DIR" \
                --include="*.md" \
                --include="*.json" \
                --include="*.yaml" \
                --include="*.yml" \
                --exclude-dir=".git" \
                2>/dev/null; then
                echo "⚠️  发现可能的隐私信息：$pattern"
                FOUND_ISSUES=1
            fi
        done
        
        if [ $FOUND_ISSUES -eq 1 ]; then
            echo "❌ 安全检测失败，请检查隐私信息"
            exit 1
        fi
    fi
    
    echo "✓ 安全检测通过"
}

# 5. 同步文件
sync_files() {
    echo "[5/7] 同步文件..."
    
    # 同步 skills
    if [ -d "$LOCAL_HUB_DIR/skills" ]; then
        mkdir -p "$REMOTE_DIR/skills"
        cp -r "$LOCAL_HUB_DIR/skills/"* "$REMOTE_DIR/skills/" 2>/dev/null || true
        echo "✓ skills 同步完成"
    fi
    
    # 同步 agents
    if [ -d "$LOCAL_HUB_DIR/agents" ]; then
        mkdir -p "$REMOTE_DIR/agents"
        cp -r "$LOCAL_HUB_DIR/agents/"* "$REMOTE_DIR/agents/" 2>/dev/null || true
        echo "✓ agents 同步完成"
    fi
    
    # 同步 docs
    if [ -d "$LOCAL_HUB_DIR/docs" ]; then
        mkdir -p "$REMOTE_DIR/docs"
        cp -r "$LOCAL_HUB_DIR/docs/"* "$REMOTE_DIR/docs/" 2>/dev/null || true
        echo "✓ docs 同步完成"
    fi
    
    # 同步根目录文件
    for file in README.md LICENSE install.md PROJECT_SUMMARY.md; do
        if [ -f "$LOCAL_HUB_DIR/$file" ]; then
            cp "$LOCAL_HUB_DIR/$file" "$REMOTE_DIR/"
        fi
    done
}

# 6. 提交
commit_changes() {
    echo "[6/7] 提交变更..."
    
    cd "$REMOTE_DIR"
    
    # 配置 git
    git config user.name "OpenClaw Sync Bot"
    git config user.email "sync@openclaw-hub.com"
    
    # 添加变更
    git add -A
    
    # 检查是否有变更
    if git diff --staged --quiet; then
        echo "✓ 无变更，跳过提交"
        exit 0
    fi
    
    # 提交
    COMMIT_MSG="chore: 自动同步本地更新 $(date +%Y-%m-%d)"
    git commit -m "$COMMIT_MSG"
    
    echo "✓ 提交完成"
}

# 7. 推送
push_to_github() {
    echo "[7/7] 推送到 GitHub..."
    
    cd "$REMOTE_DIR"
    
    # 构建带 token 的远程 URL
    if [ -n "$GITHUB_TOKEN" ]; then
        REMOTE_URL="${GITHUB_REPO/https:\/\/github\.com/https:\/\/$GITHUB_TOKEN@github.com}"
    else
        REMOTE_URL="$GITHUB_REPO"
        echo "⚠️  警告：未配置 GITHUB_TOKEN，推送可能失败"
    fi
    
    # 推送
    if git push "$REMOTE_URL" "$REMOTE_BRANCH"; then
        echo "✓ 推送完成"
    else
        echo "❌ 推送失败，从备份恢复..."
        echo "备份位置：$BACKUP_DIR"
        exit 1
    fi
}

# 主流程
main() {
    backup_current
    sync_remote
    check_diff
    security_check
    sync_files
    commit_changes
    push_to_github
    
    echo ""
    echo "========================"
    echo "✅ 同步完成！"
    echo "备份位置：$BACKUP_DIR"
}

# 执行
main
