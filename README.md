# Genius trader

当前项目由两个互相隔离的部分组成：

- Portfolio 前端预览：`http://localhost:3001`
- 基金数据与估值 API：`http://localhost:3002`

本次新增内容只位于数据层、API 和预留 hooks，未修改现有 UI。

## 启动

```bash
pnpm dev
pnpm server
```

默认 SQLite 数据库：`server/data/portfolio.sqlite`。

## 数据来源

- 基金基础信息与完整净值：天天基金基金页和 `pingzhongdata`
- 历史净值：东方财富 `f10/lsjz`
- 实时基金公开估值：`fundgz.1234567.com.cn`
- 十大持仓：东方财富基金档案 `FundArchivesDatas.aspx`
- 股票与板块行情：东方财富 `push2`，网络不兼容时自动切换 `push2delay`

## 数据库

- `fund`：基金代码、名称、类型、公司
- `fund_nav`：日期、单位净值、累计净值
- `fund_holdings`：季度十大持仓、权重、报告日期
- `stock_price`：交易日股票或 ETF 行情及更新时间
- `portfolio`：账户基金持仓、成本和金额
- `fund_estimate`：当日自算估值快照、可信度和计算明细
- `data_sync_state`：各类数据的同步时间和过期时间

缓存策略：

- 历史净值：24 小时
- 基金持仓：90 天
- 股票与板块行情：5 分钟
- 基金估值结果：5 分钟

`fund_code + date`、`fund_code + stock_code + report_date` 等字段有唯一约束，重复同步会更新原记录，不会重复插入。

## 自算估值公式

十大持仓行情先按基金公布权重计算，并按已取得行情的持仓权重归一化：

```text
持仓信号 = Σ(股票涨跌幅 × 持仓权重) / 已取得行情的持仓权重合计
```

有板块行情时：

```text
基金估算涨幅 = 持仓信号 × 70% + 板块指数涨跌幅 × 30% - 现金误差修正
今日估算收益 = 持有金额 × 基金估算涨幅
```

70% / 30%、现金误差和板块映射可在 `server/config/estimateConfig.js` 调整。

当十大持仓或行情不足时按以下顺序降级：持仓信号 → 板块行情 → 公开基金估值，并返回 `high`、`medium` 或 `low` 可信度及 `fallback` 原因，不会把降级结果伪装成高可信自算结果。

## API

### 导入与同步

```text
GET /api/fund/import/:code
GET /api/fund/import/:code?force=1
GET /api/funds
```

```bash
pnpm fund:sync
pnpm fund:sync -- --force
pnpm fund:seed
```

### 基金资料

```text
GET /api/fund/:code
GET /api/fund/:code/history
GET /api/fund/:code/history?limit=365
GET /api/stock/:code
```

### 基金自算估值

```text
GET /api/fund/:code/estimate
GET /api/fund/:code/estimate?amount=11680
GET /api/fund/:code/estimate?amount=11680&force=1
```

主要返回字段：

```json
{
  "name": "国泰半导体设备ETF联接C",
  "estimate_change": -0.0235,
  "estimate_change_percent": -2.35,
  "amount": 11680,
  "estimate_profit": -274.48,
  "confidence": "medium",
  "quote_coverage": 0.8,
  "benchmark": { "name": "半导体指数参考", "stockCode": "512480" }
}
```

### 账户自算估值

```text
GET /api/account/:accountId/estimate
GET /api/account/:accountId/estimate?force=1
```

返回总金额、今日估算收益、今日估算涨幅、整体可信度和逐基金明细。

旧接口 `GET /api/portfolio/:accountId/estimate` 保留兼容，不影响现有调用。

## 前端连接预留

`hooks/estimateHooks.js` 提供：

- `useFundEstimate(code, options)`
- `usePortfolioEstimate(accountId, options)`

当前页面未加载该文件，因此 UI 和现有 mock 展示保持不变。未来替换数据时再由前端显式引用。

## 测试基金

- `019633` 国泰半导体设备ETF联接C
- `025500` 东方阿尔法科技智选混合发起C
- `022184` 富国全球科技互联网股票(QDII)C
- `008702` 华夏黄金ETF联接C
- `000961` 天弘沪深300ETF联接A

## 验证

```bash
pnpm test
pnpm build
```

`pnpm build` 只执行静态代码、必需文件和数据库初始化检查，不会修改或重新打包现有 UI。
