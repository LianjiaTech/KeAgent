# feishu-wizard - 飞书机器人配置向导（参考 openakita）

## 功能特性

✅ **参考 openakita/setup/wizard.py 实现**
- 流式输出（交互式进度显示）
- 分步引导（Step 1/2/3...）
- 丰富的 Emoji 图标
- 错误处理和重试

✅ **核心功能**
1. **模式 1: 手动输入凭证** - 适合已有 appId/appSecret
2. **模式 2: Device Flow 扫码** - 自动创建飞书应用
3. **群聊回复模式配置** - groupPolicy 设置
4. **自动 dmPolicy: 'open'** - 无需配对

---

## 使用示例

### 模式 1: 手动输入凭证

```javascript
import feishu_wizard from './feishu-wizard.js';

const result = await feishu_wizard({
  account_name: 'ceo',
  app_id: 'cli_a93cf8d6b53b9cd5',
  app_secret: 'j8PgtNlX6jHN1BxSfSjMVcsWDrP52rju',
  interactive: true,
});

console.log(result);
```

**输出**：
```
[Step 1] 使用已有凭证
══════════════════════════════════════════════════════════
ℹ️  App ID: cli_a93cf8...
ℹ️  App Secret: ********

[Step 2] 验证凭证
══════════════════════════════════════════════════════════
✅ 凭证验证通过 ✅

[Step 3] 保存配置
══════════════════════════════════════════════════════════
✅ 配置已保存到 [ceo] ✅

[Step 4] 完成
══════════════════════════════════════════════════════════
✅ 飞书机器人绑定完成！🎉
```

---

### 模式 2: Device Flow 扫码

```javascript
const result = await feishu_wizard({
  account_name: 'writer',
  domain: 'feishu',
  send_to_feishu: true,
  user_open_id: 'ou_d6f374a3c5f7b1c0472ad5dd178e9441',
  interactive: true,
});
```

**输出**：
```
[Step 1] 初始化 OAuth 会话
══════════════════════════════════════════════════════════

[Step 2] 启动 Device Flow
══════════════════════════════════════════════════════════

[Step 3] 生成二维码
══════════════════════════════════════════════════════════
✅ 二维码已保存：/tmp/openclaw/feishu_qr_2026-03-21T0630.png

[Step 4] 发送二维码到飞书
══════════════════════════════════════════════════════════
✅ 二维码已发送到飞书 ✅

[Step 5] 等待授权
══════════════════════════════════════════════════════════
══════════════════════════════════════════════════════════
请扫描二维码完成授权
══════════════════════════════════════════════════════════
[QR Code ASCII Art]
══════════════════════════════════════════════════════════

⏳ 开始轮询（超时：600 秒，间隔：5 秒）
✅ 授权成功（尝试 3 次）

[Step 6] 验证凭证
══════════════════════════════════════════════════════════
✅ 凭证验证通过 ✅

[Step 7] 保存配置
══════════════════════════════════════════════════════════
✅ 配置已保存到 [writer] ✅

[Step 8] 完成
══════════════════════════════════════════════════════════
✅ 飞书机器人绑定完成！🎉
```

---

### 配置群聊回复模式

```javascript
const result = await feishu_wizard({
  account_name: 'social',
  group_policy: 'open',        // open | allowlist | disabled
  require_mention: false,      // 群聊是否需要 @机器人
  interactive: true,
});
```

---

## 参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `domain` | string | `'feishu'` | 飞书域名 (`feishu` \| `lark`) |
| `account_name` | string | `'ceo'` | 账户名称（agent 的 accountId） |
| `app_id` | string | - | 手动输入的 App ID（跳过扫码） |
| `app_secret` | string | - | 手动输入的 App Secret（跳过扫码） |
| `group_policy` | string | `'open'` | 群聊策略 (`open` \| `allowlist` \| `disabled`) |
| `require_mention` | boolean | `false` | 群聊是否需要 @机器人 |
| `send_to_feishu` | boolean | `false` | 是否发送二维码到飞书 |
| `user_open_id` | string | - | 接收者的飞书 open_id |
| `interactive` | boolean | `true` | 是否启用交互式输出 |

---

## 群聊策略说明

| group_policy | 说明 | 适用场景 |
|-------------|------|---------|
| **`open`** | ✅ 允许所有群聊 | 推荐（默认） |
| `allowlist` | 只允许配置的群聊 | 企业白名单 |
| `disabled` | 禁用群聊 | 仅私聊 |

---

## 返回结果

### 成功

```javascript
{
  success: true,
  app_id: "cli_a934a108bab89bd3",
  app_secret: "xxxxx",
  account_name: "writer",
  group_policy: "open",
  require_mention: false,
  message: "绑定成功！dmPolicy: open（无需配对）"
}
```

### 失败

```javascript
{
  success: false,
  error: "INVALID_CREDENTIALS",
  message: "凭证验证失败：App Secret 错误"
}
```

---

## 配置结构

保存后的配置（`~/.keagent/openclaw.json`）：

```json
{
  "channels": {
    "feishu": {
      "accounts": {
        "writer": {
          "appId": "cli_a934a108bab89bd3",
          "appSecret": "xxxxx",
          "domain": "feishu",
          "dmPolicy": "open",
          "connectionMode": "websocket",
          "enabled": true,
          "groupPolicy": "open",
          "requireMention": false
        }
      }
    }
  }
}
```

---

## 与 openakita 对比

| 功能 | openakita wizard | feishu-wizard |
|------|-----------------|---------------|
| 流式输出 | ✅ Rich Console | ✅ Emoji Console |
| 分步引导 | ✅ Step 1/11 | ✅ Step 1/8 |
| 手动输入凭证 | ✅ _ask_secret | ✅ app_id/app_secret |
| 扫码授权 | ✅ Device Flow | ✅ Device Flow |
| 群聊配置 | ✅ | ✅ group_policy |
| 凭证验证 | ✅ | ✅ |
| 进度条 | ✅ Spinner | ⏳ 文本进度 |

---

## 错误处理

| 错误码 | 说明 | 解决方案 |
|--------|------|---------|
| `INVALID_CREDENTIALS` | 凭证无效 | 检查 appId/appSecret |
| `TIMEOUT` | 授权超时 | 重新扫码 |
| `USER_CANCELLED` | 用户取消 | 重新授权 |
| `EXPIRED` | 授权码过期 | 重新生成 |
| `INIT_FAILED` | 初始化失败 | 检查网络 |

---

## 文件结构

```
feishu-qr-bind/
├── feishu-qr-bind.js    # 原始绑定脚本
├── feishu-wizard.js     # ✨ 新增：配置向导
├── SKILL.md
├── README-ENHANCED.md
└── README-WIZARD.md     # 本文档
```

---

## 使用建议

1. **首次绑定** → 使用 Device Flow 扫码
2. **批量部署** → 手动输入 appId/appSecret
3. **企业环境** → 配置 `group_policy: 'allowlist'`
4. **公开服务** → 配置 `group_policy: 'open'`

---

## 参考资料

- [openakita/setup/wizard.py](https://github.com/openakita/openakita/tree/main/src/openakita/setup)
- [openakita/setup/feishu_onboard.py](https://github.com/openakita/openakita/tree/main/src/openakita/setup)
- [openclaw-lark/src/messaging/inbound/gate.js](https://github.com/openakita/openclaw-lark)
