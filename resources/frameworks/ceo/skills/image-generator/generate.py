#!/usr/bin/env python3
"""
简易流程图生成工具
使用 PIL 绘制流程图并保存为 PNG
"""

from PIL import Image, ImageDraw, ImageFont
import sys
import os

def create_flowchart(output_path, title="流程图", boxes=None, arrows=None):
    """
    创建流程图
    
    Args:
        output_path: 输出文件路径
        title: 图表标题
        boxes: 方框列表 [(x1, y1, x2, y2, "文字", "#颜色"), ...]
        arrows: 箭头列表 [(x1, y1, x2, y2), ...]
    """
    width, height = 1000, 600
    img = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(img)
    
    # 加载字体
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", 18)
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", 24)
    except:
        font = ImageFont.load_default()
        title_font = font
    
    # 绘制标题
    draw.text((width//2 - 50, 20), title, fill='#0066cc', font=title_font)
    
    # 绘制方框
    if boxes:
        for x1, y1, x2, y2, text, color in boxes:
            draw.rounded_rectangle([x1, y1, x2, y2], radius=8, fill=color, outline='#333', width=2)
            # 简单文字居中
            draw.text((x1 + (x2-x1)//2 - len(text)*5, y1 + (y2-y1)//2 - 10), text, fill='#333', font=font)
    
    # 绘制箭头
    if arrows:
        for x1, y1, x2, y2 in arrows:
            draw.line([(x1, y1), (x2, y2)], fill='#666', width=2)
            # 箭头
            draw.polygon([(x2-8, y2-5), (x2, y2), (x2-8, y2+5)], fill='#666')
    
    # 保存
    img.save(output_path)
    print(f"图片已生成：{output_path}")
    print(f"文件大小：{os.path.getsize(output_path)} bytes")
    return output_path

if __name__ == "__main__":
    output = sys.argv[1] if len(sys.argv) > 1 else "/tmp/flowchart.png"
    
    # ProxyAI 流程图
    boxes = [
        (50, 80, 250, 150, "AI 工具", "#e3f2fd"),
        (300, 80, 500, 150, "proxyai:3060", "#fff4e1"),
        (550, 80, 750, 150, "SSH 隧道:1080", "#e8f5e9"),
        (800, 80, 950, 150, "OpenRouter", "#fff4e1"),
    ]
    
    arrows = [
        (250, 115, 300, 115),
        (500, 115, 550, 115),
        (750, 115, 800, 115),
    ]
    
    create_flowchart(output, "ProxyAI 工作流程图", boxes, arrows)
