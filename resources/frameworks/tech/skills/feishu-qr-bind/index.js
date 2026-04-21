/**
 * 飞书二维码绑定技能入口
 * 
 * 导出 feishu_qr_bind 工具供 OpenClaw 使用
 */

export { feishu_qr_bind } from './feishu-qr-bind.js';

// 默认导出工具对象
import { feishu_qr_bind } from './feishu-qr-bind.js';

export default {
  name: 'feishu_qr_bind',
  description: '飞书机器人二维码绑定工具，通过 OAuth 设备授权流程完成绑定',
  handler: feishu_qr_bind,
};
