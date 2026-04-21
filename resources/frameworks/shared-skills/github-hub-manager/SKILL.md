---
name: github-hub-manager
description: |
  GitHub 智能体中心监控与管理工具。自动搜索 GitHub 上的技能和智能体仓库，同步本地更新到 GitHub，隐私扫描检测。

  **当以下情况时使用此 Skill**：
  (1) 需要监控 GitHub 上的 openclaw/claude 技能仓库
  (2) 需要搜索新的智能体框架或 Agent 项目
  (3) 需要将本地技能/智能体同步到 GitHub 仓库
  (4) 用户提到"GitHub 监控"、"技能搜索"、"仓库同步"、"隐私扫描"
  (5) 需要从 URL 安装技能或智能体
---

# GitHub Hub Manager SKILL

## 🎯 核心功能

本技能提供完整的 GitHub 智能体中心管理能力，包括：

1. **自动监控** - 定时搜索 GitHub 上的技能和智能体仓库
2. **隐私扫描** - 检测敏感信息（token、secret、password 等）
3. **同步推送** - 将本地更新自动同步到 GitHub
4. **便捷安装** - 从 URL 直接安装技能/智能体

---

## 📁 脚本文件说明

| 脚本 | 功能 | 执行时间 |
|------|------|---------|
| `search-skills.sh` | 搜索 GitHub 技能仓库 | 每天 6:00 |
| `search-agents.sh` | 搜索 GitHub 智能体仓库 | 每天 6:00 |
| `sync-to-github.sh` | 同步本地到 GitHub | 每天 0:00 |
| `privacy-scan.sh` | 隐私信息检测 | 手动/同步前 |
| `install-from-url.sh` | 从 URL 安装 | 手动 |

---

## 🔧 配置说明

### 环境变量

在 `.env` 或系统环境变量中配置：

```bash
# GitHub 配置
GITHUB_TOKEN="your_github_token"
GITHUB_REPO="https://github.com/username/openclaw-hub.git"

# 飞书配置（可选，用于通知）
FEISHU_WEBHOOK="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
BITABLE_APP_TOKEN="your_bitable_token"

# 本地路径
LOCAL_AGENTS_DIR="$HOME/.openclaw/workspace-*"
OUTPUT_DIR="/tmp/github_monitor"
```

### Cron 配置

使用 `openclaw cron` 配置定时任务：

```bash
# 早 6 点：搜索技能和智能体
0 6 * * * /path/to/search-skills.sh
0 6 * * * /path/to/search-agents.sh

# 晚 12 点：同步到 GitHub
0 0 * * * /path/to/sync-to-github.sh
```

---

## 📋 使用场景

### 场景 1: 手动搜索技能仓库

```bash
cd /home/ubuntu/openclaw-hub/skills/github-hub-manager
./search-skills.sh
```

**输出示例**：
```
🔍 开始搜索 GitHub 技能仓库...
时间：2026-03-22 11:00:00
========================
搜索：openclaw skill
✓ 发现 15 个仓库
搜索：claude skill
✓ 发现 23 个仓库
...
========================
搜索完成！
结果目录：/tmp/github_monitor_20260322
```

### 场景 2: 隐私扫描

在同步到 GitHub 前执行隐私检测：

```bash
./privacy-scan.sh /path/to/local/skills
```

**检测模式**：
- Token/Secret/Password 等敏感词
- 邮箱地址
- API Key
- 私有配置信息

### 场景 3: 从 URL 安装技能

```bash
./install-from-url.sh https://github.com/user/repo/tree/main/skills/skill-name
```

**支持格式**：
- GitHub 仓库 URL
- 完整路径（包含技能目录）
- 自动克隆到本地 skills 目录

---

## ⚠️ 注意事项

### 安全约束

1. **同步前必须扫描** - `sync-to-github.sh` 会自动调用 `privacy-scan.sh`
2. **Token 保护** - 使用环境变量，不要硬编码
3. **备份机制** - 同步前自动备份到 `/tmp/sync_backup_YYYYMMDD_HHMMSS`
4. **失败回滚** - 同步失败可从备份恢复

### 速率限制

- GitHub API: 未认证 60 次/小时，认证 5000 次/小时
- 建议配置 `GITHUB_TOKEN` 避免限流
- 搜索脚本使用分批请求，避免触发限流

### 路径规范

- 技能目录：`/home/ubuntu/openclaw-hub/skills/`
- 智能体目录：`/home/ubuntu/openclaw-hub/agents/`
- 输出目录：`/tmp/github_monitor_YYYYMMDD`

---

## 🔍 故障排查

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| GitHub API 限流 | 未配置 token 或超限 | 配置 `GITHUB_TOKEN`，等待重置 |
| 同步失败 | Git 配置错误 | 检查 `git config user.name/email` |
| 隐私扫描报错 | 文件权限问题 | `chmod +x *.sh` |
| Cron 不执行 | 路径错误 | 使用绝对路径，检查 `crontab -l` |

---

## 📚 相关文件

- **技能列表**: `/home/ubuntu/openclaw-hub/skills/skills-list.md`
- **智能体列表**: `/home/ubuntu/openclaw-hub/agents/agents-list.md`
- **监控日志**: `/tmp/github_monitor_*/`
- **备份目录**: `/tmp/sync_backup_*/`

---

## 🚀 快速开始

1. **配置环境变量**
   ```bash
   export GITHUB_TOKEN="your_token"
   export GITHUB_REPO="https://github.com/your-username/openclaw-hub.git"
   ```

2. **测试搜索脚本**
   ```bash
   ./search-skills.sh
   ```

3. **配置 Cron**
   ```bash
   crontab -e
   # 添加定时任务（见上方配置说明）
   ```

4. **验证 Cron**
   ```bash
   crontab -l  # 查看已配置的任务
   ```

---

_最后更新：2026-03-22_
