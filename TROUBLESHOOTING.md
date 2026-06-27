# 🐛 SellFox Plugin 调试指南

## 常见问题解决

### 问题1: 按钮不出现

#### 症状
```
[SellFox Plugin] 当前不在采购管理页面
```

#### 解决步骤

##### 1. 重新加载扩展
1. 访问 `chrome://extensions/`
2. 找到 SellFox Plugin
3. 点击 **🔄 重新加载** 按钮
4. 回到采购页面，等待几秒钟

##### 2. 检查URL是否正确
按 F12 打开开发者工具，在Console中输入：
```javascript
window.location.href
```

确认URL包含以下内容：
- `amzup-web-main/amzup-web-vue3`
- `purchaseManage` (可能被URL编码为 `purchaseManage%2Findex.html`)

##### 3. 检查扩展权限
1. 访问 `chrome://extensions/`
2. 找到 SellFox Plugin
3. 点击"详细信息"
4. 确认"网站访问权限"包含 `https://www.sellfox.com/*`

##### 4. 使用强制注入（调试方法）
按 F12 打开开发者工具，在Console中输入：
```javascript
window.forceInjectPurchaseButton()
```

##### 5. 检查页面元素状态
在Console中输入：
```javascript
// 检查"待到货"tab
document.querySelector('span.main-content.text_ellipsis')

// 检查"单据"按钮
document.querySelector('span.el-radio-button__inner')

// 检查按钮插入位置
document.querySelector('div.main_header_container > div.screen_l > div.sf_batch_btn_bar')
```

### 问题2: 按钮出现但点击无反应

#### 解决步骤

##### 1. 检查Console错误
按 F12 查看是否有JavaScript错误

##### 2. 手动触发分析
在Console中输入：
```javascript
window.forceAnalyzeShipping()
```

##### 3. 检查表格是否存在
在Console中输入：
```javascript
document.querySelector('div.vxe-table--body-inner-wrapper')
```

### 问题3: 扩展无法加载

#### 检查清单

##### 1. 检查图标文件
确保 `icons/` 目录中包含：
- `icon16.png`
- `icon48.png`
- `icon128.png`

##### 2. 检查文件完整性
确保以下文件存在且无语法错误：
- `manifest.json`
- `content.js`
- `background.js`

##### 3. 重新安装扩展
1. 在 `chrome://extensions/` 中移除当前扩展
2. 重新加载扩展

## 🔧 调试工具

### 全局调试函数

扩展加载后，以下函数可在Console中使用：

#### window.sellFoxPluginDebug
访问插件实例：
```javascript
// 查看插件状态
window.sellFoxPluginDebug.purchasePageInjected

// 访问配置
window.sellFoxPluginDebug.siteConfig
```

#### window.forceInjectPurchaseButton()
强制注入按钮：
```javascript
window.forceInjectPurchaseButton()
```

#### window.forceAnalyzeShipping()
强制执行分析：
```javascript
window.forceAnalyzeShipping()
```

## 📊 详细的调试流程

### 1. 检查页面状态
```javascript
// 获取当前URL
console.log('当前URL:', window.location.href);

// 检查关键元素是否存在
const elements = {
  '待到货tab': 'span.main-content.text_ellipsis[title*="待到货"]',
  '单据按钮': 'span.el-radio-button__inner',
  '按钮插入位置': 'div.main_header_container > div.screen_l > div.sf_batch_btn_bar',
  '表格容器': 'div.vxe-table--body-inner-wrapper'
};

Object.entries(elements).forEach(([name, selector]) => {
  const element = document.querySelector(selector);
  console.log(`${name}:`, element ? '✅ 存在' : '❌ 不存在');
  if (element) {
    console.log('元素详情:', element);
  }
});
```

### 2. 检查插件状态
```javascript
// 检查插件是否加载
console.log('插件实例:', window.sellFoxPluginDebug);

// 检查按钮注入状态
console.log('按钮已注入:', window.sellFoxPluginDebug?.purchasePageInjected);

// 检查按钮DOM是否存在
const button = document.getElementById('sellfox-analyze-shipping-btn');
console.log('按钮DOM:', button ? '✅ 存在' : '❌ 不存在');
if (button) {
  console.log('按钮详情:', button);
}
```

### 3. 检查表格数据
```javascript
// 检查表格
const table = document.querySelector('div.vxe-table--body-inner-wrapper');
if (table) {
  const rows = table.querySelectorAll('div[rowid^="row_"]');
  console.log(`找到 ${rows.length} 行数据`);

  // 检查第一行的列数据
  if (rows.length > 0) {
    const firstRow = rows[0];
    console.log('第一行rowid:', firstRow.getAttribute('rowid'));

    const col66 = firstRow.querySelector('div[colid="col_66"]');
    const col68 = firstRow.querySelector('div[colid="col_68"]');
    const col51 = firstRow.querySelector('div[colid="col_51"]');

    console.log('col_66:', col66?.textContent);
    console.log('col_68:', col68?.textContent);
    console.log('col_51:', col51?.textContent);
  }
} else {
  console.log('❌ 表格不存在');
}
```

## 🎯 快速测试流程

### 完整测试步骤

1. **打开开发者工具**
   ```
   按 F12 或右键 -> 检查
   ```

2. **检查当前页面**
   ```javascript
   console.log('URL:', window.location.href);
   console.log('标题:', document.title);
   ```

3. **强制注入按钮**
   ```javascript
   window.forceInjectPurchaseButton()
   ```

4. **验证按钮出现**
   - 检查页面是否显示红色按钮
   - 在Console中验证：`document.getElementById('sellfox-analyze-shipping-btn')`

5. **测试分析功能**
   ```javascript
   window.forceAnalyzeShipping()
   ```

6. **检查结果**
   - 查看是否弹出分析结果窗口
   - 检查Console中的日志输出

## 📝 调试日志说明

### 正常启动日志
```
[SellFox Plugin] 初始化中...
[SellFox Plugin] 设置插件功能
[SellFox Plugin] 页面变化检测
[SellFox Plugin] 当前URL: https://www.sellfox.com/...
[SellFox Plugin] URL检查通过，继续检测页面状态
[SellFox Plugin] 页面状态检查通过
[SellFox Plugin] 超运费分析按钮注入成功
[SellFox Plugin] 超运费分析功能已就绪
```

### 按钮点击日志
```
[SellFox Plugin] 开始分析超运费数据...
[SellFox Plugin] 找到 25 行数据
[SellFox Plugin] 提取的表格数据: [...]
[SellFox Plugin] 超运费数据: [...]
[SellFox Plugin] 发现 3 条超运费采购单
```

## 🆘 仍然无法解决？

### 收集诊断信息

运行以下诊断代码，将输出结果发送给开发者：

```javascript
console.log('=== 诊断信息 ===');
console.log('URL:', window.location.href);
console.log('User Agent:', navigator.userAgent);
console.log('插件状态:', window.sellFoxPluginDebug);
console.log('按钮存在:', !!document.getElementById('sellfox-analyze-shipping-btn'));
console.log('表格存在:', !!document.querySelector('div.vxe-table--body-inner-wrapper'));

// 检查页面元素
const criticalElements = {
  waitingTab: 'span.main-content.text_ellipsis',
  orderButton: 'span.el-radio-button__inner',
  buttonBar: 'div.sf_batch_btn_bar'
};

Object.entries(criticalElements).forEach(([name, selector]) => {
  const el = document.querySelector(selector);
  console.log(`${name}:`, el ? {
    exists: true,
    textContent: el.textContent,
    classes: el.className,
    parentActive: el.parentElement?.classList.contains('is-active')
  } : '❌ 不存在');
});
```

### 联系支持
将以上诊断信息连同以下内容提交：
1. 浏览器版本
2. 扩展版本
3. 完整的Console日志
4. 页面截图

---

**提示**: 大多数问题都可以通过重新加载扩展和强制注入功能解决。如果问题持续，请检查浏览器控制台中的错误信息。
