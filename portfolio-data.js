(function () {
  'use strict';

  var CORRECTION_VERSION = '20260731-account2-corrected-v2';
  var TARGET_DATE = '2026-07-31';
  var LEGACY_CODES = ['015442', '013308', '012910', '010826', '014846', '004919', '007540', '003103', '163819', '009730', '009689'];

  function fund(name, code, category, amount, holdingProfit, holdingRate, today, notes) {
    var hasEstimate = Number.isFinite(today);
    return {
      name: name,
      code: code,
      category: category,
      amount: amount,
      holdingProfit: holdingProfit,
      holdingRate: holdingRate,
      hold: holdingRate,
      today: hasEstimate ? today : null,
      todayEstimate: hasEstimate ? amount * today : null,
      manualToday: hasEstimate ? today : null,
      manualEstimateDate: TARGET_DATE,
      manualEstimateUnavailable: today === null,
      notes: notes || [],
      holdings: [],
      transactionVersion: 2,
      transactions: []
    };
  }

  function correctedFunds() {
    return [
      fund('浦银安盛全球智能科技股票C', '014002', '权益类', 5461.91, -514.28, -0.0861, 0.1365, ['全球智能科技方向', '高弹性科技仓']),
      fund('富国全球科技互联网股票(QDII)C', '022184', '权益类', 19746.16, -3042.81, -0.1323, 0.1091, ['全球科技核心仓']),
      fund('安信新回报灵活配置混合C', '002771', '权益类', 451.03, -148.97, -0.2483, 0.0440, ['小仓观察']),
      fund('前海开源金银珠宝混合C', '002207', '权益类', 4179.49, -1550.47, -0.2706, 0.0283, ['资源/黄金矿业方向', '与黄金仓存在一定重复']),
      fund('国泰半导体设备ETF联接C', '019633', '权益类', 2732.45, -567.50, -0.1720, 0.0209, ['半导体设备、材料方向', '熊市反弹观察仓']),
      fund('易方达沪深300ETF联接C', '007339', '权益类', 6880.96, -120.08, -0.0172, 0.0085, ['核心宽基', '替代银行仓']),
      fund('国泰黄金ETF联接C', '004253', '黄金', 25126.02, -4636.61, -0.1558, 0.0048, ['防守仓']),
      fund('易方达恒生科技ETF联接C', '013309', '权益类', 12757.41, -3153.07, -0.1982, 0.0047, ['港股科技']),
      fund('大成产业趋势混合C', '010827', '权益类', 10181.96, -3153.41, -0.2365, null, ['产业趋势方向', '后续优化观察']),
      fund('浦银安盛数字经济混合C', '025422', '权益类', 436.64, -163.37, -0.2723, null, ['CPO/数字经济方向', '极小仓观察']),
      fund('博时恒乐债券C', '014847', '债券类', 14260.77, -213.90, -0.0148, undefined, []),
      fund('兴全稳泰债券C', '008173', '债券类', 73106.86, 11.96, 0.0002, undefined, []),
      fund('华泰保兴安悦债券C', '020741', '债券类', 27299.22, 726.23, 0.0273, undefined, []),
      fund('长盛盛裕纯债债券D', '015736', '债券类', 10074.93, 155.85, 0.0157, undefined, []),
      fund('中银纯债债券C', '380006', '债券类', 81181.44, 846.69, 0.0105, undefined, []),
      fund('中信保诚稳悦债券C', '004103', '债券类', 46289.31, 153.83, 0.0033, undefined, []),
      fund('易方达瑞锦灵活配置混合C', '009690', '债券类', 44802.01, -91.87, -0.0020, undefined, [])
    ];
  }

  function isTargetAccount(account) {
    if (!account || !Array.isArray(account.funds)) return false;
    var codes = account.funds.map(function (item) { return item && item.code; });
    return account.funds.length >= 10 && (codes.indexOf('022184') !== -1 || LEGACY_CODES.some(function (code) { return codes.indexOf(code) !== -1; }));
  }

  function applyCorrection(accounts) {
    if (!accounts || typeof accounts !== 'object') return false;
    var changed = false;
    Object.keys(accounts).forEach(function (name) {
      var account = accounts[name];
      if (!isTargetAccount(account) || account.portfolioDataVersion === CORRECTION_VERSION) return;
      account.funds = correctedFunds();
      account.snapshotDate = '2026-07-30';
      account.portfolioDataVersion = CORRECTION_VERSION;
      account.closedPositions = [{ name: '天弘中证银行ETF联接C', code: '001595', closedBefore: '2026-07-30', reason: ['连涨一个月', '持仓收益约+5%', '与沪深300存在重叠', '精简组合'] }];
      account.strategy = ['降低重复持仓', '银行已退出，沪深300作为核心宽基', '科技成长长期看好但控制仓位', '半导体观察并维持低仓位', '黄金作为防守资产', '债券作为组合稳定器'];
      changed = true;
    });
    return changed;
  }

  window.applyAccount2PortfolioCorrection = applyCorrection;
  var state = window.portfolioState;
  if (state && state.accounts) applyCorrection(state.accounts);
}());
