(function () {
  const apiBase = 'http://localhost:3002';
  const root = document.querySelector('#view-root');
  if (!root || !window.portfolioState) return;

  function migrateFundCodes() {
    let changed = false;
    Object.values(window.portfolioState.accounts).forEach(account => {
      (account.funds || []).forEach(fund => {
        if (fund.name?.includes('富国全球科技互联网') && fund.code !== '022184') {
          fund.code = '022184';
          changed = true;
        }
        if (fund.name?.includes('易方达恒生科技') && fund.code !== '013309') {
          fund.code = '013309';
          fund.name = '易方达恒生科技ETF联接(QDII)C';
          changed = true;
        }
      });
    });
    if (changed) window.savePortfolioState?.();
  }

  migrateFundCodes();

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  const money = value => {
    const number = Number(value) || 0;
    const prefix = number < 0 ? '−' : '';
    return `${prefix}¥${Math.abs(number).toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}`;
  };

  const percent = value => {
    const number = Number(value) || 0;
    return `${number > 0 ? '+' : ''}${(number * 100).toFixed(2)}%`;
  };

  const tone = value => Number(value) > 0 ? 'positive' : Number(value) < 0 ? 'negative' : '';
  const historyRanges = [
    { key: '1m', label: '近1月', days: 31 },
    { key: '3m', label: '近3月', days: 93 },
    { key: '6m', label: '近6月', days: 186 },
    { key: '1y', label: '近1年', days: 366 },
    { key: '3y', label: '近3年', days: 1096 }
  ];

  function getFund(code) {
    const account = window.portfolioState.accounts[window.portfolioState.getActive()];
    return account?.funds.find(fund => String(fund.code) === String(code));
  }

  function historyForRange(history, rangeKey) {
    if (!Array.isArray(history) || !history.length) return [];
    const range = historyRanges.find(item => item.key === rangeKey) || historyRanges[3];
    const latestTime = new Date(`${history[history.length - 1].date}T00:00:00`).getTime();
    const cutoff = latestTime - range.days * 86400000;
    const startIndex = history.findIndex(item =>
      new Date(`${item.date}T00:00:00`).getTime() >= cutoff
    );
    return history.slice(Math.max(0, startIndex));
  }

  function rangeReturn(history, rangeKey) {
    const range = historyRanges.find(item => item.key === rangeKey);
    if (!range || history.length < 2) return null;
    const latestTime = new Date(`${history[history.length - 1].date}T00:00:00`).getTime();
    const oldestTime = new Date(`${history[0].date}T00:00:00`).getTime();
    const cutoff = latestTime - range.days * 86400000;
    if (oldestTime > cutoff + 14 * 86400000) return null;
    const period = historyForRange(history, rangeKey);
    const start = Number(period[0]?.nav);
    const end = Number(period[period.length - 1]?.nav);
    return start && Number.isFinite(end) ? (end - start) / start : null;
  }

  function chartMarkup(history, rangeLabel = '近1年') {
    if (!Array.isArray(history) || history.length < 2) {
      return '<div class="detail-empty">暂无历史净值数据</div>';
    }

    const width = 520;
    const height = 180;
    const padding = 10;
    const values = history.map(item => Number(item.nav)).filter(Number.isFinite);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const range = maximum - minimum || 1;
    const points = history.map((item, index) => {
      const x = padding + (index / (history.length - 1)) * (width - padding * 2);
      const y = padding + ((maximum - Number(item.nav)) / range) * (height - padding * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    const first = history[0];
    const last = history[history.length - 1];
    const change = first.nav ? (last.nav - first.nav) / first.nav : 0;

    return `
      <div class="detail-chart" aria-label="${escapeHtml(rangeLabel)}历史净值曲线">
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img">
          <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.5"
            vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"></polyline>
        </svg>
      </div>
      <div class="detail-chart-meta">
        <span>${escapeHtml(first.date)}</span>
        <b class="${tone(change)}">${percent(change)}</b>
        <span>${escapeHtml(last.date)}</span>
      </div>`;
  }

  function performanceMarkup(history) {
    const inception = history.length > 1
      ? (Number(history.at(-1).nav) - Number(history[0].nav)) / Number(history[0].nav)
      : null;
    return `<div class="history-performance">
      <div class="history-table-head"><span>时间区间</span><span>涨跌幅</span></div>
      ${historyRanges.map(range => {
        const value = rangeReturn(history, range.key);
        return `<div class="history-performance-row">
          <b>${range.label}</b>
          <strong class="${value == null ? '' : tone(value)}">
            ${value == null ? '—' : percent(value)}
          </strong>
        </div>`;
      }).join('')}
      <div class="history-performance-row">
        <b>成立以来</b>
        <strong class="${inception == null ? '' : tone(inception)}">
          ${inception == null ? '—' : percent(inception)}
        </strong>
      </div>
    </div>`;
  }

  function navHistoryMarkup(history) {
    const rows = history.slice(-30).reverse();
    return `<div class="history-nav">
      <div class="history-nav-row history-table-head">
        <span>日期</span><span>单位净值</span><span>累计净值</span><span>日涨跌幅</span>
      </div>
      ${rows.map((item, reverseIndex) => {
        const index = history.length - 1 - reverseIndex;
        const previous = Number(history[index - 1]?.nav);
        const current = Number(item.nav);
        const dailyChange = previous ? (current - previous) / previous : null;
        return `<div class="history-nav-row">
          <b>${escapeHtml(item.date)}</b>
          <span>${current.toFixed(4)}</span>
          <span>${Number(item.acc_nav ?? item.nav).toFixed(4)}</span>
          <strong class="${dailyChange == null ? '' : tone(dailyChange)}">
            ${dailyChange == null ? '—' : percent(dailyChange)}
          </strong>
        </div>`;
      }).join('')}
    </div>`;
  }

  function activateButton(buttons, activeButton) {
    buttons.forEach(button => {
      const active = button === activeButton;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }

  function setupHistoryExplorer(backdrop, history) {
    const chartContent = backdrop.querySelector('.detail-history-content');
    const chartTitle = backdrop.querySelector('.detail-history-title');
    const rangeButtons = [...backdrop.querySelectorAll('.detail-range-button')];
    const recordButtons = [...backdrop.querySelectorAll('.detail-record-tab')];
    const recordContent = backdrop.querySelector('.detail-record-content');

    const renderRange = button => {
      activateButton(rangeButtons, button);
      const range = historyRanges.find(item => item.key === button.dataset.range) || historyRanges[3];
      chartTitle.textContent = `${range.label}走势`;
      chartContent.classList.remove('content-enter');
      chartContent.innerHTML = chartMarkup(historyForRange(history, range.key), range.label);
      requestAnimationFrame(() => chartContent.classList.add('content-enter'));
    };

    const renderRecord = button => {
      activateButton(recordButtons, button);
      recordContent.classList.remove('content-enter');
      recordContent.innerHTML = button.dataset.record === 'nav'
        ? navHistoryMarkup(history)
        : performanceMarkup(history);
      requestAnimationFrame(() => recordContent.classList.add('content-enter'));
    };

    rangeButtons.forEach(button => button.addEventListener('click', () => renderRange(button)));
    recordButtons.forEach(button => button.addEventListener('click', () => renderRecord(button)));
    renderRange(rangeButtons.find(button => button.dataset.range === '1y') || rangeButtons[0]);
    renderRecord(recordButtons.find(button => button.dataset.record === 'performance') || recordButtons[0]);
  }

  function holdingsMarkup(fund) {
    const holdings = Array.isArray(fund.holdings) ? fund.holdings : [];
    if (!holdings.length) return '<div class="detail-empty">暂无公开持仓数据</div>';
    return `<div class="holding-list">${holdings.map(item => `
      <div>
        <span>${escapeHtml(item.stock_name ?? item[0])}</span>
        <b>${escapeHtml(
          item.weight == null
            ? item[1]
            : `${(Number(item.weight) * (Number(item.weight) <= 1 ? 100 : 1)).toFixed(2)}%`
        )}</b>
      </div>
    `).join('')}</div>`;
  }

  function transactionsMarkup(fund) {
    const transactions = Array.isArray(fund.transactions) ? fund.transactions : [];
    if (!transactions.length) return '<div class="detail-empty">暂无交易记录</div>';
    return `<div class="transaction-list">${transactions.map(item => `
      <div><span>${escapeHtml(item[0])}</span><b>${escapeHtml(item[1])}</b><em>${escapeHtml(item[2])}</em></div>
    `).join('')}</div>`;
  }

  function renderDrawer(fund) {
    const holdingRate = Number.isFinite(fund.holdingRate) ? fund.holdingRate : Number(fund.hold) || 0;
    const holdingProfit = Number.isFinite(fund.holdingProfit)
      ? fund.holdingProfit
      : fund.amount * holdingRate;
    const todayChange = Number(fund.today) || 0;
    const todayProfit = fund.amount * todayChange;

    const backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop real-detail-drawer';
    backdrop.innerHTML = `
      <aside class="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="real-detail-title">
        <button class="drawer-close" aria-label="关闭详情">×</button>
        <div class="drawer-scroll">
          <p class="eyebrow detail-api-type">${escapeHtml(fund.category || '基金')} · 基金详情</p>
          <h2 id="real-detail-title">${escapeHtml(fund.name)}</h2>
          <p class="detail-code">${escapeHtml(fund.code)}</p>

          <div class="detail-values">
            <div><span>当前金额</span><b>${money(fund.amount)}</b></div>
            <div><span>持有收益</span><b class="${tone(holdingRate)}">${percent(holdingRate)}</b></div>
            <div><span>今日估算</span><b class="${tone(todayProfit)}">${money(todayProfit)}</b></div>
            <div><span>今日涨幅</span><b class="${tone(todayChange)}">${percent(todayChange)}</b></div>
          </div>

          <div class="detail-section">
            <div class="detail-section-head">
              <div><p class="eyebrow">历史净值</p><h3 class="detail-history-title">近1年走势</h3></div>
              <span class="detail-api-state">正在读取真实数据…</span>
            </div>
            <div class="detail-history-content"><div class="detail-loading" aria-label="加载历史净值"></div></div>
            <div class="detail-range-tabs" role="tablist" aria-label="净值周期">
              ${historyRanges.map(range => `
                <button class="detail-range-button${range.key === '1y' ? ' active' : ''}"
                  type="button" role="tab" aria-selected="${range.key === '1y'}"
                  data-range="${range.key}">${range.label}</button>
              `).join('')}
            </div>
          </div>

          <div class="detail-section detail-record-section">
            <div class="detail-record-tabs" role="tablist" aria-label="历史数据类型">
              <button class="detail-record-tab active" type="button" role="tab"
                aria-selected="true" data-record="performance">历史业绩</button>
              <button class="detail-record-tab" type="button" role="tab"
                aria-selected="false" data-record="nav">历史净值</button>
            </div>
            <div class="detail-record-content">
              <div class="detail-loading detail-loading-short" aria-label="加载历史业绩"></div>
            </div>
          </div>

          <div class="detail-section">
            <p class="eyebrow">前十大持仓</p>
            <h3>主要持仓</h3>
            <div class="detail-holdings-content">${holdingsMarkup(fund)}</div>
          </div>

          <div class="detail-section">
            <p class="eyebrow">交易记录</p>
            <h3>最近操作</h3>
            ${transactionsMarkup(fund)}
          </div>
        </div>
      </aside>`;

    document.body.appendChild(backdrop);
    document.body.classList.add('drawer-open');
    requestAnimationFrame(() => backdrop.classList.add('visible'));

    const close = () => {
      backdrop.classList.remove('visible');
      document.body.classList.remove('drawer-open');
      setTimeout(() => backdrop.remove(), 180);
    };
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop || event.target.closest('.drawer-close')) close();
    });
    document.addEventListener('keydown', function onEscape(event) {
      if (event.key === 'Escape') {
        document.removeEventListener('keydown', onEscape);
        close();
      }
    });

    loadRealData(fund, backdrop);
  }

  async function requestFund(code) {
    let response = await fetch(`${apiBase}/api/fund/${code}?refresh=1`);
    if (response.status === 404) {
      const imported = await fetch(`${apiBase}/api/fund/import/${code}`);
      if (!imported.ok) throw new Error('基金导入失败');
      response = await fetch(`${apiBase}/api/fund/${code}?refresh=1`);
    }
    if (!response.ok) throw new Error('基金数据读取失败');
    return response.json();
  }

  async function loadRealData(fund, backdrop) {
    const state = backdrop.querySelector('.detail-api-state');
    const historyContent = backdrop.querySelector('.detail-history-content');
    try {
      const payload = await requestFund(fund.code);
      if (!backdrop.isConnected) return;
      const history = payload.history || [];
      setupHistoryExplorer(backdrop, history);
      state.textContent = payload.latest_nav?.date
        ? `更新至 ${payload.latest_nav.date}`
        : `${history.length} 条数据`;

      if (payload.fund?.fund_name) {
        backdrop.querySelector('#real-detail-title').textContent = payload.fund.fund_name;
      }
      const typeParts = [payload.fund?.fund_type, payload.fund?.company].filter(Boolean);
      if (typeParts.length) {
        backdrop.querySelector('.detail-api-type').textContent = `${typeParts.join(' · ')} · 基金详情`;
      }
      backdrop.querySelector('.detail-holdings-content').innerHTML = holdingsMarkup({
        holdings: payload.holdings
      });

      if (payload.estimate?.estimate_change != null || history.length >= 2) {
        const previous = Number(history[history.length - 2].nav);
        const latest = Number(history[history.length - 1].nav);
        const todayChange = payload.estimate?.estimate_change != null
          ? Number(payload.estimate.estimate_change)
          : previous ? (latest - previous) / previous : 0;
        const metricCells = backdrop.querySelectorAll('.detail-values > div');
        const estimate = fund.amount * todayChange;
        metricCells[2].querySelector('b').className = tone(estimate);
        metricCells[2].querySelector('b').textContent = money(estimate);
        metricCells[3].querySelector('b').className = tone(todayChange);
        metricCells[3].querySelector('b').textContent = percent(todayChange);
      }
    } catch {
      if (!backdrop.isConnected) return;
      historyContent.innerHTML = `
        <div class="detail-empty detail-error">
          真实数据服务暂时不可用，请确认数据服务已启动。
        </div>`;
      state.textContent = '读取失败';
    }
  }

  document.addEventListener('click', event => {
    const row = event.target.closest('.fund-row[data-code]');
    if (!row) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const fund = getFund(row.dataset.code);
    if (fund) renderDrawer(fund);
  }, true);
})();
