# Multimodal 助手 - 图片生成技能

## 能力
- ✅ 使用 PIL/Pillow 生成流程图
- ✅ 绘制简单图形（方框、箭头、文字）
- ✅ 输出 PNG 格式图片

## 使用方法

### Python 脚本
```python
from PIL import Image, ImageDraw, ImageFont

# 创建图片
img = Image.new('RGB', (1000, 600), color='white')
draw = ImageDraw.Draw(img)

# 绘制方框
draw.rounded_rectangle([x1, y1, x2, y2], radius=8, fill='#e3f2fd', outline='#333')

# 绘制文字
draw.text((x, y), "文字内容", fill='#333', font=font)

# 绘制箭头
draw.line([(x1, y1), (x2, y2)], fill='#666', width=2)

# 保存
img.save('/tmp/openclaw/output.png')
```

### 输出路径
图片必须保存到 `/tmp/openclaw/` 目录才能通过飞书发送。

## 示例任务
```
生成一个流程图，展示以下流程：
1. 用户请求 → 2. API 处理 → 3. 数据库 → 4. 返回结果

保存到：/tmp/openclaw/flowchart.png
```
