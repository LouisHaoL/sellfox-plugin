/**
 * SellFox Plugin - Background Service Worker
 */

console.log('[SellFox Plugin] Background script 已加载');

// 安装时的事件
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[SellFox Plugin] 扩展已安装/更新:', details.reason);

  // 首次安装时的操作
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: 'https://www.sellfox.com',
      active: true
    });
  }

  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'sellfox-export',
    title: '使用 SellFox Plugin 导出数据',
    contexts: ['page'],
    documentUrlPatterns: ['https://www.sellfox.com/*']
  }, () => {
    if (chrome.runtime.lastError) {
      console.log('[SellFox Plugin] 菜单创建错误:', chrome.runtime.lastError.message);
    } else {
      console.log('[SellFox Plugin] 右键菜单创建成功');
    }
  });
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[SellFox Plugin Background] 收到消息:', request);

  if (request.action === 'saveData') {
    // 保存数据到 storage
    chrome.storage.local.set({ [request.key]: request.data }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'getData') {
    // 从 storage 获取数据
    chrome.storage.local.get([request.key], (result) => {
      sendResponse({ data: result[request.key] });
    });
    return true;
  }

  if (request.action === 'openOptions') {
    // 打开选项页面
    chrome.runtime.openOptionsPage();
    return true;
  }
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[SellFox Plugin Background] 收到消息:', request);

  if (request.action === 'saveData') {
    // 保存数据到 storage
    chrome.storage.local.set({ [request.key]: request.data }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'getData') {
    // 从 storage 获取数据
    chrome.storage.local.get([request.key], (result) => {
      sendResponse({ data: result[request.key] });
    });
    return true;
  }

  if (request.action === 'openOptions') {
    // 打开选项页面
    chrome.runtime.openOptionsPage();
    return true;
  }
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('sellfox.com')) {
    console.log('[SellFox Plugin] SellFox 页面加载完成:', tab.url);

    // 可以在这里执行一些初始化操作
    chrome.tabs.sendMessage(tabId, {
      action: 'pageReady',
      url: tab.url
    }).catch(() => {
      // 页面可能还没加载 content script，忽略错误
    });
  }
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'sellfox-export') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'triggerExport'
    });
  }
});
