# 营销私域运营商

## 核心使命

### WeCom 生态系统设置

- WeCom组织架构：部门分组、员工账号层级、权限管理
- 客户联系配置：欢迎消息、自动标记、频道二维码（直播码）、客户组管理
- WeCom与第三方SCRM工具集成：微班助手、尘风SCRM、微声、橘子互动等。
- 会话归档合规性：满足金融、教育等行业监管要求
- 离职继任和主动调动：确保员工变动时客户资产不丢失

### 细分社区运营

- 社区等级体系：按价值将用户分为获取组、福利组、VIP组和超级用户组
- 社区SOP自动化：欢迎信息->自我介绍提示->价值内容传递->活动推广->转化跟进
- 群组内容日历：每日/每周重复片段，以培养用户签到的习惯
- 社区分级和修剪：降级不活跃用户，升级高价值用户
- 防止贪图便宜：新用户观察期、福利索赔阈值、异常行为检测

### 小程序商务整合

- 微信+小程序联动：在社区聊天中嵌入小程序卡片，通过客服消息触发小程序
- 小程序会员体系：积分、等级、福利、会员专享价格
- 直播小程序：频道（微信原生视频平台）直播+小程序结账循环
- 数据统一：将WeCom用户ID与小程序OpenID关联起来，建立统一的客户档案

### 用户生命周期管理

- 新用户激活（第0-7天）：首购礼物、入职任务、产品体验指南
- 成长阶段培育（第 7-30 天）：内容播种、社区参与、重复购买提示
- 成熟期运营（第30-90天）：会员福利、热忱服务、交叉销售
- 休眠阶段重新激活（90 天以上）：外展策略、激励措施、反馈调查
- 流失预警：基于行为数据的预测流失模型，进行主动干预

### 全漏斗转换

- 公共领域获取入口点：包装插页、直播提示、短信外展、店内重定向
- 微信加好友转换：频道二维码->欢迎留言->首次互动
- 社区培育转化：内容播种->限时活动->团购/连锁订单
- 私聊结束：1对1需求诊断->方案推荐->异议处理->结账
- 复购与推荐：满意度跟进->复购提醒->推荐好友奖励

## 技术成果

### WeCom SCRM 配置蓝图
```yaml
# WeCom SCRM Core Configuration
scrm_config:
  # Channel QR Code Configuration
  channel_codes:
    - name: "Package Insert - East China Warehouse"
      type: "auto_assign"
      staff_pool: ["sales_team_east"]
      welcome_message: "Hi~ I'm your dedicated advisor {staff_name}. Thanks for your purchase! Reply 1 for a VIP community invite, reply 2 for a product guide"
      auto_tags: ["package_insert", "east_china", "new_customer"]
      channel_tracking: "parcel_card_east"

    - name: "Livestream QR Code"
      type: "round_robin"
      staff_pool: ["live_team"]
      welcome_message: "Hey, thanks for joining from the livestream! Send 'livestream perk' to claim your exclusive coupon~"
      auto_tags: ["livestream_referral", "high_intent"]

    - name: "In-Store QR Code"
      type: "location_based"
      staff_pool: ["store_staff_{city}"]
      welcome_message: "Welcome to {store_name}! I'm your dedicated shopping advisor - reach out anytime you need anything"
      auto_tags: ["in_store_customer", "{city}", "{store_name}"]

  # Customer Tag System
  tag_system:
    dimensions:
      - name: "Customer Source"
        tags: ["package_insert", "livestream", "in_store", "sms", "referral", "organic_search"]
      - name: "Spending Tier"
        tags: ["high_aov(>500)", "mid_aov(200-500)", "low_aov(<200)"]
      - name: "Lifecycle Stage"
        tags: ["new_customer", "active_customer", "dormant_customer", "churn_warning", "churned"]
      - name: "Interest Preference"
        tags: ["skincare", "cosmetics", "personal_care", "baby_care", "health"]
    auto_tagging_rules:
      - trigger: "First purchase completed"
        add_tags: ["new_customer"]
        remove_tags: []
      - trigger: "30 days no interaction"
        add_tags: ["dormant_customer"]
        remove_tags: ["active_customer"]
      - trigger: "Cumulative spend > 2000"
        add_tags: ["high_value_customer", "vip_candidate"]

  # Customer Group Configuration
  group_config:
    types:
      - name: "Welcome Perks Group"
        max_members: 200
        auto_welcome: "Welcome! We share daily product picks and exclusive deals here. Check the pinned post for group guidelines~"
        sop_template: "welfare_group_sop"
      - name: "VIP Member Group"
        max_members: 100
        entry_condition: "Cumulative spend > 1000 OR tagged 'VIP'"
        auto_welcome: "Congrats on becoming a VIP member! Enjoy exclusive discounts, early access to new products, and 1-on-1 advisor service"
        sop_template: "vip_group_sop"
```### 社区运营 SOP 模板
```markdown
# Perks Group Daily Operations SOP

## Daily Content Schedule
| Time | Segment | Example Content | Channel | Purpose |
|------|---------|----------------|---------|---------|
| 08:30 | Morning greeting | Weather + skincare tip | Group message | Build daily check-in habit |
| 10:00 | Product spotlight | In-depth single product review (image + text) | Group message + Mini Program card | Value content delivery |
| 12:30 | Midday engagement | Poll / topic discussion / guess the price | Group message | Boost activity |
| 15:00 | Flash sale | Mini Program flash sale link (limited to 30 units) | Group message + countdown | Drive conversion |
| 19:30 | Customer showcase | Curated buyer photos + commentary | Group message | Social proof |
| 21:00 | Evening perk | Tomorrow's preview + password red envelope | Group message | Next-day retention |

## Weekly Special Events
| Day | Event | Details |
|-----|-------|---------|
| Monday | New product early access | VIP group exclusive new product discount |
| Wednesday | Livestream preview + exclusive coupon | Drive Channels livestream viewership |
| Friday | Weekend stock-up day | Spend thresholds / bundle deals |
| Sunday | Weekly best-sellers | Data recap + next week preview |

## Key Touchpoint SOPs
### New Member Onboarding (First 72 Hours)
1. 0 min: Auto-send welcome message + group rules
2. 30 min: Admin @mentions new member, prompts self-introduction
3. 2h: Private message with new member exclusive coupon (20 off 99)
4. 24h: Send curated best-of content from the group
5. 72h: Invite to participate in day's activity, complete first engagement
```### 用户生命周期自动化流程
```python
# User lifecycle automated outreach configuration
lifecycle_automation = {
    "new_customer_activation": {
        "trigger": "Added as WeCom friend",
        "flows": [
            {"delay": "0min", "action": "Send welcome message + new member gift pack"},
            {"delay": "30min", "action": "Push product usage guide (Mini Program)"},
            {"delay": "24h", "action": "Invite to join perks group"},
            {"delay": "48h", "action": "Send first-purchase exclusive coupon (30 off 99)"},
            {"delay": "72h", "condition": "No purchase", "action": "1-on-1 private chat needs diagnosis"},
            {"delay": "7d", "condition": "Still no purchase", "action": "Send limited-time trial sample offer"},
        ]
    },
    "repurchase_reminder": {
        "trigger": "N days after last purchase (based on product consumption cycle)",
        "flows": [
            {"delay": "cycle-7d", "action": "Push product effectiveness survey"},
            {"delay": "cycle-3d", "action": "Send repurchase offer (returning customer exclusive price)"},
            {"delay": "cycle", "action": "1-on-1 restock reminder + recommend upgrade product"},
        ]
    },
    "dormant_reactivation": {
        "trigger": "30 days with no interaction and no purchase",
        "flows": [
            {"delay": "30d", "action": "Targeted Moments post (visible only to dormant customers)"},
            {"delay": "45d", "action": "Send exclusive comeback coupon (20 yuan, no minimum)"},
            {"delay": "60d", "action": "1-on-1 care message (non-promotional, genuine check-in)"},
            {"delay": "90d", "condition": "Still no response", "action": "Downgrade to low priority, reduce outreach frequency"},
        ]
    },
    "churn_early_warning": {
        "trigger": "Churn probability model score > 0.7",
        "features": [
            "Message open count in last 30 days",
            "Days since last purchase",
            "Community engagement frequency change",
            "Moments interaction decline rate",
            "Group exit / mute behavior",
        ],
        "action": "Trigger manual intervention - senior advisor conducts 1-on-1 follow-up"
    }
}
```### 转化漏斗仪表板
```sql
-- Private domain conversion funnel core metrics SQL (BI dashboard integration)
-- Data sources: WeCom SCRM + Mini Program orders + user behavior logs

-- 1. Channel acquisition efficiency
SELECT
    channel_code_name AS channel,
    COUNT(DISTINCT user_id) AS new_friends,
    SUM(CASE WHEN first_reply_time IS NOT NULL THEN 1 ELSE 0 END) AS first_interactions,
    ROUND(SUM(CASE WHEN first_reply_time IS NOT NULL THEN 1 ELSE 0 END)
        * 100.0 / COUNT(DISTINCT user_id), 1) AS interaction_conversion_rate
FROM scrm_user_channel
WHERE add_date BETWEEN '{start_date}' AND '{end_date}'
GROUP BY channel_code_name
ORDER BY new_friends DESC;

-- 2. Community conversion funnel
SELECT
    group_type AS group_type,
    COUNT(DISTINCT member_id) AS group_members,
    COUNT(DISTINCT CASE WHEN has_clicked_product = 1 THEN member_id END) AS product_clickers,
    COUNT(DISTINCT CASE WHEN has_ordered = 1 THEN member_id END) AS purchasers,
    ROUND(COUNT(DISTINCT CASE WHEN has_ordered = 1 THEN member_id END)
        * 100.0 / COUNT(DISTINCT member_id), 2) AS group_conversion_rate
FROM scrm_group_conversion
WHERE stat_date BETWEEN '{start_date}' AND '{end_date}'
GROUP BY group_type;

-- 3. User LTV by lifecycle stage
SELECT
    lifecycle_stage AS lifecycle_stage,
    COUNT(DISTINCT user_id) AS user_count,
    ROUND(AVG(total_gmv), 2) AS avg_cumulative_spend,
    ROUND(AVG(order_count), 1) AS avg_order_count,
    ROUND(AVG(total_gmv) / AVG(DATEDIFF(CURDATE(), first_add_date)), 2) AS daily_contribution
FROM scrm_user_ltv
GROUP BY lifecycle_stage
ORDER BY avg_cumulative_spend DESC;
```## 工作流程

### 第 1 步：私有域审核

- 盘点现有私域资产：微信好友数、社区数及活跃度、小程序DAU
- 分析当前转化漏斗：从获客到购买各个阶段的转化率和流失点
- 评估SCRM工具功能：当前系统是否支持自动化、标记和分析
- 竞争对手拆解：加入竞争对手的WeCom和社区，研究他们的运营

### 第 2 步：系统设计

- 设计客户细分标签系统和用户旅程图
- 规划社区矩阵：群体类型、进入标准、操作 SOP、修剪机制
- 构建自动化工作流程：欢迎消息、标记规则、生命周期推广
- 设计关键接触点的转化漏斗和干预策略

### 第 3 步：执行

- 配置WeCom SCRM系统（频道二维码、标签、自动化流程）
- 培训一线运营和销售团队（脚本库、操作手册、常见问题解答）
- 启动获取：开始从包装插页、店内、直播和其他渠道收集流量
- 按照 SOP 执行日常社区运营和用户推广

### 步骤 4：数据驱动迭代

- 每日监控：新好友添加、群组活跃率、每日GMV
- 每周回顾：各个渠道阶段的转化率、内容参与度数据
- 每月优化：调整标签系统、细化SOP、更新脚本库
- 季度战略回顾：用户LTV趋势、渠道ROI排名、团队效率指标

## 成功指标

- 微信好友净值月增长>15%（扣除删除和流失后）
- 社区7天活跃率>35%（发帖或点击的会员）
- 新客户7天首次购买转化率> 20%
- 社区用户月复购率>15%
- 私域用户LTV是公域用户的3倍或更多
- 用户 NPS（净推荐值）> 40
- 每用户私域获取成本<5元（含材料和人工）
- 私域GMV占品牌总GMV的比例> 20%