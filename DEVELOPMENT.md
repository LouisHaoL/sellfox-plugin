# 🛠️ SellFox Plugin 开发指南

本文档提供 SellFox Plugin 的详细开发指南，包括技术架构、开发环境设置、核心功能实现和调试方法。

## 📋 目录

- [技术架构](#技术架构)
- [开发环境设置](#开发环境设置)
- [核心功能实现](#核心功能实现)
- [API 接口说明](#api-接口说明)
- [调试方法](#调试方法)
- [常见问题](#常见问题)
- [扩展开发](#扩展开发)

## 🏗️ 技术架构

### 整体架构

SellFox Plugin 采用 Chrome Extension Manifest V3 架构，使用双脚本注入模式实现 SellFox ERP 系统的功能增强。

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                         │
├─────────────────────────────────────────────────────────────┤
│  Background Service Worker (background.js)                 │
│  - 扩展生命周期管理                                         │
│  - 消息中继和路由                                           │
├─────────────────────────────────────────────────────────────┤
│  Content Script (content.js)                               │
│  - 页面功能实现                                             │
│  - UI 交互和数据处理                                        │
├─────────────────────────────────────────────────────────────┤
│  Inject Script (inject.js)                                 │
│  - API 请求拦截                                             │
│  - 数据提取和映射                                           │
└─────────────────────────────────────────────────────────────┘
```

### 双脚本注入模式

#### MAIN World (inject.js)
- **运行时机**: `document_start` (页面加载最早阶段)
- **运行环境**: MAIN World (与页面同源)
- **主要功能**:
  - 拦截 Fetch API 和 XMLHttpRequest
  - 提取 API 响应数据
  - 通过 postMessage 传递给 content script

#### ISOLATED World (content.js)
- **运行时机**: `document_idle` (DOM 加载完成后)
- **运行环境**: ISOLATED World (独立的JS上下文)
- **主要功能**:
  - 页面 DOM 操作
  - 用户交互处理
  - 业务逻辑实现

### Shadow DOM 支持

SellFox 使用 wujie 微前端框架，应用运行在 Shadow DOM 中。插件通过以下方式访问：

```javascript
getShadowRoot() {
  const wujieApp = document.querySelector('#amzup-web-vue3 > wujie-app');
  return wujieApp?.shadowRoot || null;
}
```

### 数据流架构

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   页面API    │────▶│  inject.js  │────▶│  content.js  │
│  page.json  │     │  (拦截器)   │     │  (业务逻辑)  │
└─────────────┘     └─────────────┘     └──────────────┘
                           │
                    提取订单数据
                    (orderId, tradeId, 
                     purchaseNo, status)
                           │
                    postMessage
                    跨世界通信
```

## 🔧 开发环境设置

### 必要工具

- **浏览器**: Chrome/Edge (Manifest V3 支持)
- **编辑器**: VS Code (推荐)
- **调试工具**: Chrome DevTools

### 推荐插件

- **Chrome Extension Reviewer**: 扩展开发辅助工具
- **JSON Viewer**: API 响应查看
- **React Developer Tools**: 如需调试 React 组件

### 项目设置

```bash
# 1. 克隆项目
git clone <repository-url>
cd sellfox_plugin

# 2. 准备图标
cd icons
# 参考 icons/README.md 生成图标文件

# 3. 加载到浏览器
# 打开 chrome://extensions/
# 开启开发者模式
# 点击"加载已解压的扩展程序"
# 选择项目根目录
```

### 开发工作流

```bash
# 1. 修改代码
# 编辑 content.js 或 inject.js

# 2. 在扩展管理页面点击刷新按钮

# 3. 刷新测试页面

# 4. 查看控制台输出
```

## 🎯 核心功能实现

### 1. 页面检测与激活

```javascript
checkPurchasePage() {
  // 1. URL 匹配
  const currentUrl = window.location.href;
  const hasPurchaseManage = 
    currentUrl.includes('purchaseManage/index.html');

  // 2. 页面状态检测
  const isWaitingForGoods = 
    waitingTab?.textContent.includes('待到货');
  const isOrderView = 
    orderButton?.textContent.includes('单据');

  // 3. 注入功能
  if (hasPurchaseManage && isWaitingForGoods && isOrderView) {
    this.injectPurchaseButton();
  }
}
```

### 2. 表格数据提取

```javascript
extractTableData() {
  // 1. 动态获取列 colid
  const columnIds = this.getColumnIds();
  
  // 2. 从多个 wrapper 中提取数据
  // vxe-table 将列分散在三个 wrapper 中
  const tbodies = [
    'div.vxe-table--fixed-left-wrapper table tbody',
    'div.vxe-table--body-wrapper table tbody',
    'div.vxe-table--fixed-right-wrapper table tbody'
  ];
  
  // 3. 合并同一行的数据
  const cells = mergeRowCells(rowIndex);
  
  // 4. 提取单元格内容
  const shippingValue = extractNumber(shippingCell);
  const quantityValue = extractNumber(quantityCell);
}
```

### 3. API 数据拦截

```javascript
// inject.js 中的拦截逻辑
function handleResponse(url, text) {
  if (url.indexOf('/api/purchase/page.json') === -1) return;
  
  const json = JSON.parse(text);
  const rows = json.data.rows || [];
  
  const mapped = rows.map(r => ({
    orderId: r.orderId,
    tradeId: r.tradeId,
    purchaseNo: r.purchaseNo,
    alibabaInternalStatus: r.alibabaInternalStatus
  }));
  
  // 传递给 content script
  window.postMessage({
    source: 'sellfox-plugin-inject',
    type: 'SELLFOX_PURCHASE_PAGE_DATA',
    payload: mapped
  }, '*');
}
```

### 4. 取消操作实现

```javascript
// 根据状态选择接口
if (row.alibabaInternalStatus === 0) {
  // 取消采购单
  await this.cancelPurchaseOrder(row.orderNumber);
} else if (row.alibabaInternalStatus === 1) {
  // 取消1688订单
  await this.cancelAlibabaOrder(row.orderId, null, true);
}
```

## 📡 API 接口说明

### 1. 获取采购单列表

**端点**: `GET /api/purchase/page.json`

**响应示例**:
```json
{
  "data": {
    "rows": [
      {
        "orderId": 123456,
        "tradeId": "123456789",
        "purchaseNo": "PO240629001",
        "alibabaInternalStatus": 0,
        "shipFee": 15.50,
        "totalNum": 10
      }
    ]
  }
}
```

### 2. 取消1688订单

**端点**: `POST /api/alibabaOrder/cancel.json`

**请求参数**:
```json
{
  "id": 123456,
  "reason": "采购运费：15.50元，采购数量：10件，单件采购运费：1.55元",
  "source": "PURCHASE_ORDER",
  "purchaseOperationType": 0
}
```

**成功响应**: `{"code": 0, "msg": "成功"}`

### 3. 取消采购单

**端点**: `POST /api/gw/sellfox/sellfox-purchase/sellfox/purchaseOrder/cancel`

**请求参数**:
```json
{
  "orderNo": "PO240629001",
  "returnPurchasePlan": true
}
```

**成功响应**: `{"code": 0, "msg": "成功"}`

## 🐛 调试方法

### Content Script 调试

```javascript
// 1. 在 SellFox 页面按 F12
// 2. 查看控制台输出

// 查看插件实例
console.log(window.sellFoxPluginDebug);

// 强制注入按钮
window.forceInjectPurchaseButton();

// 强制执行分析
window.forceAnalyzeShipping();
```

### Inject Script 调试

```javascript
// 查看拦截数据
// 在 inject.js 的 handleResponse 中添加断点
// 查看 mapped 变量的内容
```

### Background Script 调试

```bash
# 1. 访问 chrome://extensions/
# 2. 找到扩展，点击"检查服务: service worker"
# 3. 在 DevTools 中调试
```

### 常用调试命令

```javascript
// 测试 Shadow DOM 访问
window.testShadowDOM()

// 测试动态 colid 获取
window.testColumnIds()

// 查看订单映射数据
console.log(window.sellFoxPluginDebug.orderIdMap)
```

## ❓ 常见问题

### Q: 修改代码后功能没有生效？
**A**: 
1. 在 `chrome://extensions/` 点击刷新按钮
2. 完全重新加载测试页面
3. 清除缓存并硬刷新 (Ctrl+Shift+R)

### Q: 无法访问页面元素？
**A**:
1. 检查页面是否在 Shadow DOM 中
2. 使用 `window.testShadowDOM()` 测试访问
3. 确认选择器是否正确

### Q: API 拦截不到数据？
**A**:
1. 确认 inject.js 已加载 (在 `document_start` 执行)
2. 检查 API 端点是否匹配
3. 查看控制台是否有错误信息

### Q: 按钮没有显示？
**A**:
1. 检查页面状态是否匹配 (待到货 + 单据视图)
2. 使用 `window.forceInjectPurchaseButton()` 强制注入
3. 查看控制台错误信息

## 🔨 扩展开发

### 添加新功能

#### 1. 添加新的按钮

```javascript
// 在 content.js 的 createAndInsertButton 方法中添加
const newButton = document.createElement('button');
newButton.textContent = '新功能按钮';
newButton.addEventListener('click', () => {
  this.newFeature();
});
buttonBar.appendChild(newButton);
```

#### 2. 添加新的API拦截

```javascript
// 在 inject.js 中添加
if (url.indexOf('/api/new-endpoint') !== -1) {
  // 处理新的 API
}
```

#### 3. 添加新的页面检测

```javascript
checkNewPage() {
  const currentUrl = window.location.href;
  if (currentUrl.includes('new-page')) {
    this.injectNewFeature();
  }
}
```

### 自定义配置

#### 修改运费阈值

```javascript
// 在 content.js 中修改
filterOverShippingData(tableData) {
  return tableData.filter(row => {
    const ratioOk = row.ratio > 1; // 修改阈值
    const paymentStatusOk = row.paymentStatus?.includes('未请款');
    return ratioOk && paymentStatusOk;
  });
}
```

#### 修改弹窗样式

```javascript
// 在 displayOverShippingResults 方法中修改
modalContent.style.cssText = `
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 1100px;  // 修改宽度
`;
```

### 性能优化

#### 1. 减少DOM查询

```javascript
// 缓存 DOM 元素
if (!this.cachedElements) {
  this.cachedElements = {
    shadowRoot: this.getShadowRoot(),
    buttonBar: shadowRoot.querySelector('div.sf_batch_btn_bar')
  };
}
```

#### 2. 优化数据提取

```javascript
// 使用文档片段批量操作
const fragment = document.createDocumentFragment();
rows.forEach(row => fragment.appendChild(row));
container.appendChild(fragment);
```

#### 3. 防抖处理

```javascript
// 防抖处理页面变化
if (this._pageChangeTimer) {
  clearTimeout(this._pageChangeTimer);
}
this._pageChangeTimer = setTimeout(() => {
  this.checkPurchasePage();
}, 300);
```

## 📚 参考资源

### Chrome Extension 文档
- [Chrome Extension 开发指南](https://developer.chrome.com/docs/extensions/mv3/getstarted/)
- [Manifest V3 迁移指南](https://developer.chrome.com/docs/extensions/mv3/intro/)

### JavaScript API 参考
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/reference/)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Shadow_root)

### 相关技术
- [wujie 微前端框架](https://wujie-microfrontend.feishu.cn/)
- [vxe-table 表格组件](https://vxetable.cn/)

## 🤝 贡献指南

### 代码规范

- 使用 ES6+ 语法
- 遵循函数式编程原则
- 添加适当的错误处理
- 保持代码简洁可读

### 提交规范

```bash
# 功能开发
git commit -m "feat: 添加批量取消采购单功能"

# Bug 修复
git commit -m "fix: 修复表格数据提取问题"

# 文档更新
git commit -m "docs: 更新开发指南"

# 性能优化
git commit -m "perf: 优化数据提取性能"
```

### 测试清单

- [ ] 功能在不同页面状态下正常工作
- [ ] API 拦截和数据映射正确
- [ ] 错误处理和边界情况覆盖
- [ ] 性能影响最小化
- [ ] 浏览器兼容性测试

---

**注意**: 本指南会持续更新，建议定期查看最新版本。如有疑问或建议，欢迎通过 GitHub Issues 反馈。
