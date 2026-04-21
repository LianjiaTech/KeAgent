# 飞书机器人二维码绑定工具 - 使用指南

## 概述

修复后的 `feishu-qr-bind` 工具实现了完整的飞书 OAuth 2.0 设备授权流程，用于生成二维码并完成飞书机器人的绑定。

## 主要修复

| 问题 | 修复前 | 修复后 |
|------|--------|--------|
| 轮询逻辑 | 检查不存在的 `status` 字段 | 检查 `client_id` 和 `client_secret` |
| 错误处理 | 缺少错误类型处理 | 完整处理 `authorization_pending`, `slow_down`, `access_denied`, `expired_token` |
| 轮询间隔 | 固定 3 秒 | 使用 API 返回的 `interval`，支持 `slow_down` 动态调整 |
| 超时时间 | 固定 300 秒 | 使用 API 返回的 `expire_in` |
| 域名切换 | 不支持 | 自动检测并切换到飞书国际版 |
| 配置管理 | 同时处理 JSON 和 YAML | 只处理 `openclaw.json`，更简洁 |
| 凭证验证 | 无 | 获取后自动验证 `appId/appSecret` |

## 使用方法

### 方式 1：作为 MCP 工具调用

```javascript
import { feishu_qr_bind } from './feishu-qr-bind.js';

const result = await feishu_qr_bind({
  domain: 'feishu',           // 或 'lark'
  timeout: 600,               // 超时时间（秒）
  save_config: true,          // 是否保存配置
  send_to_feishu: true,       // 是否通过飞书发送二维码
  user_open_id: 'ou_xxx',     // 接收者 open_id
});

if (result.success) {
  console.log('绑定成功:', result.app_id);
} else {
  console.log('绑定失败:', result.message);
}
```

### 方式 2：命令行测试

```bash
cd /home/ubuntu/.openclaw/workspace-tech/skills/feishu-qr-bind

# 基本用法（生成二维码后在终端显示）
node test-bind.js

# 通过飞书发送二维码
node test-bind.js --send-to-feishu --user-open-id ou_d6f374a3c5f7b1c0472ad5dd178e9441

# 指定域名（飞书国际版）
node test-bind.js --domain lark

# 自定义超时时间
node test-bind.js --timeout 900
```

### 方式 3：集成到 OpenClaw

在 OpenClaw 配置中注册为 MCP 工具：

```json
{
  "mcp": {
    "tools": {
      "feishu_qr_bind": {
        "path": "/home/ubuntu/.openclaw/workspace-tech/skills/feishu-qr-bind/feishu-qr-bind.js",
        "enabled": true
      }
    }
  }
}
```

## API 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `domain` | string | `'feishu'` | 飞书域名：`feishu`（中国）或 `lark`（国际） |
| `timeout` | number | `600` | 轮询超时时间（秒） |
| `save_config` | boolean | `true` | 是否自动保存配置到 `~/.openclaw/openclaw.json` |
| `send_to_feishu` | boolean | `false` | 是否通过飞书消息发送二维码图片 |
| `user_open_id` | string | `null` | 接收者的飞书 open_id（`send_to_feishu=true` 时需要） |

## 返回结果

### 成功

```json
{
  "success": true,
  "qr_path": "/tmp/openclaw/feishu_qr_20260320T113000.png",
  "qr_url": "https://accounts.feishu.cn/...",
  "device_code": "xxx",
  "app_id": "cli_xxx",
  "app_secret": "xxx",
  "send_to_feishu": true,
  "sent_to_feishu": true,
  "message": "飞书机器人绑定成功，配置已保存"
}
```

### 失败

```json
{
  "success": false,
  "error": "TIMEOUT",
  "message": "授权超时，请重新生成二维码",
  "qr_path": "/tmp/openclaw/feishu_qr_20260320T113000.png",
  "qr_url": "https://accounts.feishu.cn/...",
  "device_code": "xxx"
}
```

### 错误码

| 错误码 | 说明 |
|--------|------|
| `TIMEOUT` | 授权超时 |
| `USER_CANCELLED` | 用户取消了授权 |
| `EXPIRED` | 授权码已过期 |
| `ACCESS_DENIED` | 访问被拒绝 |
| `NO_DEVICE_CODE` | 未能获取设备授权码 |
| `NO_CREDENTIALS` | 未能获取应用凭证 |
| `INVALID_CREDENTIALS` | 凭证验证失败 |
| `INIT_FAILED` | 初始化失败 |
| `NO_BOT_CREDENTIALS` | 未配置飞书 bot 凭证（发送图片时） |
| `GET_TOKEN_FAILED` | 获取 token 失败 |
| `UPLOAD_IMAGE_FAILED` | 上传图片失败 |
| `NO_USER_OPEN_ID` | 未提供 user_open_id |

## OAuth 流程

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Client │     │  Auth   │     │  User   │     │  Feishu │
│         │     │  Server │     │         │     │  API    │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │  1. init      │               │               │
     │ ────────────> │               │               │
     │               │               │               │
     │  2. begin     │               │               │
     │ ────────────> │               │               │
     │               │               │               │
     │  device_code  │               │               │
     │  qr_url       │               │               │
     │ <──────────── │               │               │
     │               │               │               │
     │  3. 显示二维码               │               │
     │ ────────────────────────────> │               │
     │               │               │               │
     │               │  4. 扫码      │               │
     │               │ ────────────> │               │
     │               │               │               │
     │  5. poll      │               │               │
     │ ────────────> │               │               │
     │               │               │               │
     │  pending      │               │               │
     │ <──────────── │               │               │
     │               │               │               │
     │  ... 轮询 ... │               │               │
     │               │               │               │
     │  6. poll      │               │               │
     │ ────────────> │               │               │
     │               │               │               │
     │  client_id    │               │               │
     │  client_secret│               │               │
     │ <──────────── │               │               │
     │               │               │               │
     │  7. 保存配置  │               │               │
     │               │               │               │
```

## 配置文件位置

配置保存到：`~/.openclaw/openclaw.json`

```json
{
  "channels": {
    "feishu": {
      "defaultAccount": "main",
      "accounts": {
        "main": {
          "appId": "cli_xxx",
          "appSecret": "xxx",
          "domain": "feishu"
        }
      }
    }
  }
}
```

## 故障排查

### 1. 二维码无法扫描

- 检查网络连接
- 确认域名正确（飞书中国 vs 飞书国际）
- 重新生成二维码

### 2. 轮询超时

- 增加 `timeout` 参数
- 检查飞书账号是否有权限创建应用
- 查看日志确认 API 响应

### 3. 凭证验证失败

- 确认 appId/appSecret 格式正确
- 检查飞书开放平台应用状态
- 确认应用已启用

### 4. 图片发送失败

- 确认已配置 bot 凭证
- 检查 user_open_id 是否正确
- 查看飞书开放平台 API 权限

## 安全建议

1. **备份配置**：工具会自动备份原配置文件
2. **凭证保护**：`appSecret` 仅保存在本地配置文件中
3. **定期更新**：定期更新飞书开放平台的应用凭证
4. **权限最小化**：只申请必要的 API 权限

## 技术支持

- 问题反馈：GitHub Issues
- 文档：/home/ubuntu/.openclaw/workspace-tech/skills/feishu-qr-bind/README.md
- 分析报告：/home/ubuntu/.openclaw/workspace-tech/skills/feishu-qr-bind/ANALYSIS.md
- 修复总结：/home/ubuntu/.openclaw/workspace-tech/skills/feishu-qr-bind/FIX_SUMMARY.md
