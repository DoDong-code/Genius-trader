const fs = require('node:fs');
const path = require('node:path');

const holidayFile = path.join(__dirname, '..', 'data', 'market-holidays.json');

function shanghaiDate(value = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function normalizeDate(value) {
  const match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function loadHolidays() {
  try {
    const data = JSON.parse(fs.readFileSync(holidayFile, 'utf8'));
    return new Set(Array.isArray(data) ? data : data.holidays || []);
  } catch {
    return new Set();
  }
}

function shiftDate(date, days) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

function isTradingDay(value) {
  const date = normalizeDate(value);
  if (!date) return false;
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !loadHolidays().has(date);
}

function latestTradingDate(value = shanghaiDate()) {
  let date = normalizeDate(value) || shanghaiDate();
  while (!isTradingDay(date)) date = shiftDate(date, -1);
  return date;
}

function getMarketContext(value = shanghaiDate()) {
  const requestedDate = normalizeDate(value) || shanghaiDate();
  const dataDate = latestTradingDate(requestedDate);
  const isTrading = dataDate === requestedDate;
  return {
    requested_date: requestedDate,
    data_date: dataDate,
    is_trading_day: isTrading,
    notice: isTrading ? null : '非交易日，展示最近交易日数据'
  };
}

module.exports = {
  shanghaiDate,
  isTradingDay,
  latestTradingDate,
  getMarketContext
};
