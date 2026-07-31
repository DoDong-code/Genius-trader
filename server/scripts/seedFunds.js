const { importFund } = require('../services/fundService');
const { upsertPosition } = require('../services/estimateService');
const { closeDatabase } = require('../database/db');

const seedFunds = [
  { code: '019633', amount: 11680 },
  { code: '025500', amount: 0 },
  { code: '022184', amount: 8648 },
  { code: '008702', amount: 0 },
  { code: '000961', amount: 9200 },
  { code: '004253', amount: 12800 },
  { code: '012349', amount: 9126 }
];

async function main() {
  for (const seed of seedFunds) {
    console.log(`[fund:seed] 导入 ${seed.code}`);
    const result = await importFund(seed.code);
    upsertPosition({
      account_id: 'account2',
      fund_code: seed.code,
      shares: 0,
      cost: seed.amount,
      amount: seed.amount
    });
    console.log(
      `[fund:seed] ${seed.code} ${result.fund}，净值 ${result.records} 条，新增 ${result.inserted} 条`
    );
  }
  closeDatabase();
}

main().catch(error => {
  console.error('[fund:seed] 导入失败：', error);
  closeDatabase();
  process.exitCode = 1;
});
