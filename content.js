/**
 * SellFox Plugin - Content Script
 * 在 SellFox 页面中注入按钮和调用 API
 */

class SellFoxPlugin {
  constructor() {
    this.siteConfig = {
      apiBase: 'https://www.sellfox.com/api',
      buttonSelectors: []
    };
    this.purchasePageInjected = false;
    // tradeId(1688订单号) -> 行数据（含 orderId）；用于把表格行匹配到取消接口所需的 orderId
    this.orderIdMap = {};
    // 尽早注册拦截监听，避免漏掉较早发出的 page.json 请求
    this.setupInterceptorListener();
    this.init();
  }

  async init() {
    // 等待页面加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    // 延迟检查，确保 Shadow DOM 加载完成
    setTimeout(() => {
      // 监听页面变化（SPA 路由切换）
      this.observePageChanges();

      // 检查是否在采购管理页面
      this.checkPurchasePage();

      // 设置消息监听
      this.setupMessageListener();
    }, 2000);
  }

  // 获取 Shadow DOM 根元素
  getShadowRoot() {
    try {
      const wujieApp = document.querySelector('#amzup-web-vue3 > wujie-app');
      if (wujieApp && wujieApp.shadowRoot) {
        return wujieApp.shadowRoot;
      }
      return null;
    } catch (error) {
      console.error('[SellFox Plugin] 获取 Shadow DOM 失败:', error);
      return null;
    }
  }

  // 动态获取表格列的colid
  getColumnIds() {
    try {
      const shadowRoot = this.getShadowRoot();
      if (!shadowRoot) {
        console.error('[SellFox Plugin] 未找到 Shadow DOM');
        return null;
      }

      // 查找表头表格
      const headerTableSelector = 'div.vxe-table--header-wrapper.body--wrapper > div > table';
      const headerTable = shadowRoot.querySelector(headerTableSelector);

      if (!headerTable) {
        console.error('[SellFox Plugin] 未找到表头表格');
        return null;
      }

      const columnIds = {
        shipping: null,      // 运费
        quantity: null,      // 采购量
        orderNumber: null,   // 采购单号
        order1688: null,     // 1688订单号
        paymentStatus: null, // 请款状态
        supplier: null       // 供应商
      };

      // 查找表头行
      const headerRow = headerTable.querySelector('tr');
      if (!headerRow) {
        console.error('[SellFox Plugin] 未找到表头行');
        return null;
      }

      // 遍历表头单元格，按文本匹配列
      const headerCells = headerRow.querySelectorAll('th');
      headerCells.forEach((th) => {
        const colid = th.getAttribute('colid');
        if (!colid) return;

        const spans = th.querySelectorAll('span');
        spans.forEach(span => {
          const text = span.textContent?.trim() || '';
          if (text.includes('运费') && !columnIds.shipping) columnIds.shipping = colid;
          if (text.includes('采购量') && !columnIds.quantity) columnIds.quantity = colid;
          if (text.includes('采购单号') && !columnIds.orderNumber) columnIds.orderNumber = colid;
          if (text.includes('1688订单号') && !columnIds.order1688) columnIds.order1688 = colid;
          if (text.includes('请款状态') && !columnIds.paymentStatus) columnIds.paymentStatus = colid;
          if (text.includes('供应商') && !columnIds.supplier) columnIds.supplier = colid;
        });
      });

      // 验证是否找到所有必需的列
      const missingColumns = [];
      if (!columnIds.shipping) missingColumns.push('运费');
      if (!columnIds.quantity) missingColumns.push('采购量');
      if (!columnIds.orderNumber) missingColumns.push('采购单号');
      if (missingColumns.length > 0) {
        console.warn(`[SellFox Plugin] 未找到以下列: ${missingColumns.join(', ')}`);
      }

      return columnIds;

    } catch (error) {
      console.error('[SellFox Plugin] 动态获取colid失败:', error);
      return null;
    }
  }

  observePageChanges() {
    // 监听 SPA 路由/视图变化
    // 注意：SellFox 应用运行在 wujie 的 Shadow DOM 中，Shadow 内部的 DOM 变化
    // 不会被挂在 light DOM(document.body) 上的 observer 捕获，
    // 因此除了监听 document.body，还需要直接监听 shadowRoot。
    const observer = new MutationObserver(() => {
      this.onPageChange();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // shadowRoot 可能尚未就绪，单独处理
    this.setupShadowObserver();
  }

  // 监听 Shadow DOM 内部变化（标签页切换、单据/商品视图切换、表格刷新等）
  setupShadowObserver() {
    const shadowRoot = this.getShadowRoot();
    if (!shadowRoot) {
      if (!this._shadowObserverPending) {
        this._shadowObserverPending = true;
        setTimeout(() => {
          this._shadowObserverPending = false;
          this.setupShadowObserver();
        }, 2000);
      }
      return;
    }
    // 避免对同一个 shadowRoot 重复挂载
    if (this._observedShadowRoot === shadowRoot) {
      return;
    }
    this._observedShadowRoot = shadowRoot;
    const observer = new MutationObserver(() => {
      this.onPageChange();
    });
    observer.observe(shadowRoot, {
      childList: true,
      subtree: true
    });
  }

  onPageChange() {
    // 确保 shadowRoot 一旦可用就被监听（处理 host 元素被重建的情况）
    this.setupShadowObserver();

    // 防抖：DOM 频繁变化（如表格虚拟滚动）时合并为一次检查，避免抖动与性能浪费
    if (this._pageChangeTimer) {
      clearTimeout(this._pageChangeTimer);
    }
    this._pageChangeTimer = setTimeout(() => {
      this._pageChangeTimer = null;
      this.checkPurchasePage();
    }, 300);
  }

  checkPurchasePage() {
    // 检查 URL 是否匹配采购管理页面
    const currentUrl = window.location.href;

    // 检查是否包含amzup-web-main路径
    if (!currentUrl.includes('amzup-web-main/amzup-web-vue3')) {
      return;
    }

    // 检查是否包含purchaseManage路径（处理URL编码情况）
    // 原始URL可能是 purchaseManage/index.html 或 purchaseManage%2Findex.html
    const hasPurchaseManage =
      currentUrl.includes('purchaseManage/index.html') ||
      currentUrl.includes('purchaseManage%2Findex.html');

    if (!hasPurchaseManage) {
      return;
    }

    // 检查页面元素状态：仅在「待到货」标签 + 「单据」视图下才展示按钮
    const isWaitingForGoods = this.checkPageState();
    if (!isWaitingForGoods) {
      // 切换到其他标签页（待下单等）或切到「商品」视图时，隐藏按钮
      this.hidePurchaseButton();
      return;
    }

    // 状态匹配：若按钮已存在则直接显示（避免重复创建/重复提示）
    const shadowRoot = this.getShadowRoot();
    const existingBtn = shadowRoot && shadowRoot.getElementById('sellfox-analyze-shipping-btn');
    if (existingBtn) {
      existingBtn.style.display = '';
      this.purchasePageInjected = true;
      return;
    }

    // 注入采购管理页面专用按钮
    setTimeout(() => {
      this.injectPurchaseButton();
    }, 1000);
  }

  checkPageState() {
    try {
      // 获取 Shadow DOM
      const shadowRoot = this.getShadowRoot();
      if (!shadowRoot) {
        return false;
      }

      // 检查"待到货"tab是否激活
      const waitingTab = shadowRoot.querySelector('ul.el-menu > li.el-menu-item.is-active span');
      if (!waitingTab) {
        return false;
      }

      if (!waitingTab.textContent.includes('待到货')) {
        return false;
      }

      // 检查"单据"按钮是否激活
      const orderButton = shadowRoot.querySelector('label.el-radio-button.is-active span.el-radio-button__inner');
      if (!orderButton) {
        return false;
      }

      if (!orderButton.textContent.includes('单据')) {
        return false;
      }

      return true;

    } catch (error) {
      console.error('[SellFox Plugin] 页面状态检查失败:', error);
      return false;
    }
  }

  injectPurchaseButton() {
    try {
      // 获取 Shadow DOM
      const shadowRoot = this.getShadowRoot();
      if (!shadowRoot) {
        setTimeout(() => this.injectPurchaseButton(), 2000);
        return;
      }

      // 查找按钮插入位置（在 Shadow DOM 中）
      const buttonBar = shadowRoot.querySelector('div.main_header_container > div.screen_l > div.sf_batch_btn_bar');
      if (!buttonBar) {
        // 尝试其他可能的选择器
        const alternativePositions = [
          'div[class*="batch"]',
          'div[class*="btn"]',
          'div[class*="header"]',
          'div[class*="container"]'
        ];

        for (const selector of alternativePositions) {
          const element = shadowRoot.querySelector(selector);
          if (element) {
            this.createAndInsertButton(element, shadowRoot);
            return;
          }
        }

        setTimeout(() => this.injectPurchaseButton(), 2000);
        return;
      }

      // 检查按钮是否已存在
      if (shadowRoot.getElementById('sellfox-analyze-shipping-btn')) {
        return;
      }

      this.createAndInsertButton(buttonBar, shadowRoot);

    } catch (error) {
      console.error('[SellFox Plugin] 按钮注入失败:', error);
    }
  }

  createAndInsertButton(buttonBar, shadowRoot) {
    try {
      // 检查按钮是否已存在
      if (shadowRoot.getElementById('sellfox-analyze-shipping-btn')) {
        return;
      }

      // 创建按钮
      const analyzeButton = shadowRoot.createElement ? shadowRoot.createElement('button') : document.createElement('button');
      analyzeButton.id = 'sellfox-analyze-shipping-btn';
      analyzeButton.className = 'sellfox-analyze-shipping-btn';
      analyzeButton.textContent = '取消超运费采购单';
      analyzeButton.style.cssText = `
        margin-left: 10px;
        padding: 8px 16px;
        background: linear-gradient(135deg, #f56c6c 0%, #e6a23c 100%);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(245, 108, 108, 0.3);
      `;

      // 添加悬停效果
      analyzeButton.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 4px 12px rgba(245, 108, 108, 0.4)';
      });

      analyzeButton.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 2px 8px rgba(245, 108, 108, 0.3)';
      });

      // 点击事件
      analyzeButton.addEventListener('click', () => {
        this.analyzeShippingData();
      });

      // 将按钮作为buttonBar的子节点添加到最后
      buttonBar.appendChild(analyzeButton);
      this.purchasePageInjected = true;

      this.showNotification('超运费分析功能已就绪', 'success');

    } catch (error) {
      console.error('[SellFox Plugin] 按钮创建和插入失败:', error);
    }
  }

  // 隐藏「取消超运费采购单」按钮（保留 DOM 节点，切回「待到货 + 单据」时可直接显示）
  hidePurchaseButton() {
    try {
      const shadowRoot = this.getShadowRoot();
      if (!shadowRoot) {
        return;
      }
      const btn = shadowRoot.getElementById('sellfox-analyze-shipping-btn');
      if (btn) {
        btn.style.display = 'none';
      }
    } catch (error) {
      console.error('[SellFox Plugin] 隐藏按钮失败:', error);
    }
  }

  analyzeShippingData() {
    try {
      this.showNotification('正在分析数据...', 'info');

      // 获取表格数据
      const tableData = this.extractTableData();

      if (!tableData || tableData.length === 0) {
        this.showNotification('未找到表格数据', 'error');
        return;
      }

      // 分析超运费数据
      const overShippingData = this.filterOverShippingData(tableData);

      if (overShippingData.length === 0) {
        this.showNotification('未发现超运费采购单', 'success');
        return;
      }

      // 显示结果弹窗
      this.displayOverShippingResults(overShippingData);

    } catch (error) {
      console.error('[SellFox Plugin] 数据分析失败:', error);
      this.showNotification('数据分析失败', 'error');
    }
  }

  extractTableData() {
    try {
      // 获取 Shadow DOM
      const shadowRoot = this.getShadowRoot();
      if (!shadowRoot) {
        console.error('[SellFox Plugin] 未找到 Shadow DOM');
        return [];
      }

      // 首先动态获取列colid
      const columnIds = this.getColumnIds();
      if (!columnIds || !columnIds.shipping || !columnIds.quantity) {
        console.error('[SellFox Plugin] 无法获取必需的列colid');
        return [];
      }

      // 保存列colid供后续使用
      this.columnIds = columnIds;

      // vxe-table 会把同一行的列拆分到三个并行的 wrapper 表格中（三者行序完全一致）：
      //   - div.vxe-table--fixed-left-wrapper    固定在左侧的列（例如：采购单号 col_51）
      //   - div.vxe-table--body-wrapper          主体可滚动列（例如：运费 col_66、采购量 col_68、请款状态、供应商）
      //   - div.vxe-table--fixed-right-wrapper   固定在右侧的列
      // 因此必须把三个 wrapper 中「同一行」的单元格合并，再按 colid(class) 查找。
      const wrapperSelectors = [
        'div.vxe-table--fixed-left-wrapper > div > table > tbody',
        'div.vxe-table--fixed-left-wrapper table tbody',
        'div.vxe-table--body-wrapper > div > table > tbody',
        'div.vxe-table--body-wrapper table tbody',
        'div.vxe-table--fixed-right-wrapper > div > table > tbody',
        'div.vxe-table--fixed-right-wrapper table tbody'
      ];

      const tbodies = [];
      const seen = new Set();
      wrapperSelectors.forEach(sel => {
        shadowRoot.querySelectorAll(sel).forEach(t => {
          if (!seen.has(t)) {
            seen.add(t);
            tbodies.push(t);
          }
        });
      });

      if (tbodies.length === 0) {
        console.error('[SellFox Plugin] 未找到任何 tbody');
        return [];
      }

      return this.processTableBody(tbodies, columnIds);

    } catch (error) {
      console.error('[SellFox Plugin] 表格数据提取失败:', error);
      return [];
    }
  }

  processTableBody(tbodies, columnIds) {
    try {
      // 统一成数组（兼容传入单个 tbody 的情况）
      if (!Array.isArray(tbodies)) tbodies = [tbodies];

      // 每个 tbody 中的 tr 列表；各 wrapper 的行序一致，按行索引对齐
      const rowLists = tbodies.map(t => Array.from(t.querySelectorAll('tr')));
      const rowCount = rowLists.reduce((m, r) => Math.max(m, r.length), 0);

      if (rowCount === 0) {
        return [];
      }

      // 在一组单元格中按 colid(class) 查找对应列的 td
      const findCell = (cells, colClass) =>
        colClass ? (cells.find(td => td.classList && td.classList.contains(colClass)) || null) : null;

      // 把指定行的所有 wrapper 单元格合并成一个数组
      const mergeRowCells = (rowIndex) => {
        const cells = [];
        rowLists.forEach(rows => {
          if (rows[rowIndex]) rows[rowIndex].querySelectorAll('td').forEach(td => cells.push(td));
        });
        return cells;
      };

      const tableData = [];
      let skippedRows = 0;
      let processedRows = 0;

      for (let index = 0; index < rowCount; index++) {
        try {
          // 合并该行在所有 wrapper 中的单元格，再按 colid 查找
          const cells = mergeRowCells(index);

          const shippingCell = findCell(cells, columnIds.shipping);
          const quantityCell = findCell(cells, columnIds.quantity);
          const orderNumberCell = findCell(cells, columnIds.orderNumber);
          const order1688Cell = findCell(cells, columnIds.order1688);
          const paymentStatusCell = findCell(cells, columnIds.paymentStatus);
          const supplierCell = findCell(cells, columnIds.supplier);

          if (!shippingCell || !quantityCell) {
            skippedRows++;
            continue;
          }

          // 从单元格中提取数据
          const shippingText = this.getCellValue(shippingCell);
          const quantityText = this.getCellValue(quantityCell);
          const orderNumberText = orderNumberCell ? this.getCellValue(orderNumberCell) : null;
          const order1688Text = order1688Cell ? this.getCellValue(order1688Cell) : null;
          const paymentStatusText = paymentStatusCell ? this.getCellValue(paymentStatusCell) : '';
          const supplierText = supplierCell ? this.getCellValue(supplierCell) : '';

          // 检查必需数据是否存在
          if (!shippingText || !quantityText) {
            console.warn(`[SellFox Plugin] 行 ${index}: 运费或采购量为空 - 运费: ${shippingText}, 采购量: ${quantityText}`);
            skippedRows++;
            continue;
          }

          // 提取数字
          const shippingValue = this.extractNumber(shippingText);
          const quantityValue = this.extractNumber(quantityText);

          // 检查数据有效性
          if (isNaN(shippingValue) || isNaN(quantityValue) || quantityValue === 0) {
            console.warn(`[SellFox Plugin] 行 ${index}: 无效数字 - 运费: ${shippingValue}, 采购量: ${quantityValue}`);
            skippedRows++;
            continue;
          }

          // 计算单件运费
          const ratio = shippingValue / quantityValue;

          processedRows++;

          // 添加数据行
          const rowData = {
            shippingValue: shippingValue,
            quantityValue: quantityValue,
            orderNumber: orderNumberText || `UNKNOWN-${index}`,
            ratio: ratio,
            paymentStatus: paymentStatusText,
            supplier: supplierText,
            columnIds: columnIds // 保存colid信息用于显示
          };

          // 如果有1688订单号，也保存
          if (order1688Text) {
            rowData.order1688 = order1688Text;
          }

          tableData.push(rowData);

        } catch (error) {
          console.error(`[SellFox Plugin] 处理行 ${index} 时出错:`, error);
          skippedRows++;
        }
      }

      console.log(`[SellFox Plugin] 数据提取完成: 总行数=${rowCount}, 处理=${processedRows}, 跳过=${skippedRows}, 有效数据=${tableData.length}`);
      return tableData;

    } catch (error) {
      console.error('[SellFox Plugin] 处理表格数据时出错:', error);
      return [];
    }
  }

  // 从单元格中提取文本内容
  getCellValue(cell) {
    try {
      if (!cell) return null;

      // 直接使用 innerText，更简单可靠
      return cell.innerText ? cell.innerText.trim() : null;
    } catch (error) {
      console.error('[SellFox Plugin] 提取单元格内容失败:', error);
      return null;
    }
  }

  extractNumber(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    // 移除常见的货币符号和千分位逗号
    let cleanedText = text
      .replace(/[¥$€£₹₽₩¢]/g, '') // 移除货币符号
      .replace(/,/g, '')          // 移除千分位逗号
      .replace(/\s/g, '');        // 移除空格

    // 提取数字（支持小数、负数）
    const match = cleanedText.match(/-?\d+\.?\d*/);
    if (match) {
      const num = parseFloat(match[0]);
      return isNaN(num) ? 0 : num;
    }

    // 如果没有找到数字，返回 0
    console.warn(`[SellFox Plugin] 无法从 "${text}" 提取数字`);
    return 0;
  }

  filterOverShippingData(tableData) {
    // 过滤条件：
    // 1. 单件运费大于1
    // 2. 请款状态 innerText 包含"未请款"
    return tableData.filter(row => {
      const ratioOk = row.ratio > 1;
      // 请款状态必须包含"未请款"字样
      const paymentStatusOk = row.paymentStatus && row.paymentStatus.includes('未请款');
      return ratioOk && paymentStatusOk;
    });
  }

  // ===== page.json 响应拦截 → orderId 映射 =====

  // 接收来自 inject.js（MAIN world）的 postMessage，累积 orderId 映射
  setupInterceptorListener() {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== 'sellfox-plugin-inject') return;
      if (data.type === 'SELLFOX_PURCHASE_PAGE_DATA' && Array.isArray(data.payload)) {
        this.mergeOrderIdMap(data.payload);
      }
    });
    console.log('[SellFox Plugin] 已注册 page.json 拦截监听');
  }

  // 把拦截到的行数据合并进 orderIdMap
  // 主键：tradeId(1688订单号)；兜底：purchaseNo(采购单号)、纯数字 tradeId
  mergeOrderIdMap(rows) {
    let added = 0;
    rows.forEach(r => {
      if (!r || r.orderId == null) return;
      const entry = {
        orderId: r.orderId,
        tradeId: r.tradeId || '',
        purchaseNo: r.purchaseNo || ''
      };
      if (r.tradeId) {
        this.orderIdMap[String(r.tradeId)] = entry;
        this.orderIdMap[String(r.tradeId).replace(/\D/g, '')] = entry; // 纯数字兜底
        added++;
      }
      if (r.purchaseNo) {
        this.orderIdMap['po:' + String(r.purchaseNo)] = entry;
      }
    });
    console.log(`[SellFox Plugin] 拦截到 ${rows.length} 行，新增 orderId 映射 ${added} 条，累计 ${Object.keys(this.orderIdMap).length} 个键`);
  }

  // 根据表格行（含 order1688/tradeId 或 orderNumber/purchaseNo）解析出 orderId
  resolveOrderId(row) {
    if (!row) return null;
    const keys = [];
    if (row.order1688) keys.push(String(row.order1688).trim());
    if (row.order1688) keys.push(String(row.order1688).replace(/\D/g, '')); // 纯数字兜底
    if (row.orderNumber) keys.push('po:' + String(row.orderNumber).trim());
    for (const k of keys) {
      if (k && this.orderIdMap[k]) return this.orderIdMap[k].orderId;
    }
    return null;
  }

  // orderId 匹配状态徽标（用于在弹窗表格里直观展示能否取消）
  orderMatchBadgeHtml(orderId) {
    if (orderId) {
      return ` <span style="display:inline-block;margin-left:6px;padding:1px 7px;font-size:11px;color:#15803d;background:#dcfce7;border-radius:8px;white-space:nowrap;">orderId:${orderId}</span>`;
    }
    return ` <span style="display:inline-block;margin-left:6px;padding:1px 7px;font-size:11px;color:#b91c1c;background:#fee2e2;border-radius:8px;white-space:nowrap;">未取到orderId</span>`;
  }

  // ===== 1688 订单取消 =====

  // 按模板生成取消原因：采购运费：x元，采购数量：y件，单件采购运费：z元（z = x / y）
  buildCancelReason(row) {
    const x = Number(row.shippingValue) || 0;  // 采购运费
    const y = Number(row.quantityValue) || 0;  // 采购数量
    const z = y > 0 ? (x / y) : 0;             // 单件采购运费
    return `采购运费：${x.toFixed(2)}元，采购数量：${y}件，单件采购运费：${z.toFixed(2)}元`;
  }

  // 调用取消 1688 订单接口
  async cancelAlibabaOrder(orderId, reason) {
    const url = this.siteConfig.apiBase + '/alibabaOrder/cancel.json';
    const body = {
      id: orderId,
      reason: reason,
      source: 'PURCHASE_ORDER',
      purchaseOperationType: 0
    };
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'x-request-id': this.genRequestId()
      },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    const text = await resp.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* 非JSON响应 */ }
    const ok = resp.ok && json && (json.code === 0 || json.code === 200 || json.success === true);
    return {
      ok,
      status: resp.status,
      msg: json ? (json.msg || json.message) : null,
      json,
      text
    };
  }

  // 批量取消弹窗中勾选行的 1688 订单
  async batchCancel1688Orders(ctx) {
    const { modal, data, resolvedOrderIds, cancelBtn, statusBox } = ctx;

    const checked = modal.querySelectorAll('.sellfox-row-checkbox:checked');
    if (checked.length === 0) {
      this.showNotification('请先勾选要取消的采购单', 'error');
      statusBox.innerHTML = `<span style="color:#b91c1c;">请先勾选至少一条记录</span>`;
      return;
    }

    const targets = [];
    const missing = [];
    checked.forEach(cb => {
      const idx = parseInt(cb.getAttribute('data-index'), 10);
      const row = data[idx];
      const orderId = resolvedOrderIds[idx];
      if (orderId && row) {
        targets.push({ row, orderId });
      } else {
        missing.push(row ? (row.orderNumber || row.order1688 || '未知') : '未知');
      }
    });

    if (targets.length === 0) {
      statusBox.innerHTML = `<span style="color:#b91c1c;">勾选的行均未取到 orderId，无法取消。请刷新页面/翻页后重试。</span>`;
      this.showNotification('勾选的行均未取到 orderId', 'error');
      return;
    }

    // 取消是不可逆操作，做二次确认
    const confirmMsg =
      `确定要取消 ${targets.length} 个 1688 订单吗？\n此操作不可撤销。` +
      (missing.length ? `\n另有 ${missing.length} 条因未取到 orderId 将被跳过。` : '');
    if (!window.confirm(confirmMsg)) return;

    cancelBtn.disabled = true;
    const origText = cancelBtn.textContent;
    cancelBtn.textContent = '取消中...';

    let success = 0;
    let fail = 0;
    const failList = [];

    for (let i = 0; i < targets.length; i++) {
      const { row, orderId } = targets[i];
      const reason = this.buildCancelReason(row);
      statusBox.innerHTML =
        `正在取消 <b>${i + 1}/${targets.length}</b>：${this.escapeHtml(row.orderNumber || '')}（orderId:${orderId}）<br>` +
        `原因：${this.escapeHtml(reason)}`;
      try {
        const result = await this.cancelAlibabaOrder(orderId, reason);
        if (result.ok) {
          success++;
        } else {
          fail++;
          failList.push(`${row.orderNumber || row.order1688 || orderId}：${result.msg || ('HTTP ' + result.status)}`);
        }
      } catch (e) {
        fail++;
        failList.push(`${row.orderNumber || row.order1688 || orderId}：${e.message || String(e)}`);
      }
      // 简单限速，避免请求过快被风控
      if (i < targets.length - 1) await this.sleep(300);
    }

    cancelBtn.disabled = false;
    cancelBtn.textContent = origText;

    let summary = `完成：成功 <b style="color:#15803d;">${success}</b>，失败 <b style="color:#b91c1c;">${fail}</b>`;
    if (missing.length) summary += `；跳过（未取到orderId）${missing.length} 条`;
    if (failList.length) summary += `<br>失败明细：${this.escapeHtml(failList.join('；'))}`;
    statusBox.innerHTML = summary;

    this.showNotification(
      `取消完成：成功 ${success}，失败 ${fail}`,
      fail > 0 ? 'error' : 'success'
    );

    // 操作结束后自动关闭弹窗（短暂停留，便于看到最终状态）
    await this.sleep(600);
    this.closeModal(modal);
  }

  // 安全关闭弹窗
  closeModal(modal) {
    try {
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    } catch (e) {
      console.error('[SellFox Plugin] 关闭弹窗失败:', e);
    }
  }

  // 生成随机 x-request-id（仅用于请求追踪，与页面原逻辑一致）
  genRequestId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 12; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  displayOverShippingResults(data) {
    // 创建弹窗
    const modal = document.createElement('div');
    modal.id = 'sellfox-over-shipping-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 1100px;
      max-height: 85vh;
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // 创建标题栏
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    `;

    const title = document.createElement('h3');
    title.textContent = `超运费采购单分析结果 (${data.length} 条)`;
    title.style.cssText = `
      margin: 0;
      color: #1f2937;
      font-size: 18px;
      font-weight: 600;
    `;

    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      font-size: 28px;
      font-weight: bold;
      color: #9ca3af;
      cursor: pointer;
      line-height: 1;
      transition: color 0.2s ease;
    `;

    closeBtn.addEventListener('mouseenter', function() {
      this.style.color = '#4b5563';
    });

    closeBtn.addEventListener('mouseleave', function() {
      this.style.color = '#9ca3af';
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    // 创建表格
    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `
      padding: 20px;
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
    `;

    const table = document.createElement('table');
    table.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    `;

    // 判断是否存在各可选列
    const hasOrder1688 = data.length > 0 && data[0].order1688;
    const hasSupplier = data.length > 0 && data[0].columnIds && data[0].columnIds.supplier;
    const hasPaymentStatus = data.length > 0 && data[0].columnIds && data[0].columnIds.paymentStatus;

    const thead = document.createElement('thead');

    // 构建表头单元格
    const headerCells = ['<th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; width: 80px;">全选<br><input type="checkbox" id="sellfox-select-all" style="margin-top: 4px; width: 16px; height: 16px; cursor: pointer;"></th>'];
    headerCells.push('<th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; width: 180px;">采购单号</th>');
    if (hasOrder1688) {
      headerCells.push('<th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">1688订单号</th>');
    }
    if (hasSupplier) {
      headerCells.push('<th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">供应商</th>');
    }
    if (hasPaymentStatus) {
      headerCells.push('<th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; width: 80px;">请款状态</th>');
    }
    headerCells.push('<th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; width: 100px;">采购运费</th>');
    headerCells.push('<th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; width: 80px;">采购量</th>');
    headerCells.push('<th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; width: 100px;">单件运费</th>');

    thead.innerHTML = `<tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">${headerCells.join('')}</tr>`;

    // 表体
    const tbody = document.createElement('tbody');
    // 预先解析每行对应的 orderId（来自 page.json 拦截映射）
    const resolvedOrderIds = data.map(row => this.resolveOrderId(row));
    data.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.style.cssText = `
        border-bottom: 1px solid #e5e7eb;
        ${index % 2 === 0 ? 'background: #ffffff;' : 'background: #f9fafb;'}
      `;

      const cells = [];
      const orderId = resolvedOrderIds[index];
      const badge = this.orderMatchBadgeHtml(orderId);
      // 复选框列
      cells.push(`<td style="padding: 12px; text-align: center;"><input type="checkbox" class="sellfox-row-checkbox" data-index="${index}" style="width: 16px; height: 16px; cursor: pointer;"></td>`);
      // 采购单号
      cells.push(`<td style="padding: 12px; color: #1f2937; font-weight: 500;">${row.orderNumber}${hasOrder1688 ? '' : badge}</td>`);
      if (hasOrder1688) {
        cells.push(`<td style="padding: 12px; color: #1f2937; font-weight: 500;">${row.order1688 || '-'}${badge}</td>`);
      }
      if (hasSupplier) {
        cells.push(`<td style="padding: 12px; color: #1f2937;">${row.supplier || '-'}</td>`);
      }
      if (hasPaymentStatus) {
        cells.push(`<td style="padding: 12px; color: #1f2937;">${row.paymentStatus || '-'}</td>`);
      }
      cells.push(`<td style="padding: 12px; text-align: right; color: #ef4444; font-weight: 500;">¥${row.shippingValue.toFixed(2)}</td>`);
      cells.push(`<td style="padding: 12px; text-align: right; color: #1f2937;">${row.quantityValue}</td>`);
      cells.push(`<td style="padding: 12px; text-align: right; color: #ef4444; font-weight: 600; background: #fef2f2;">¥${row.ratio.toFixed(2)}</td>`);

      tr.innerHTML = cells.join('');
      tbody.appendChild(tr);
    });

    // 添加汇总行
    const totalRow = document.createElement('tr');
    totalRow.style.cssText = `
      background: #fef3c7;
      border-top: 2px solid #f59e0b;
      font-weight: 600;
    `;

    const totalShipping = data.reduce((sum, row) => sum + row.shippingValue, 0);
    const totalQuantity = data.reduce((sum, row) => sum + row.quantityValue, 0);
    const avgRatio = data.length > 0 ? data.reduce((sum, row) => sum + row.ratio, 0) / data.length : 0;

    const totalCells = [];
    totalCells.push('<td style="padding: 12px; color: #92400e;"></td>');
    totalCells.push(`<td style="padding: 12px; color: #92400e;">共 ${data.length} 条超运费记录</td>`);
    if (hasOrder1688) totalCells.push('<td style="padding: 12px; color: #92400e;"></td>');
    if (hasSupplier) totalCells.push('<td style="padding: 12px; color: #92400e;"></td>');
    if (hasPaymentStatus) totalCells.push('<td style="padding: 12px; color: #92400e;"></td>');
    totalCells.push(`<td style="padding: 12px; text-align: right; color: #b45309;">¥${totalShipping.toFixed(2)}</td>`);
    totalCells.push(`<td style="padding: 12px; text-align: right; color: #92400e;">${totalQuantity}</td>`);
    totalCells.push(`<td style="padding: 12px; text-align: right; color: #b45309;">¥${avgRatio.toFixed(2)}</td>`);

    totalRow.innerHTML = totalCells.join('');
    tbody.appendChild(totalRow);

    table.appendChild(thead);
    table.appendChild(tbody);
    tableContainer.appendChild(table);

    // ===== 底部操作栏：批量取消 1688 订单 =====
    const matchCount = resolvedOrderIds.filter(Boolean).length;

    const actionBar = document.createElement('div');
    actionBar.style.cssText = `
      padding: 16px 20px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      gap: 12px;
      background: #f9fafb;
      border-radius: 0 0 12px 12px;
      flex-wrap: wrap;
      flex-shrink: 0;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'sellfox-cancel-1688-btn';
    cancelBtn.textContent = '取消1688订单';
    cancelBtn.style.cssText = `
      padding: 9px 20px;
      background: linear-gradient(135deg, #dc2626 0%, #ea580c 100%);
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
    `;
    cancelBtn.addEventListener('mouseenter', function () {
      if (!this.disabled) this.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.45)';
    });
    cancelBtn.addEventListener('mouseleave', function () {
      this.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.3)';
    });

    const statusBox = document.createElement('div');
    statusBox.id = 'sellfox-cancel-status';
    statusBox.style.cssText = `flex: 1; min-width: 240px; font-size: 13px; color: #4b5563; line-height: 1.6;`;
    if (matchCount === 0) {
      statusBox.innerHTML = `<span style="color:#b91c1c;">⚠ 未拦截到 page.json 数据，无法取到 orderId。</span> 请刷新页面后重试（确保扩展在页面加载前已启用）。已匹配：<b>0</b>/${data.length}`;
    } else {
      statusBox.innerHTML = `已匹配 orderId：<b style="color:#15803d;">${matchCount}</b>/${data.length} 条。勾选要取消的行，再点击左侧按钮批量取消（操作不可撤销）。`;
    }

    cancelBtn.addEventListener('click', () => {
      this.batchCancel1688Orders({ modal, data, resolvedOrderIds, cancelBtn, statusBox });
    });

    actionBar.appendChild(cancelBtn);
    actionBar.appendChild(statusBox);

    // 组装弹窗
    modalContent.appendChild(header);
    modalContent.appendChild(tableContainer);
    modalContent.appendChild(actionBar);
    modal.appendChild(modalContent);

    // 关闭事件
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    document.body.appendChild(modal);

    // 全选/反选功能
    const selectAllCheckbox = modal.querySelector('#sellfox-select-all');
    const rowCheckboxes = modal.querySelectorAll('.sellfox-row-checkbox');

    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', function() {
        const isChecked = this.checked;
        rowCheckboxes.forEach(cb => {
          cb.checked = isChecked;
        });
      });
    }

    // 单个复选框变化时更新全选状态
    rowCheckboxes.forEach(cb => {
      cb.addEventListener('change', function() {
        const checkedCount = modal.querySelectorAll('.sellfox-row-checkbox:checked').length;
        const totalCount = rowCheckboxes.length;
        if (selectAllCheckbox) {
          selectAllCheckbox.checked = checkedCount === totalCount;
        }
      });
    });

    this.showNotification(`发现 ${data.length} 条超运费采购单`, 'success');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `sellfox-plugin-notification sellfox-plugin-notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      min-width: 300px;
      padding: 16px 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      font-size: 14px;
      z-index: 100001;
      opacity: 0;
      transform: translateX(100px);
      transition: all 0.3s ease;
      border-left: 4px solid ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#667eea'};
      ${type === 'success' ? 'background: #f0fdf4;' : type === 'error' ? 'background: #fef2f2;' : ''}
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 10);

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100px)';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'getData') {
        const data = this.getPageData();
        sendResponse({ data });
      } else if (request.action === 'triggerExport') {
        this.analyzeShippingData();
      }

      return true;
    });
  }

  getPageData() {
    // 获取当前页面的数据
    return {
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      purchasePageActive: this.purchasePageInjected
    };
  }
}

// 初始化插件
const sellFoxPlugin = new SellFoxPlugin();

// 调试功能：将插件实例暴露到全局，方便控制台调试
window.sellFoxPluginDebug = sellFoxPlugin;

// 添加手动触发按钮注入的功能（用于调试）
window.forceInjectPurchaseButton = function() {
  console.log('[SellFox Plugin] 强制注入采购分析按钮...');
  sellFoxPlugin.purchasePageInjected = false; // 重置状态
  sellFoxPlugin.injectPurchaseButton();
};

// 添加手动触发分析的功能（用于调试）
window.forceAnalyzeShipping = function() {
  console.log('[SellFox Plugin] 强制执行超运费分析...');
  sellFoxPlugin.analyzeShippingData();
};

// 添加测试 Shadow DOM 访问的功能
window.testShadowDOM = function() {
  console.log('=== 测试 Shadow DOM 访问 ===');

  const shadowRoot = sellFoxPlugin.getShadowRoot();
  if (!shadowRoot) {
    console.log('❌ 未找到 Shadow DOM');
    return;
  }

  console.log('✅ Shadow DOM 访问成功');

  // 测试各种选择器
  const tests = {
    '待到货tab': 'ul.el-menu > li.el-menu-item.is-active span',
    '单据按钮': 'label.el-radio-button.is-active span.el-radio-button__inner',
    '按钮插入位置': 'div.sf_batch_btn_bar',
    '表格元素': 'table'
  };

  Object.entries(tests).forEach(([name, selector]) => {
    const element = shadowRoot.querySelector(selector);
    console.log(`${name}:`, element ? '✅ 存在' : '❌ 不存在');
  });

  // 查找所有菜单项
  const menuItems = shadowRoot.querySelectorAll('li.el-menu-item');
  console.log('菜单项数量:', menuItems.length);
  menuItems.forEach((item, index) => {
    const span = item.querySelector('span');
    console.log(`菜单 ${index}:`, span?.textContent, 'class:', item.className);
  });

  // 查找所有单选按钮
  const radioButtons = shadowRoot.querySelectorAll('.el-radio-button');
  console.log('单选按钮数量:', radioButtons.length);
  radioButtons.forEach((btn, index) => {
    const span = btn.querySelector('span');
    console.log(`单选 ${index}:`, span?.textContent.trim(), 'class:', btn.className);
  });

  // 测试表格访问
  console.log('=== 表格结构测试 ===');
  const table = shadowRoot.querySelector('table');
  if (table) {
    console.log('✅ 找到表格元素');

    // 检查是否有 tbody
    const tbody = table.querySelector('tbody');
    console.log('tbody 存在:', tbody ? '✅ 是' : '❌ 否');

    // 获取行数据
    let rows = tbody ? tbody.querySelectorAll('tr') : table.querySelectorAll('tr');
    console.log(`表格行数: ${rows.length}`);

    if (rows.length > 0) {
      // 分析前几行的结构
      const sampleSize = Math.min(3, rows.length);
      console.log(`=== 分析前 ${sampleSize} 行结构 ===`);

      for (let i = 0; i < sampleSize; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll('td');
        console.log(`行 ${i}: 单元格数量: ${cells.length}`);

        if (cells.length > 0) {
          // 显示所有单元格的 class
          const cellClasses = Array.from(cells).map(td => td.className).join(', ');
          console.log(`  单元格 class: ${cellClasses}`);

          // 查找关键列
          const col86 = row.querySelector('td.col_86');
          const col88 = row.querySelector('td.col_88');
          const col71 = row.querySelector('td.col_71');

          console.log(`  col_86 (采购运费): ${col86 ? '✅' : '❌'}`, col86 ? col86.textContent?.trim() : '');
          console.log(`  col_88 (采购量): ${col88 ? '✅' : '❌'}`, col88 ? col88.textContent?.trim() : '');
          console.log(`  col_71 (单据号): ${col71 ? '✅' : '❌'}`, col71 ? col71.textContent?.trim() : '');
        }
      }

      // 检查是否有包含所需列的行
      let validRows = 0;
      rows.forEach((row, index) => {
        const col86 = row.querySelector('td.col_86');
        const col88 = row.querySelector('td.col_88');
        const col71 = row.querySelector('td.col_71');

        if (col66 && col68 && col51) {
          validRows++;
        }
      });

      console.log(`包含所有必需列的行数: ${validRows}`);
    }
  } else {
    console.log('❌ 未找到表格元素');

    // 尝试其他可能的表格选择器
    console.log('尝试其他表格选择器...');
    const alternatives = [
      'div[class*="table"]',
      'div[class*="grid"]',
      '[class*="vxe-table"]'
    ];

    alternatives.forEach(selector => {
      const elements = shadowRoot.querySelectorAll(selector);
      console.log(`${selector}: 找到 ${elements.length} 个元素`);
    });
  }
};

// 测试动态colid获取的专用函数
window.testColumnIds = function() {
  console.log('=== 测试动态colid获取 ===');
  const columnIds = sellFoxPlugin.getColumnIds();
  console.log('colid获取结果:', columnIds);

  if (columnIds) {
    console.log('运费colid:', columnIds.shipping);
    console.log('采购量colid:', columnIds.quantity);
    console.log('采购单号colid:', columnIds.orderNumber);
    console.log('1688订单号colid:', columnIds.order1688);
  } else {
    console.log('❌ colid获取失败');
  }
};

console.log('[SellFox Plugin] 已加载（调试入口：sellFoxPluginDebug / forceInjectPurchaseButton / forceAnalyzeShipping / testShadowDOM / testColumnIds）');
