# Genius trader Portfolio

当前项目包含两个彼此隔离的部分：

- 前端预览：现有 Apple 风格 Portfolio，继续运行在 `http://localhost:3001`
- 基金数据服务：SQLite + 天天基金公开数据采集，运行在 `http://localhost:3002`

本阶段只新增后台数据能力，没有让前端调用新 API，也没有删除前端 Mock 数据。

## 环境要求

- Node.js 24 或更高版本
- pnpm

数据层使用 Node.js 内置 SQLite，不需要安装第三方运行依赖。

## 启动

启动现有前端：

```bash
pnpm dev
```

启动基金数据 API：

```bash
pnpm server
```

默认数据库文件：

```text
server/data/portfolio.sqlite
```

可通过环境变量修改：

```bash
FUND_DB_PATH=/path/to/portfolio.sqlite pnpm server
```

API 端口默认为 `3002`，可通过 `FUND_API_PORT` 修改。

## 导入基金

单只基金导入：

```text
GET http://localhost:3002/api/fund/import/019633
```

强制忽略当日缓存：

```text
GET http://localhost:3002/api/fund/import/019633?force=1
```

导入五只预设测试基金并建立 `account2` 测试持仓：

```bash
pnpm fund:seed
```

预设代码：

- `019633`
- `022184`
- `000961`
- `004253`
- `012349`

基金名称以天天基金当前公开页面返回结果为准。

## 同步历史净值

同步数据库中已经存在的全部基金：

```bash
pnpm fund:sync
```

强制重新拉取：

```bash
pnpm fund:sync -- --force
```

同步规则：

- `fund_code + date` 唯一，重复日期执行更新而不是重复插入
- 历史净值每天最多请求一次，缓存保存在 `server/data/cache`
- 网络失败自动重试三次
- 命令行输出每只基金的新增记录数、总记录数、缓存状态和耗时

## API

### 健康检查

```text
GET /api/health
```

### 已导入基金

```text
GET /api/funds
```

### 导入基金

```text
GET /api/fund/import/:code
```

### 基金资料、最新净值与全部历史净值

```text
GET /api/fund/:code
```

### 历史净值

```text
GET /api/fund/:code/history
GET /api/fund/:code/history?limit=365
```

### 账户估值

```text
GET /api/portfolio/:accountId/estimate
```

返回总资产、今日估算收益、累计收益和逐基金明细。今日涨跌幅使用最新两个净值交易日计算：

```text
今日估算收益 = 持仓金额 × 今日涨跌幅
```

## 数据库

SQLite 包含以下核心表：

- `fund`：基金基础信息
- `fund_nav`：历史单位净值与累计净值
- `fund_holdings`：基金股票持仓
- `stock_price`：股票行情
- `portfolio`：用户基金持仓

数据库启用了外键、WAL、唯一约束和必要索引。

## 验证

```bash
pnpm test
pnpm build
```

`pnpm build` 不打包或修改现有静态页面，只检查前后端 JavaScript、必需文件和数据库初始化。
