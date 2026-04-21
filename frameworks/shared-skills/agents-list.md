# 🤖 AI Agents 框架仓库列表

> 📅 最后更新：2026-03-22 11:52 | ⏰ 每天 6:00 自动更新

## 📊 统计摘要

| 指标 | 数值 |
|------|------|
| 总仓库数 | - |
| 总 Star 数 | - |
| 热门仓库 (>50⭐) | - |

---

## 🔥 热门 Agents 推荐

> ⭐ Star > 50 或 Fork > 20 的仓库会在这里显示并通知用户

| 仓库名称 | 地址 | 说明 | ⭐ | 🍴 | 更新 |
|---------|------|------|-----|-----|------|
| *暂无数据* | - | 配置 GITHUB_TOKEN 后自动获取 | - | - | - |

---

## 📦 全部 Agents 列表

| 仓库名称 | 地址 | 说明 | ⭐ | 🍴 | 语言 | 更新 |
|---------|------|------|-----|-----|------|------|
| *等待数据* | - | 配置 GITHUB_TOKEN 后自动获取 | - | - | - | - |

---

## ⚙️ 配置说明

### 1. 获取 GitHub Token

访问：https://github.com/settings/tokens

创建 Personal Access Token，勾选权限：
- ✅ `public_repo` - 读取公开仓库
- ✅ `repo` - 读取仓库信息（推荐）

### 2. 配置 Token

**方法 A：环境变量**
```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
```

**方法 B：写入配置文件**
```bash
echo "GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx" > ~/.openclaw/github_token
```

### 3. 测试配置

```bash
cd /home/ubuntu/openclaw-hub/skills/github-hub-manager
bash search-agents.sh
```

### 4. 定时任务

已配置 Cron：
- ⏰ **每天 6:00** - 自动搜索并更新此列表
- 🔔 **热门检测** - 发现热门仓库自动飞书通知

---

## 📝 数据来源

- 搜索关键词：`ai agent framework`, `llm agent`, `autonomous agent`, `crewai`, `langchain agent`
- 排序：按 Star 数降序
- 过滤：Star ≥ 10

---

*此文件由 github-hub-manager 技能自动生成*
