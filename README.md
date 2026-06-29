# 🦊 SellFox Plugin

一个为 SellFox ERP 系统提供增强功能的浏览器扩展。

## ✨ 功能特性

### 核心功能

#### 1. 🚢 批量取消超运费采购单
在赛狐ERP采购管理页面自动识别并批量取消单均运费大于1的1688订单
- 自动检测页面状态（待到货 + 单据视图）
- 智能提取表格数据并计算运费比率
- 一键批量取消超运费采购单
- 提供详细的分析报告和操作反馈

#### 2. 🔄 批量取消采购单
支持批量取消采购单，根据订单状态智能调用不同接口
- 自动识别订单内部状态（alibabaInternalStatus）
- 状态=0：调用取消采购单接口
- 状态=1：调用取消1688订单接口
- 支持勾选取消和全页取消两种模式
- 二次确认弹窗显示取消类型和状态

### 技术特点
- 🎯 **精准定位**：仅在指定页面状态下激活功能
- 🔒 **安全可靠**：本地运行，不上传任何数据
- 🚀 **性能优化**：智能数据提取，避免重复请求
- 🛠️ **易于调试**：提供丰富的调试接口

## 📦 安装方法

### 开发者模式安装

1. 准备图标文件（参考 `icons/README.md`）
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本项目的根目录
6. 完成！

### 打包发布

1. 确保所有文件都已准备就绪
2. 在 `chrome://extensions/` 点击"打包扩展程序"
3. 选择项目目录并生成 `.crx` 文件
4. 上传到 Chrome Web Store

## 🚀 使用方法

### 批量取消超运费采购单

#### 自动激活条件
当满足以下条件时，插件会自动注入分析按钮：
- URL 包含 `purchaseManage/index.html`
- 页面处于"待到货"标签
- "单据"视图按钮处于激活状态

#### 使用步骤
1. 导航到赛狐ERP采购管理页面
2. 切换到"待到货"标签
3. 点击"单据"视图按钮
4. 在页面顶部找到"取消超运费采购单"按钮
5. 点击按钮开始分析
6. 查看弹窗中的超运费采购单详情
7. 勾选需要取消的订单，点击"取消1688订单"按钮

#### 功能说明
详细使用说明请查看 [PURCHASE_ANALYSIS.md](PURCHASE_ANALYSIS.md)

### 批量取消采购单

#### 使用步骤
1. 导航到赛狐ERP采购管理页面
2. 勾选需要取消的采购单行（可选）
3. 点击"取消采购单"按钮
4. 查看确认弹窗中的订单信息
5. 确认取消类型（采购单/1688订单）
6. 点击"确认取消"执行操作

#### 功能特性
- **智能取消**：根据 `alibabaInternalStatus` 自动选择正确的接口
- **批量操作**：支持勾选取消或全页取消
- **安全确认**：显示订单详情和取消类型，避免误操作
- **状态反馈**：实时显示操作进度和结果统计

## 🛠️ 开发指南

### 项目结构

```
sellfox_plugin/
├── manifest.json          # 扩展配置文件 (Manifest V3)
├── content.js             # 内容脚本（核心功能）
├── inject.js              # 注入脚本（API拦截）
├── styles.css             # 样式文件
├── background.js          # 后台服务
├── popup.html             # 弹窗页面
├── popup.js               # 弹窗脚本
├── icons/                 # 图标目录
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   ├── create-icons.html  # 图标生成工具
│   └── README.md          # 图标说明
├── .claude/               # Claude Code配置
├── .git/                  # Git版本控制
├── README.md              # 项目文档
├── DEVELOPMENT.md         # 开发指南
├── PURCHASE_ANALYSIS.md   # 功能详细说明
└── package.json           # 项目配置
```

### 技术架构

#### 双脚本注入模式
- **inject.js** (MAIN World): 拦截API请求，提取订单数据
- **content.js** (ISOLATED World): 页面交互和功能实现

#### Shadow DOM 访问
支持 wujie 微前端架构的 Shadow DOM 访问

#### 数据拦截机制
- 拦截 `/api/purchase/page.json` 响应
- 提取 orderId、tradeId、purchaseNo、alibabaInternalStatus
- 建立订单映射关系，支持取消操作

### 开发调试

#### Content Script 调试
1. 在 SellFox 页面按 F12 打开开发者工具
2. 查看 Console 中的 `[SellFox Plugin]` 日志

#### Background Script 调试
1. 访问 `chrome://extensions/`
2. 找到本扩展，点击"service worker"链接

#### 快速调试命令
```javascript
// 强制注入按钮
window.forceInjectPurchaseButton()

// 强制执行超运费分析
window.forceAnalyzeShipping()

// 测试Shadow DOM访问
window.testShadowDOM()

// 测试动态colid获取
window.testColumnIds()
```

## 🔐 安全说明

- ✅ 扩展仅在 `https://www.sellfox.com/*` 运行
- ✅ 所有操作都在浏览器本地执行
- ✅ 不收集或上传任何用户数据
- ✅ 遵循最小权限原则
- ✅ 开源代码，可审计

## 🎯 功能路线图

### 已完成 ✅
- [x] 批量取消超运费采购单
- [x] 批量取消采购单
- [x] 智能接口选择
- [x] 二次确认机制
- [x] 实时状态反馈

### 计划中 📋
- [ ] 支持自定义运费阈值设置
- [ ] 添加操作历史记录
- [ ] 支持更多批量操作
- [ ] 添加数据导出功能
- [ ] 支持多语言界面

## 📄 许可证

MIT License

Copyright (c) 2026 LouisHaoL

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 贡献流程
1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📧 联系方式

- GitHub Issues: [项目Issues页面]
- Email: your-email@example.com

## 🤖 AI辅助声明

本项目部分代码和文档由AI（Claude Code）辅助生成：
- 代码生成和优化
- 文档编写和改进
- 调试和问题解决

遵循MIT许可证，使用者可以自由使用、修改和分发本项目的代码。

---

**注意**: 本插件需要根据实际的 SellFox 网站结构和 API 端点进行调整。请在了解网站的 DOM 结构和 API 规范后再进行生产环境使用。
