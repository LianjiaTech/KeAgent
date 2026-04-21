# 子代理管理器

## 快速使用

### 1. Spawn 子代理（带超时和通知）

```javascript
// 一次性任务
const result = await sessions_spawn({
  agentId: "secretary",
  task: "查询明天上午的日程安排",
  mode: "run",
  runtime: "subagent",
  timeoutSeconds: 300,
  streamTo: "parent"
})

// 等待完成通知
await sessions_yield()
// 子代理的结果将作为下一条消息返回
```

### 2. 持久会话模式

```javascript
// 创建持久会话（可多次交互）
await sessions_spawn({
  agentId: "tech",
  task: "初始化技术支持会话",
  mode: "session",
  runtime: "subagent",
  label: "tech-support-001",
  cleanup: "keep"
})

// 后续发送消息到该会话
await sessions_send({
  sessionKey: "agent:ceo:subagent:xxx",
  message: "新问题：帮我检查一下 API 状态"
})
```

### 3. 查询任务状态

```javascript
// 查看所有活跃子代理
const status = await subagents({ action: "list" })

// 查看所有会话
const sessions = await sessions_list({ limit: 20 })

// 查看特定会话历史
const history = await sessions_history({
  sessionKey: "agent:ceo:subagent:xxx",
  limit: 50
})
```

### 4. 超时处理

```javascript
try {
  await sessions_spawn({
    agentId: "writer",
    task: "写一篇长文章",
    timeoutSeconds: 600,  // 10 分钟
    runTimeoutSeconds: 600
  })
  
  await sessions_yield()
} catch (error) {
  if (error.message.includes("timeout")) {
    // 超时处理：重试或通知用户
    console.log("任务超时，正在重试...")
  }
}
```

## 任务追踪模板

```javascript
// 任务元数据
const taskMeta = {
  id: "task-" + Date.now(),
  agentId: "secretary",
  task: "任务描述",
  startTime: new Date().toISOString(),
  expectedDuration: 300,  // 秒
  status: "running"
}

// Spawn 子代理
const session = await sessions_spawn({
  ...taskMeta,
  timeoutSeconds: taskMeta.expectedDuration,
  streamTo: "parent"
})

// 保存 sessionKey 用于后续追踪
taskMeta.sessionKey = session.sessionKey
```

## 最佳实践

1. **始终设置超时** - 避免无限期等待
2. **使用 streamTo: "parent"** - 自动接收完成通知
3. **长任务定期同步** - 子代理每 2 分钟发送进度更新
4. **清理已完成会话** - 使用 `cleanup: "delete"` 或手动清理
5. **记录任务元数据** - 便于追踪和调试
