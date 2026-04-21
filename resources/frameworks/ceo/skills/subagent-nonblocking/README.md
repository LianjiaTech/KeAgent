# 子代理非阻塞处理方案

## 问题根因

**消息堆积原因：**
1. 子代理完成后自动推送结果（subagent_announce）
2. 推送消息进入主会话队列
3. 主会话串行处理消息
4. 用户消息被排队等待

## 解决方案

### 方案 1：静默模式（推荐用于不需要通知的任务）

```javascript
// 不等待结果，不接收推送
sessions_spawn({
  agentId: "tech",
  task: "任务描述",
  mode: "run",
  runtime: "subagent",
  timeoutSeconds: 300,
  cleanup: "delete"
  // 不用 yield，不用推送
})

// 立即回复用户
return "任务已在后台启动"
```

### 方案 2：汇总推送（推荐用于多任务）

```javascript
// 启动多个任务
const tasks = [
  sessions_spawn({ agentId: "writer", task: "任务 1", ... }),
  sessions_spawn({ agentId: "tech", task: "任务 2", ... }),
  sessions_spawn({ agentId: "secretary", task: "任务 3", ... })
]

// 不等待，让子代理完成后汇总到一个消息推送
// 或者主会话定期查询状态后一次性回复
```

### 方案 3：持久会话 + 主动查询

```javascript
// 创建持久会话
const session = sessions_spawn({
  agentId: "assistant",
  mode: "session",
  cleanup: "keep"
})

// 用户请求时发送任务
sessions_send({
  sessionKey: session.childSessionKey,
  message: "新任务"
})

// 不等待结果，立即回复用户
// 用户询问时再查询状态
```

## 最佳实践

### 任务分类

| 类型 | 通知方式 | 说明 |
|------|----------|------|
| 短任务 (<5s) | sessions_yield | 简单直接 |
| 中长任务 | 不通知 | 后台运行 |
| 重要任务 | 主动查询 | 用户询问时回复 |
| 多任务 | 汇总推送 | 完成后一次性通知 |

### 避免堆积的原则

1. **少 spawn 子代理** - 能自己做的自己做
2. **不用 yield** - 除非必须等待
3. **不依赖推送** - 让子代理静默完成
4. **批量处理** - 多任务汇总后通知

## 代码模板

### 静默任务
```javascript
// 启动任务
sessions_spawn({
  agentId: "tech",
  task: "后台处理",
  mode: "run",
  runtime: "subagent",
  timeoutSeconds: 600,
  cleanup: "delete"
})

// 立即返回
return "已启动后台任务"
```

### 批量任务
```javascript
// 记录任务
const taskIds = []

// 启动多个
for (const task of tasks) {
  const result = sessions_spawn({...})
  taskIds.push(result.childSessionKey)
}

// 不等待，记录到文件
writeFileSync('/tmp/pending_tasks.json', JSON.stringify(taskIds))

// 立即返回
return `已启动 ${tasks.length} 个任务`
```

### 状态查询
```javascript
// 用户询问时查询
const status = subagents({ action: "list" })
const pending = status.active.filter(t => taskIds.includes(t.sessionKey))

return `进行中：${pending.length}, 已完成：${taskIds.length - pending.length}`
```
