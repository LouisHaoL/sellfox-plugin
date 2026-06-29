/**
 * SellFox Plugin - Popup Script
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[SellFox Plugin Popup] 初始化');

  // 检查当前标签页
  checkCurrentTab();

  // 设置事件监听器
  setupEventListeners();
});

async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      updateStatus(false, '无活动标签页');
      return;
    }

    const isSellFox = tab.url && tab.url.includes('sellfox.com');

    if (isSellFox) {
      updateStatus(true, '已连接');
      document.getElementById('pageStatus').textContent = 'SellFox 页面';

      // 尝试与 content script 通信
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'getData'
        });

        if (response && response.data) {
          console.log('[SellFox Plugin Popup] 页面数据:', response.data);
        }
      } catch (error) {
        console.log('[SellFox Plugin Popup] Content script 未就绪');
      }
    } else {
      updateStatus(false, '未连接');
      document.getElementById('pageStatus').textContent = '非 SellFox 页面';
    }
  } catch (error) {
    console.error('[SellFox Plugin Popup] 检查标签页失败:', error);
    updateStatus(false, '检查失败');
  }
}

function updateStatus(isConnected, text) {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  if (isConnected) {
    statusDot.classList.remove('inactive');
  } else {
    statusDot.classList.add('inactive');
  }

  statusText.textContent = text;
}

function setupEventListeners() {
  // 刷新状态按钮
  document.getElementById('refreshBtn').addEventListener('click', () => {
    checkCurrentTab();
    showNotification('状态已刷新');
  });

  // 打开 SellFox 网站
  document.getElementById('openSiteBtn').addEventListener('click', async () => {
    await chrome.tabs.create({
      url: 'https://www.sellfox.com',
      active: true
    });
    window.close();
  });

  // 设置按钮
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 帮助链接
  document.getElementById('helpLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: 'https://github.com/your-repo/sellfox-plugin#readme',
      active: true
    });
  });
}

function showNotification(message) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.classList.add('show');

  setTimeout(() => {
    notification.classList.remove('show');
  }, 2000);
}
