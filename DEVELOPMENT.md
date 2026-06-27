# 🛠️ SellFox Plugin 开发指南

本文档详细介绍如何开发和调试 SellFox 浏览器扩展。

## 📋 开发环境要求

- Chrome 浏览器（推荐）或 Firefox
- 代码编辑器（VS Code 推荐）
- 基本的 HTML/CSS/JavaScript 知识

## 🚀 快速开始

### 1. 准备图标

插件需要三个尺寸的图标。你可以：

**使用临时图标**：
```bash
# 在项目根目录创建简单的紫色方块
npx @cliqz/icon-gen --icons icons/
```

**或手动创建**：
- 将 16x16、48x48、128x128 的 PNG 图片放入 `icons/` 目录
- 命名为 `icon16.png`、`icon48.png`、`icon128.png`

### 2. 加载扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目根目录
5. 扩展加载成功！

### 3. 开始开发

修改代码后，在扩展页面点击"重新加载"按钮即可生效。

## 🧪 调试方法

### Content Script 调试

Content Script 是注入到 SellFox 页面中的脚本，调试方法：

1. 访问 `https://www.sellfox.com`
2. 按 `F12` 打开开发者工具
3. 在 Console 中查看 `[SellFox Plugin]` 开头的日志
4. 可以直接在 Console 中测试插件功能

```javascript
// 测试插件实例
const plugin = window.sellFoxPlugin;
console.log(plugin);
```

### Background Script 调试

Background Script 在后台运行，调试方法：

1. 访问 `chrome://extensions/`
2. 找到 SellFox Plugin
3. 点击 "service worker" 链接
4. 打开的 DevTools 就是 Background Script 的控制台

### Popup 调试

1. 点击扩展图标打开 Popup
2. 右键点击 Popup 窗口
3. 选择"检查"
4. 即可调试 Popup 的 HTML 和 JavaScript

## 🔧 代码结构说明

### manifest.json

扩展的配置文件，定义了：
- 基本信息（名称、版本、权限）
- Content Scripts（注入到页面的脚本）
- Background Service Worker
- 权限和主机权限

### content.js

核心功能文件，包含 `SellFoxPlugin` 类：

```javascript
class SellFoxPlugin {
  constructor() {
    this.siteConfig = {
      apiBase: 'https://www.sellfox.com/api',
      buttonSelectors: []
    };
    this.init();
  }
}
```

**主要方法**：
- `init()` - 初始化插件
- `setup()` - 设置功能
- `createButtonContainer()` - 创建按钮容器
- `handleButtonClick(action)` - 处理按钮点击
- `callApi(endpoint, options)` - 调用 API
- `showNotification(message, type)` - 显示通知

### styles.css

定义插件的样式，包括：
- 按钮容器和按钮样式
- 通知消息样式
- 模态框样式
- 响应式设计

### background.js

后台服务，处理：
- 扩展安装事件
- 消息通信
- 标签页监听
- 右键菜单

### popup.js

弹窗脚本，功能：
- 检查当前标签页状态
- 显示插件连接状态
- 提供快捷操作按钮

## 📝 自定义开发指南

### 添加新的 API 端点

在 `content.js` 中添加新方法：

```javascript
async yourCustomMethod() {
  this.showNotification('正在处理...', 'info');
  
  try {
    const result = await this.callApi('/your-endpoint', {
      method: 'POST',
      body: JSON.stringify({
        // 你的数据
      })
    });
    
    this.showNotification('操作成功！', 'success');
    return result;
  } catch (error) {
    this.showNotification('操作失败', 'error');
    throw error;
  }
}
```

### 添加新按钮

在 `createButtonContainer` 方法中：

```javascript
const buttons = [
  { text: '导出数据', action: 'exportData', icon: '📊' },
  { text: '你的按钮', action: 'yourCustomMethod', icon: '🔧' },
  // ...
];
```

### 修改按钮位置

在 `styles.css` 中修改 `.sellfox-plugin-container`：

```css
.sellfox-plugin-container {
  /* 改为固定在页面顶部 */
  top: 20px;
  right: 20px;
  transform: none;
}
```

### 自定义 API 调用

`callApi` 方法会自动处理认证，使用时：

```javascript
const data = await this.callApi('/endpoint', {
  method: 'POST',
  body: JSON.stringify({ key: 'value' }),
  headers: {
    'Custom-Header': 'custom-value'
  }
});
```

## 🔐 处理认证

插件会自动尝试获取 CSRF Token：

1. 从 `<meta name="csrf-token">` 标签获取
2. 从 Cookie 中获取

如果你的网站使用不同的认证方式，修改 `getCsrfToken()` 方法：

```javascript
getCsrfToken() {
  // 自定义认证逻辑
  const token = localStorage.getItem('auth-token');
  return token;
}
```

## 📊 数据存储

使用 Chrome Storage API 存储数据：

```javascript
// 保存数据
chrome.storage.local.set({ 'myData': data }, () => {
  console.log('数据已保存');
});

// 读取数据
chrome.storage.local.get(['myData'], (result) => {
  console.log('保存的数据:', result.myData);
});
```

## 🎨 样式自定义

### 修改颜色主题

在 `styles.css` 中修改主色调：

```css
.sellfox-plugin-btn {
  background: linear-gradient(135deg, #your-color1 0%, #your-color2 100%);
}
```

### 添加动画效果

```css
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.sellfox-plugin-btn:hover {
  animation: pulse 0.3s ease;
}
```

## 🚨 常见问题解决

### 1. 插件无法注入到页面

**原因**: 权限问题或 URL 不匹配

**解决**:
- 检查 `manifest.json` 中的 `host_permissions`
- 确认访问的 URL 与 `matches` 配置匹配

### 2. API 调用失败

**原因**: CORS 或认证问题

**解决**:
- 在 `manifest.json` 添加 `host_permissions`
- 检查 `getCsrfToken()` 方法是否正确获取认证信息

### 3. 按钮不显示

**原因**: CSS 冲突或 DOM 未加载

**解决**:
- 检查浏览器 Console 是否有错误
- 增加 CSS 选择器的特异性
- 确保 `run_at: "document_idle"`

### 4. 修改后不生效

**解决**:
- 在 `chrome://extensions/` 点击重新加载
- 或使用快捷键：点击扩展图标 -> 重新加载

## 📦 发布准备

### 1. 代码检查

```bash
# 格式化代码
npm run format

# 代码检查
npm run lint
```

### 2. 准备素材

- 高质量图标（128x128 最小）
- 截图（1280x800 或 640x400）
- 推广图片（440x280，可选）
- 详细描述文档

### 3. 创建 ZIP 包

```bash
# 压缩项目文件（排除 node_modules 等）
zip -r sellfox-plugin.zip . -x "*.git*" "node_modules/*"
```

### 4. 上传到 Chrome Web Store

访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

## 🔗 相关资源

- [Chrome Extension 文档](https://developer.chrome.com/docs/extensions/mv3/)
- [Manifest V3 指南](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Content Scripts 指南](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)

## 💡 开发技巧

### 1. 热重载

修改代码后，使用 Chrome 扩展页面的"重新加载"按钮可以快速看到效果。

### 2. 调试日志

使用统一的日志前缀便于过滤：

```javascript
console.log('[SellFox Plugin] 你的消息');
```

### 3. 错误处理

始终使用 try-catch 包裹异步操作：

```javascript
try {
  const result = await someAsyncOperation();
} catch (error) {
  console.error('[SellFox Plugin] 错误:', error);
  this.showNotification('操作失败', 'error');
}
```

### 4. 测试不同页面

在 SellFox 网站的不同页面测试，确保插件的兼容性。

---

祝你开发顺利！如有问题，请查看 README 或提交 Issue。
