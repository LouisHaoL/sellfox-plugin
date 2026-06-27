# 🦊 SellFox Plugin

一个为 SellFox ERP 系统提供增强功能的浏览器扩展。

## ✨ 功能特性

### 当前功能
- **🚢 批量取消超运费采购单**: 在赛狐ERP采购管理页面自动识别并批量取消单均运费大于1的1688订单
  - 自动检测页面状态（待到货 + 单据）
  - 智能提取表格数据并计算运费比率
  - 一键批量取消超运费采购单
  - 提供详细的分析报告和操作反馈

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
- 页面处于"待到货"状态
- "单据"按钮处于激活状态

#### 使用步骤
1. 导航到赛狐ERP采购管理页面
2. 切换到"待到货"标签
3. 点击"单据"按钮
4. 在页面右侧找到"批量取消超运费"按钮
5. 点击按钮开始分析
6. 查看弹窗中的超运费采购单详情
7. 确认后批量取消符合条件的订单

#### 功能详情
详细使用说明请查看 [PURCHASE_ANALYSIS.md](PURCHASE_ANALYSIS.md)

### 功能详情
详细使用说明请查看 [PURCHASE_ANALYSIS.md](PURCHASE_ANALYSIS.md)

## 🛠️ 开发指南

### 项目结构

```
sellfox_plugin/
├── manifest.json          # 扩展配置文件
├── content.js             # 内容脚本（核心功能）
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
├── README.md              # 项目文档
├── DEVELOPMENT.md         # 开发指南
├── PURCHASE_ANALYSIS.md   # 超运费分析功能说明
└── package.json           # 项目配置
```

### 自定义开发

#### 超运费分析功能定制

如需修改超运费分析逻辑，编辑 `content.js` 中的以下方法：

```javascript
// 修改计算阈值
filterOverShippingData(tableData) {
  return tableData.filter(row => row.ratio > 1); // 修改阈值
}

// 修改列提取逻辑
extractTableData() {
  // 添加更多列的提取
  const colNew = row.querySelector('div[colid="col_NEW"]');
  // 自定义处理逻辑
}

// 修改弹窗显示
displayOverShippingResults(data) {
  // 自定义弹窗样式和内容
}
```

详细定制说明请参考 [PURCHASE_ANALYSIS.md](PURCHASE_ANALYSIS.md)

#### 通用功能定制

##### 1. 修改运费阈值

编辑 `content.js` 中的相关逻辑：

```javascript
// 修改计算阈值
filterOverShippingData(tableData) {
  return tableData.filter(row => row.ratio > 1); // 修改阈值
}
```

##### 2. 添加新功能

在 `content.js` 中添加新的按钮和处理逻辑。

### 调试方法

1. **Content Script 调试**:
   - 在 SellFox 页面按 F12 打开开发者工具
   - 查看 Console 中的 `[SellFox Plugin]` 日志

2. **Background Script 调试**:
   - 访问 `chrome://extensions/`
   - 找到本扩展，点击"service worker"链接

3. **Popup 调试**:
   - 右键点击扩展图标
   - 选择"检查弹出窗口"

### 故障排除

如果遇到问题，请参考 [TROUBLESHOOTING.md](TROUBLESHOOTING.md) 获取详细的调试指南。

**快速调试方法**：
1. 按 F12 打开开发者工具
2. 在Console中输入 `window.forceInjectPurchaseButton()` 强制注入按钮
3. 或输入 `window.forceAnalyzeShipping()` 强制执行分析

## 🔐 安全说明

- 扩展仅在赛狐ERP相关页面运行
- 所有操作都在浏览器本地执行
- 不会收集或上传任何用户数据

## 🎯 未来计划

- [ ] 添加更多ERP页面增强功能
- [ ] 支持自定义运费阈值设置
- [ ] 添加操作历史记录
- [ ] 支持多语言

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
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系方式

如有问题或建议，请通过以下方式联系：

- GitHub Issues
- Email: your-email@example.com

## 🤖 AI生成声明

本项目部分代码和文档由AI（Claude Code）辅助生成。AI工具用于：
- 代码生成和优化
- 文档编写和改进
- 调试和问题解决

使用者可以自由使用、修改和分发本项目的代码，遵循MIT许可证的条款。

---

**注意**: 本插件需要根据实际的 SellFox 网站结构和 API 端点进行调整。请先了解网站的 DOM 结构和 API 规范后再进行开发。
