# 📊 SellFox Plugin 功能详细说明

本文档详细介绍 SellFox Plugin 的核心功能、使用方法和技术实现细节。

## 🎯 功能概述

SellFox Plugin 为赛狐ERP系统提供两大核心增强功能：
1. **批量取消超运费采购单** - 自动识别并批量取消单均运费过高的1688订单
2. **批量取消采购单** - 智能识别订单状态，批量取消采购单或1688订单

---

## 🚢 功能一：批量取消超运费采购单

### 功能说明
在赛狐ERP采购管理页面自动识别单均运费大于1的1688订单，并提供批量取消功能。

### 触发条件
插件会在以下条件下自动注入"取消超运费采购单"按钮：

#### 1. URL 要求
```
https://www.sellfox.com/amzup-web-main/amzup-web-vue3?amzup-web-vue3=%2Fvue3%2Fweb%2Fv3%2FpurchaseManage%2Findex.html
```

#### 2. 页面状态要求
- ✅ "待到货" Tab 处于激活状态
- ✅ "单据" 按钮处于激活状态（而非"商品"视图）

### 使用步骤

1. 导航到赛狐ERP采购管理页面
2. 切换到"待到货"标签
3. 点击"单据"视图按钮
4. 在页面顶部找到"**取消超运费采购单**"按钮（红色渐变）
5. 点击按钮开始分析
6. 查看弹窗中的超运费采购单详情
7. 勾选需要取消的订单
8. 点击"取消1688订单"按钮执行批量取消

### 数据筛选逻辑

#### 自动筛选条件
1. **单均运费计算**: `运费金额 ÷ 采购数量`
2. **运费阈值**: 单均运费 > 1 元
3. **请款状态**: 状态包含"未请款"字样

#### 计算示例
```
采购单A: 运费¥15.50，采购数量10件 → 单均运费¥1.55 ✅ 超运费
采购单B: 运费¥8.00，采购数量10件 → 单均运费¥0.80 ❌ 正常
采购单C: 运费¥25.00，采购数量15件 → 单均运费¥1.67 ✅ 超运费
```

### 弹窗功能

#### 数据表格展示
- 采购单号
- 1688订单号（如有）
- 供应商
- 请款状态
- 运费金额
- 采购数量
- **单均运费**（红色高亮）

#### 操作按钮
- 全选/反选复选框
- 每行独立复选框
- "取消1688订单"按钮
- 实时状态显示

#### 汇总信息
- 超运费记录总数
- 运费总额
- 采购总量
- 平均单均运费

### API 调用

**取消1688订单接口**:
```
POST /api/alibabaOrder/cancel.json
{
  "id": orderId,
  "reason": "采购运费：X元，采购数量：Y件，单件采购运费：Z元",
  "source": "PURCHASE_ORDER",
  "purchaseOperationType": 0
}
```

**成功判断标准**: `code === 0`

---

## 🔄 功能二：批量取消采购单

### 功能说明
支持批量取消采购单，根据订单的 `alibabaInternalStatus` 字段智能选择调用取消采购单接口或取消1688订单接口。

### 触发条件
与超运费分析功能相同，需满足：
- URL 包含 `purchaseManage/index.html`
- "待到货"标签激活
- "单据"视图激活

### 使用步骤

1. 在采购管理页面勾选需要取消的采购单行（可选）
2. 点击页面顶部的"**取消采购单**"按钮（蓝色渐变）
3. 查看确认弹窗中的订单信息
4. 确认每行的取消类型和状态
5. 点击"确认取消"执行操作

### 智能取消逻辑

#### 取消类型判断
插件会根据拦截到的 `alibabaInternalStatus` 字段自动选择正确的取消接口：

| alibabaInternalStatus | 取消类型 | 调用接口 | 说明 |
|----------------------|----------|----------|------|
| 0 | 采购单 | cancelPurchaseOrder() | 取消采购单接口 |
| 1 | 1688订单 | cancelAlibabaOrder() | 取消1688订单接口 |
| 其他 | 未知 | 跳过 | 状态无法识别，跳过该订单 |

#### 操作模式

**勾选模式**:
- 用户勾选特定行
- 只对勾选的行执行取消操作
- 适合精确操作

**全页模式**:
- 用户未勾选任何行
- 自动对页面所有数据执行取消操作
- 弹窗标题显示"全部数据"警告
- 适合批量处理

### 确认弹窗信息

#### 显示字段
- 采购单号
- 1688订单号
- 请款状态
- 取消类型（采购单/1688订单/未知）
- 状态徽章（颜色标识）

#### 状态徽章
- 🟢 **可取消采购单**: 蓝色徽章 (alibabaInternalStatus=0)
- 🟢 **可取消1688订单**: 绿色徽章 (alibabaInternalStatus=1)
- 🔴 **状态未知**: 红色徽章

### API 调用

#### 取消采购单接口
```
POST /api/gw/sellfox/sellfox-purchase/sellfox/purchaseOrder/cancel
{
  "orderNo": "PO240629001",
  "returnPurchasePlan": true
}
```

#### 取消1688订单接口
```
POST /api/alibabaOrder/cancel.json
{
  "id": orderId,
  "reason": "",
  "source": "PURCHASE_ORDER",
  "purchaseOperationType": 1
}
```

**注意**: purchaseOperationType=1 表示从采购单页面触发的取消，reason 为空字符串。

### 操作反馈

#### 进度提示
弹窗底部实时显示操作进度：
```
正在取消 1/20：PO240629001
取消类型：采购单
```

#### 最终结果
操作完成后显示统计信息：
```
完成：成功 18，失败 2，跳过 0
失败明细：PO240615003：库存不足；PO240618002：订单已关闭
```

#### 右上角通知
```
✅ 成功 18，❌ 失败 2
```

---

## 🔧 技术实现

### 数据拦截机制

#### Inject Script (inject.js)
- **运行时机**: `document_start` (MAIN world)
- **拦截目标**: `/api/purchase/page.json`
- **提取字段**:
  - `orderId`: 订单ID（取消接口必需）
  - `tradeId`: 1688订单号
  - `purchaseNo`: 采购单号
  - `alibabaInternalStatus`: 订单内部状态

#### 数据传递
```javascript
window.postMessage({
  source: 'sellfox-plugin-inject',
  type: 'SELLFOX_PURCHASE_PAGE_DATA',
  payload: mappedData
}, '*');
```

### Shadow DOM 访问

SellFox 使用 wujie 微前端框架，插件通过以下方式访问 Shadow DOM：

```javascript
getShadowRoot() {
  const wujieApp = document.querySelector('#amzup-web-vue3 > wujie-app');
  return wujieApp?.shadowRoot || null;
}
```

### 表格数据提取

#### VXE-Table 结构
表格数据分散在三个 wrapper 中：
- `div.vxe-table--fixed-left-wrapper` - 固定左侧列
- `div.vxe-table--body-wrapper` - 主体可滚动列
- `div.vxe-table--fixed-right-wrapper` - 固定右侧列

#### 数据合并
```javascript
// 合并同一行的所有单元格
const mergeRowCells = (rowIndex) => {
  const cells = [];
  rowLists.forEach(rows => {
    if (rows[rowIndex]) {
      rows[rowIndex].querySelectorAll('td').forEach(td => cells.push(td));
    }
  });
  return cells;
};
```

### 动态列识别

插件动态获取列的 `colid`，适配不同的表格配置：

```javascript
const columnIds = {
  shipping: 'col_66',      // 运费
  quantity: 'col_68',      // 采购量
  orderNumber: 'col_51',   // 采购单号
  order1688: 'col_71',     // 1688订单号
  paymentStatus: 'col_73', // 请款状态
  supplier: 'col_74'       // 供应商
};
```

---

## 🐛 调试指南

### 快速调试命令

```javascript
// 强制注入按钮
window.forceInjectPurchaseButton()

// 强制执行超运费分析
window.forceAnalyzeShipping()

// 测试 Shadow DOM 访问
window.testShadowDOM()

// 测试动态 colid 获取
window.testColumnIds()

// 查看订单映射数据
console.log(window.sellFoxPluginDebug.orderIdMap)
```

### 控制台输出

插件只在以下情况输出信息：
- **console.error**: 错误级别（红色）
- **console.warn**: 警告级别（黄色）

**警告信息示例**:
- 未找到必需的列
- 行数据为空或无效
- 无法提取数字

### 常见问题

#### Q: 按钮没有显示？
**A**: 
1. 确认URL包含 `purchaseManage/index.html`
2. 确认"待到货"和"单据"视图是否激活
3. 尝试使用 `window.forceInjectPurchaseButton()` 强制注入

#### Q: API拦截不到数据？
**A**:
1. 刷新页面，确保inject.js在页面加载前已启用
2. 检查Network标签，确认page.json请求存在
3. 查看控制台是否有拦截错误

#### Q: 取消操作失败？
**A**:
1. 检查网络请求，确认API端点正确
2. 验证返回的 `code` 字段是否为 0
3. 查看 error 控制台的具体错误信息

---

## 📊 数据流程图

```
┌─────────────┐
│  用户访问    │
│ 采购管理页面 │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ inject.js   │
│ 拦截API请求 │
│ page.json   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ 提取订单数据         │
│ orderId, tradeId,   │
│ alibabaInternalStatus│
└──────┬──────────────┘
       │
       ▼
┌─────────────┐
│ postMessage │
│ 传递数据     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ content.js  │
│ 接收数据     │
│ 建立映射     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 用户操作     │
│ 点击按钮     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 智能取消     │
│ 根据状态选择 │
│ 调用接口     │
└─────────────┘
```

---

## 💡 最佳实践

### 使用建议

1. **分批处理**: 大量数据建议分批处理，避免一次性操作过多
2. **状态确认**: 取消前仔细确认订单状态和请款状态
3. **网络稳定**: 确保网络连接稳定，避免中途失败
4. **结果验证**: 操作完成后验证结果，确认所有订单都已正确取消

### 数据安全

- ✅ 所有操作都在浏览器本地执行
- ✅ 不收集或上传任何用户数据
- ✅ 仅访问必要的API端点
- ✅ 遵循最小权限原则

---

## 🔄 版本历史

### v1.0.0 (2026-06-29)
- ✨ 新增批量取消超运费采购单功能
- ✨ 新增批量取消采购单功能
- ✨ 智能接口选择机制
- ✨ 支持勾选和全页两种操作模式
- 🔧 优化数据提取和映射逻辑
- 🔧 改进错误处理和用户反馈

---

**注意**: 本插件为特定业务场景定制，如需调整功能或计算逻辑，请修改 `content.js` 和 `inject.js` 中的相关方法。开发详情请参考 [DEVELOPMENT.md](DEVELOPMENT.md)。
