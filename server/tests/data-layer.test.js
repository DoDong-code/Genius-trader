const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fund-data-test-'));
process.env.FUND_DB_PATH = path.join(temporaryDirectory, 'test.sqlite');

const { getDatabase, closeDatabase } = require('../database/db');
const { estimateFund, estimatePortfolio, upsertPosition } = require('../services/estimateService');
const { getHistory } = require('../services/navService');
const { parseFundScript, parseFundProfile } = require('../services/fundService');
const {
  parseEstimate,
  parseHistoryPayload,
  parseHoldings,
  stockSecId
} = require('../services/marketService');
const { createServer } = require('../index');

function seedDatabase() {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO fund (fund_code, fund_name, fund_type, company)
    VALUES (?, ?, ?, ?)
  `).run('019633', '测试基金C', '指数型-股票', '测试基金公司');
  const insertNav = db.prepare(`
    INSERT INTO fund_nav (fund_code, date, nav, acc_nav)
    VALUES (?, ?, ?, ?)
  `);
  insertNav.run('019633', '2026-07-29', 1, 1);
  insertNav.run('019633', '2026-07-30', 1.1, 1.1);
  upsertPosition({
    account_id: 'account2',
    fund_code: '019633',
    shares: 1000,
    cost: 9000,
    amount: 10000
  });
}

seedDatabase();

test('creates the five requested SQLite tables', () => {
  const tables = getDatabase().prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
  `).all().map(row => row.name);
  ['fund', 'fund_nav', 'fund_holdings', 'stock_price', 'portfolio']
    .forEach(name => assert.ok(tables.includes(name), `${name} should exist`));
});

test('parses official-style Eastmoney JavaScript data without eval', () => {
  const parsed = parseFundScript('019633', `
    var fS_name = "国泰半导体设备ETF联接C";
    var fS_code = "019633";
    var Data_netWorthTrend = [
      {"x":1785254400000,"y":2.5,"equityReturn":1.2,"unitMoney":""}
    ];
    var Data_ACWorthTrend = [[1785254400000,2.6]];
  `);
  assert.equal(parsed.fundName, '国泰半导体设备ETF联接C');
  assert.equal(parsed.history.length, 1);
  assert.equal(parsed.history[0].nav, 2.5);
  assert.equal(parsed.history[0].accNav, 2.6);
});

test('parses the latest NAV fallback from the official fund page', () => {
  const profile = parseFundProfile(`
    类型：<a href="#">指数型-股票</a>
    <span class="letterSpace01">管 理 人</span>：<a href="#">国泰基金</a>
    <span class="sp01"><a href="#">单位净值</a></span> (</span>2026-07-30)</p></dt>
    <dd class="dataNums"><span class="ui-num">2.6005</span><span class="ui-num">-6.70%</span></dd>
    <span class="sp01"><a href="#">累计净值</a></span></span></p></dt>
    <dd class="dataNums"><span class="ui-num">2.6005</span></dd>
  `);
  assert.equal(profile.fundType, '指数型-股票');
  assert.equal(profile.company, '国泰基金');
  assert.equal(profile.latestNav.date, '2026-07-30');
  assert.equal(profile.latestNav.nav, 2.6005);
  assert.equal(profile.latestNav.changePercent, -0.067);
});

test('parses realtime estimate, NAV history and public holdings responses', () => {
  const estimate = parseEstimate('jsonpgz({"fundcode":"019633","name":"测试基金","jzrq":"2026-07-30","dwjz":"2.6005","gsz":"2.6100","gszzl":"0.37","gztime":"2026-07-31 14:40"});');
  assert.equal(estimate.fund_code, '019633');
  assert.equal(estimate.estimate_change, 0.0037);

  const history = parseHistoryPayload(JSON.stringify({
    TotalCount: 1,
    PageCount: 1,
    Data: {
      LSJZList: [{
        FSRQ: '2026-07-30',
        DWJZ: '2.6005',
        LJJZ: '2.7005',
        JZZZL: '-6.70'
      }]
    }
  }));
  assert.equal(history.history[0].nav, 2.6005);
  assert.equal(history.history[0].accNav, 2.7005);
  assert.equal(history.history[0].changePercent, -0.067);

  const holdings = parseHoldings(`var apidata={ content:"<label>截止至：<font>2026-06-30</font></label><table><tbody><tr><td>1</td><td>600000</td><td>浦发银行</td><td>10.00</td><td>+1.00%</td><td>资讯</td><td>5.25%</td><td>100</td><td>1000</td></tr></tbody></table>",arryear:[2026],curyear:2026};`);
  assert.equal(holdings.length, 1);
  assert.equal(holdings[0].stock_name, '浦发银行');
  assert.equal(holdings[0].weight, 0.0525);
  assert.equal(holdings[0].report_date, '2026-06-30');
  assert.equal(stockSecId('600000'), '1.600000');
  assert.equal(stockSecId('00522'), '116.00522');
});

test('returns chronological history and calculates estimates', () => {
  const history = getHistory('019633');
  assert.deepEqual(history.map(item => item.date), ['2026-07-29', '2026-07-30']);
  const fundEstimate = estimateFund('019633', 10000);
  assert.equal(fundEstimate.today_change, 0.1);
  assert.equal(fundEstimate.estimate_profit, 1000);
  const accountEstimate = estimatePortfolio('account2');
  assert.equal(accountEstimate.total_asset, 10000);
  assert.equal(accountEstimate.today_estimate_profit, 1000);
  assert.equal(accountEstimate.cumulative_profit, 1000);
});

test('serves health, fund, history and portfolio estimate APIs', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const health = await fetch(`http://127.0.0.1:${port}/api/health`).then(response => response.json());
    assert.equal(health.success, true);

    const fund = await fetch(`http://127.0.0.1:${port}/api/fund/019633`).then(response => response.json());
    assert.equal(fund.fund.fund_name, '测试基金C');
    assert.equal(fund.history.length, 2);

    const history = await fetch(`http://127.0.0.1:${port}/api/fund/019633/history`).then(response => response.json());
    assert.equal(history.records, 2);

    const estimate = await fetch(`http://127.0.0.1:${port}/api/portfolio/account2/estimate`).then(response => response.json());
    assert.equal(estimate.today_estimate_profit, 1000);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test.after(() => {
  closeDatabase();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});
