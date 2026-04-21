# 子代理并发处理最佳实践

## 问题根因

**消息排队原因：**
- 使用 `sessions_yield()` 等待子代理时，主会话被阻塞
- 单个会话同一时间只能处理一个任务
- 长任务导致后续消息排队

## 解决方案

### 方案 1：非阻塞模式（推荐）

```javascript
// 不等待，直接返回
sessions_spawn({
  agentId: "tech",
  task: "任务描述",
  mode: "run",
  runtime: "subagent",
  timeoutSeconds: 300,
  label: "task-xxx",
  cleanup: "delete"
  // 不用 sessions_yield
})

// 立即回复用户
return "任务已启动，完成后会通知你"
```

**优点：** 不阻塞，可立即处理新消息  
**缺点：** 需要子代理主动推送结果

### 方案 2：持久会话模式

```javascript
// 创建持久会话
sessions_spawn({
  agentId: "secretary",
  task: "初始化会话",
  mode: "session",  // 持久模式
  runtime: "subagent",
  label: "assistant-session",
  cleanup: "keep"
})

// 后续发送消息不阻塞
sessions_send({
  sessionKey: "agent:secretary:subagent:xxx",
  message: "新任务"
})
```

**优点：** 可多次交互，不阻塞主会话  
**缺点：** 需要管理会话生命周期

### 方案 3：多子代理并行

```javascript
// 同时启动多个子代理
const task1 = sessions_spawn({ agentId: "writer", task: "任务 1", ... })
const task2 = sessions_spawn({ agentId: "tech", task: "任务 2", ... })
const task3 = sessions_spawn({ agentId: "social", task: "任务 3", ... })

// 不等待，立即返回
return "已启动 3 个任务，完成后会通知"
```

**优点：** 充分利用并发能力  
**缺点：** 需要追踪多个任务状态

## 子代理主动推送

子代理完成任务后主动通知：

```javascript
// 子代理代码
await sessions_send({
  sessionKey: "agent:ceo:feishu:direct:xxx",  // 父会话
  message: "✅ 任务完成：结果..."
})
```

## 任务追踪机制

```javascript
// 任务元数据
const tasks = new Map()

// 启动任务
tasks.set(taskId, {
  agentId: "tech",
  status: "running",
  startTime: Date.now(),
  sessionKey: result.childSessionKey
})

// 子代理完成后更新
tasks.set(taskId, { ...status, completed: true })
```

## 推荐配置

| 场景 | 模式 | 等待 | 说明 |
|------|------|------|------|
| 短任务 (<10s) | run | yield | 简单直接 |
| 中长任务 | run | 不等待 | 子代理推送结果 |
| 多任务并行 | run | 不等待 | 同时启动多个 |
| 持久助手 | session | 不等待 | 长期会话 |

## 避免排队的原则

1. **少用 sessions_yield** - 除非必须等待结果
2. **子代理推送** - 完成后主动通知
3. **多任务并行** - 不串行执行
4. **快速响应** - 先回复用户，后台处理
