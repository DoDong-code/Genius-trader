(function () {
  'use strict';

  var API_BASE = window.FUND_API_BASE || 'http://localhost:3003';
  var active = 0;
  var MAX_CONCURRENT = 3;
  var queue = [];

  function formatMoney(value) {
    var amount = Number(value) || 0;
    var sign = amount < 0 ? '−' : amount > 0 ? '+' : '';
    return sign + '¥' + Math.abs(amount).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatPercent(value) {
    var rate = (Number(value) || 0) * 100;
    return (rate > 0 ? '+' : '') + rate.toFixed(2) + '%';
  }

  function marketClass(value) {
    return value > 0 ? 'market-up' : value < 0 ? 'market-down' : 'market-flat';
  }

  function currentFund(code) {
    var state = window.portfolioState;
    if (!state || !state.accounts || typeof state.getActive !== 'function') return null;
    var account = state.accounts[state.getActive()];
    return account && Array.isArray(account.funds)
      ? account.funds.find(function (fund) { return fund.code === code; })
      : null;
  }

  function updateTodayCell(row, change, profit) {
    var cell = row.querySelector('.fund-today') || row.children[2];
    if (!cell) return;
    delete cell.dataset.estimateUnavailable;
    cell.innerHTML = '<strong>' + formatMoney(profit) + '</strong><span>' + formatPercent(change) + '</span>';
    cell.classList.remove('market-up', 'market-down', 'market-flat');
    cell.classList.add(marketClass(change));
  }

  function showEstimateUnavailable(row) {
    var cell = row.querySelector('.fund-today') || row.children[2];
    if (!cell) return;
    cell.dataset.estimateUnavailable = 'true';
    cell.innerHTML = '<strong>—</strong><span>待估值</span>';
    cell.classList.remove('market-up', 'market-down');
    cell.classList.add('market-flat');
  }

  function markNavUpdated(row, date) {
    var meta = row.querySelector('.fund-info small');
    if (!meta || meta.querySelector('.nav-updated-badge')) return;
    var badge = document.createElement('span');
    badge.className = 'nav-updated-badge';
    badge.textContent = '已更新';
    badge.title = date ? '净值更新至 ' + date : '净值已更新';
    meta.insertBefore(badge, meta.firstChild);
  }

  function clearNavUpdated(row) {
    var badge = row.querySelector('.nav-updated-badge');
    if (badge) badge.remove();
  }

  function shanghaiDate() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
  }

  function requestJson(url, options) {
    return fetch(url, options).then(function (response) {
      if (!response.ok) {
        var error = new Error('HTTP ' + response.status);
        error.status = response.status;
        throw error;
      }
      return response.json();
    });
  }

  function refreshFund(code) {
    var endpoint = API_BASE + '/api/fund/' + encodeURIComponent(code) + '?refresh=1';
    return requestJson(endpoint).catch(function (error) {
      if (error.status !== 404) throw error;
      return requestJson(API_BASE + '/api/fund/import/' + encodeURIComponent(code))
        .then(function () { return requestJson(endpoint); });
    });
  }

  function estimateFund(code, amount) {
    return requestJson(
      API_BASE + '/api/fund/' + encodeURIComponent(code) + '/estimate?amount=' + encodeURIComponent(amount)
    );
  }

  function officialNavChange(snapshot, navDate) {
    var history = Array.isArray(snapshot && snapshot.history) ? snapshot.history.slice() : [];
    var records = history
      .filter(function (item) { return item && item.date && Number.isFinite(Number(item.nav)); })
      .sort(function (left, right) { return String(left.date).localeCompare(String(right.date)); });
    var currentIndex = records.findIndex(function (item) { return item.date === navDate; });
    if (currentIndex <= 0) return null;
    var current = Number(records[currentIndex].nav);
    var previous = Number(records[currentIndex - 1].nav);
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
    return current / previous - 1;
  }

  function runTask(task) {
    active += 1;
    task().finally(function () {
      active -= 1;
      drain();
    });
  }

  function drain() {
    while (active < MAX_CONCURRENT && queue.length) runTask(queue.shift());
  }

  function enqueue(task) {
    queue.push(task);
    drain();
  }

  function hydrateRow(row) {
    if (!row || row.dataset.estimateState === 'loading' || row.dataset.estimateState === 'ready' || row.dataset.estimateState === 'unavailable') return;
    var code = row.dataset.code;
    var fund = currentFund(code);
    if (!code || !fund) return;
    row.dataset.estimateState = 'loading';

    enqueue(function () {
      return Promise.allSettled([refreshFund(code), estimateFund(code, fund.amount)]).then(function (results) {
        if (!row.isConnected) return;
        var snapshot = results[0].status === 'fulfilled' ? results[0].value || {} : {};
        var navDate = snapshot.latest_nav && snapshot.latest_nav.date;
        if (!navDate && snapshot.fund && snapshot.fund.latest_nav) navDate = snapshot.fund.latest_nav.date;
        var officialUpdated = navDate === shanghaiDate();
        if (officialUpdated) {
          fund.navUpdatedAt = navDate;
          markNavUpdated(row, navDate);
        } else {
          delete fund.navUpdatedAt;
          clearNavUpdated(row);
        }

        var payload = results[1].status === 'fulfilled' ? results[1].value || {} : {};
        var estimate = payload.estimate || payload;
        var manualDate = fund.manualEstimateDate;
        var hasManualEstimate = manualDate === shanghaiDate() && Number.isFinite(Number(fund.manualToday));
        var manualUnavailable = manualDate === shanghaiDate() && fund.manualEstimateUnavailable === true;
        var change = officialUpdated ? officialNavChange(snapshot, navDate) : (hasManualEstimate ? Number(fund.manualToday) : Number(estimate.estimate_change));
        // When the official NAV has not yet arrived, use the public intraday
        // estimate returned with the refreshed fund snapshot as a safe fallback.
        if (!officialUpdated && !Number.isFinite(change)) {
          change = Number(snapshot.estimate && snapshot.estimate.estimate_change);
        }
        if (manualUnavailable && !officialUpdated) {
          delete fund.today;
          delete fund.todayEstimate;
          showEstimateUnavailable(row);
          row.dataset.estimateState = 'unavailable';
          if (typeof window.savePortfolioState === 'function') window.savePortfolioState();
          return;
        }
        if (!Number.isFinite(change)) {
          delete fund.today;
          delete fund.todayEstimate;
          delete fund.estimateConfidence;
          showEstimateUnavailable(row);
          row.dataset.estimateState = 'unavailable';
          if (typeof window.savePortfolioState === 'function') window.savePortfolioState();
          window.dispatchEvent(new CustomEvent('fund-estimate-updated', { detail: { code: code, unavailable: true } }));
          return;
        }
        var profit = officialUpdated ? NaN : (hasManualEstimate ? (Number(fund.amount) || 0) * change : Number(estimate.estimate_profit));
        if (!Number.isFinite(profit)) profit = (Number(fund.amount) || 0) * change;

        fund.today = change;
        fund.todayEstimate = profit;
        fund.estimateConfidence = estimate.confidence || null;
        updateTodayCell(row, change, profit);

        row.dataset.estimateState = 'ready';
        if (typeof window.savePortfolioState === 'function') window.savePortfolioState();
        window.dispatchEvent(new CustomEvent('fund-estimate-updated', { detail: { code: code } }));
      }).catch(function () {
        if (row.isConnected) row.dataset.estimateState = 'error';
      });
    });
  }

  function scan() {
    document.querySelectorAll('#view-root .fund-row[data-code]').forEach(hydrateRow);
  }

  var observer = new MutationObserver(function () { window.requestAnimationFrame(scan); });
  observer.observe(document.getElementById('view-root') || document.body, { childList: true, subtree: true });
  scan();
}());
