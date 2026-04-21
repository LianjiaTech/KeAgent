# 快速修复：handler is not a function

## 问题
```
⨯ handler is not a function  failedTask=build
```

## 原因
electron-builder 的 `afterPack` 配置不支持数组形式的多个钩子。

## 解决方案
将 `after-pack-resign.cjs` 的调用整合到 `after-pack.cjs` 中。

## 已修复
✅ `electron-builder.yml` - 恢复单一钩子配置
✅ `after-pack.cjs` - 在 macOS 平台上自动调用重新签名逻辑
✅ 语法验证通过

## 现在可以重新构建了

```bash
pnpm run package:mac
```

## 构建流程
```
after-pack.cjs (主钩子)
├─ 1. 复制 openclaw node_modules
├─ 2. 打包插件
├─ 3. 清理不必要文件
├─ 4. 清理非目标平台包
└─ 5. [macOS] 调用 after-pack-resign.cjs
    ├─ 扫描所有 .node、.dylib、.so 文件
    ├─ 移除现有签名
    └─ 使用应用证书重新签名
```

## 预期日志
```
[after-pack] ...常规操作...
[after-pack] 🔐 Re-signing native binaries...
[after-pack-resign] Starting binary re-signing process...
[after-pack-resign] Found X native binaries
[after-pack-resign] ✅ Successfully re-signed: X binaries
```
