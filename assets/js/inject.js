/**
 * SellFox Plugin - Main World 拦截器
 *
 * 运行在页面主世界（world: MAIN, run_at: document_start），
 * 用于拦截 SellFox 自身发出的 /api/purchase/page.json 请求的返回结果，
 * 从中提取每行的 orderId / tradeId(1688订单号) / purchaseNo，
 * 再通过 window.postMessage 把数据回传给 content.js（ISOLATED world）。
 *
 * 说明：
 *  - SellFox 使用 wujie 微前端，子应用运行在 wujie 的 sandbox iframe 中，
 *    其请求可能发自顶层 window，也可能发自 iframe 的 contentWindow。
 *    因此这里会同时 patch 顶层 window 以及所有「同源 iframe」的 contentWindow。
 *  - MAIN 与 ISOLATED 两个世界共享同一个 window 的 message 事件，
 *    所以 content.js 的 window.addEventListener('message') 能收到本脚本发出的消息。
 */
(function () {
  if (window.__sellfoxPluginInjected) return;
  window.__sellfoxPluginInjected = true;

  var TARGET_URL = '/api/purchase/page.json';
  var MSG_SOURCE = 'sellfox-plugin-inject';
  var MSG_TYPE = 'SELLFOX_PURCHASE_PAGE_DATA';

  function log() {
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[SellFox Plugin inject]');
      console.error.apply(console, args);
    } catch (e) {}
  }

  // 把映射后的行数据回传给 content.js
  function postRows(rows, url) {
    try {
      window.postMessage({
        source: MSG_SOURCE,
        type: MSG_TYPE,
        payload: rows,
        url: url || ''
      }, '*');
    } catch (e) {
      log('postMessage 失败:', e);
    }
  }

  // 解析 page.json 响应文本，提取需要的字段
  function handleResponse(url, text) {
    if (!url || url.indexOf(TARGET_URL) === -1) return;
    var json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      log('解析 page.json 失败:', e);
      return;
    }

    var rows = json && json.data && Array.isArray(json.data.rows) ? json.data.rows : [];
    var mapped = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      mapped.push({
        orderId: r.orderId,                              // 取消 1688 订单接口需要的 id
        tradeId: r.tradeId == null ? '' : String(r.tradeId), // 1688 订单号
        purchaseNo: r.purchaseNo || '',                  // 采购单号
        purchasePaidStatus: r.purchasePaidStatus,         // 付款状态: 0-未付款, 1-部分付款, 2-全部付款
        purchaseRequisitionStatus: r.purchaseRequisitionStatus, // 请款状态: 0-未请款, 1-部分请款, 2-全部请款
        createName: r.createName || '',                  // 创建人
        supplierName: r.supplierName || '',              // 供应商
        purchaserName: r.purchaserName || '',            // 采购人
        shipFee: r.shipFee,
        alibabaShippingFee: r.alibabaShippingFee,
        totalNum: r.totalNum,
        waitNum: r.waitNum,
        status: r.status,
        orderStatus: r.orderStatus,
        alibabaInternalStatus: r.alibabaInternalStatus
      });
    }

    if (mapped.length > 0) {
      postRows(mapped, url);
    }
  }

  // 对单个 window 对象 patch fetch 与 XMLHttpRequest
  function patchWindow(win, label) {
    if (!win || win.__sfPatched) return false;
    try {
      // 触碰 document 以判断是否同源可访问（跨域会抛错）
      var doc = win.document;
      void doc;
    } catch (e) {
      return false; // 跨域 iframe，无法 patch
    }

    try {
      // ---------- patch fetch ----------
      if (typeof win.fetch === 'function' && !win.fetch.__sfWrapped) {
        var origFetch = win.fetch;
        var wrappedFetch = function (input, init) {
          var url = '';
          try {
            url = typeof input === 'string' ? input : (input && input.url) || '';
          } catch (e) {}
          var promise = origFetch.apply(this, arguments);
          try {
            if (url && url.indexOf(TARGET_URL) !== -1) {
              promise.then(function (resp) {
                try {
                  // clone 一份再读取，保证页面自身仍能读取响应体
                  resp.clone().text().then(function (t) {
                    handleResponse(url, t);
                  });
                } catch (e) {}
              }).catch(function () {});
            }
          } catch (e) {}
          return promise;
        };
        wrappedFetch.__sfWrapped = true;
        win.fetch = wrappedFetch;
      }

      // ---------- patch XMLHttpRequest ----------
      if (typeof win.XMLHttpRequest === 'function' && !win.XMLHttpRequest.__sfWrapped) {
        var OrigXHR = win.XMLHttpRequest;
        var origOpen = OrigXHR.prototype.open;
        var origSend = OrigXHR.prototype.send;

        OrigXHR.prototype.open = function (method, url) {
          try {
            this.__sfUrl = url;
          } catch (e) {}
          return origOpen.apply(this, arguments);
        };

        OrigXHR.prototype.send = function (body) {
          try {
            var self = this;
            var url = this.__sfUrl;
            if (url && url.indexOf(TARGET_URL) !== -1) {
              this.addEventListener('load', function () {
                try {
                  handleResponse(url, self.responseText);
                } catch (e) {}
              });
            }
          } catch (e) {}
          return origSend.apply(this, arguments);
        };

        OrigXHR.__sfWrapped = true;
      }

      win.__sfPatched = true;
      log('已 patch window:', label || 'top');
      return true;
    } catch (e) {
      log('patch window 失败 (' + (label || 'top') + '):', e);
      return false;
    }
  }

  // 扫描并 patch 所有同源 iframe
  function patchAllIframes() {
    try {
      var frames = document.querySelectorAll('iframe');
      for (var i = 0; i < frames.length; i++) {
        (function (f, idx) {
          try {
            if (f.contentWindow && !f.contentWindow.__sfPatched) {
              patchWindow(f.contentWindow, 'iframe#' + idx);
            }
          } catch (e) {}
        })(frames[i], i);
      }
    } catch (e) {}
  }

  // 1) 立即 patch 顶层 window
  patchWindow(window, 'top');

  // 2) patch 已存在的同源 iframe
  patchAllIframes();

  // 3) 监听后续动态插入的 iframe（wujie 会动态创建 sandbox iframe）
  try {
    var mo = new MutationObserver(function () {
      patchAllIframes();
    });
    mo.observe(document.documentElement || document, { childList: true, subtree: true });
  } catch (e) {
    log('MutationObserver 启动失败:', e);
  }

  // 4) 兜底：iframe 的 load 事件后 contentWindow 可能被重置，重新 patch
  document.addEventListener('load', function (e) {
    try {
      var t = e.target;
      if (t && t.tagName === 'IFRAME' && t.contentWindow) {
        patchWindow(t.contentWindow, 'iframe(load)');
      }
    } catch (err) {}
  }, true);

  log('已注入主世界，开始监听 page.json 请求');
})();
