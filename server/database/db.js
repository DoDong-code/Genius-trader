const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const defaultDatabasePath = path.join(__dirname, '..', 'data', 'portfolio.sqlite');
let database;

function databasePath() {
  return path.resolve(process.env.FUND_DB_PATH || defaultDatabasePath);
}

function initialize(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS fund (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fund_code TEXT NOT NULL UNIQUE,
      fund_name TEXT NOT NULL,
      fund_type TEXT,
      company TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fund_nav (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fund_code TEXT NOT NULL,
      date TEXT NOT NULL,
      nav REAL NOT NULL,
      acc_nav REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (fund_code, date),
      FOREIGN KEY (fund_code) REFERENCES fund(fund_code) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_fund_nav_code_date
      ON fund_nav (fund_code, date DESC);

    CREATE TABLE IF NOT EXISTS fund_holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fund_code TEXT NOT NULL,
      stock_code TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      weight REAL NOT NULL,
      report_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (fund_code, stock_code, report_date),
      FOREIGN KEY (fund_code) REFERENCES fund(fund_code) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stock_price (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_code TEXT NOT NULL,
      date TEXT NOT NULL,
      price REAL NOT NULL,
      change_percent REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (stock_code, date)
    );

    CREATE TABLE IF NOT EXISTS portfolio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      fund_code TEXT NOT NULL,
      shares REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (account_id, fund_code),
      FOREIGN KEY (fund_code) REFERENCES fund(fund_code) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_portfolio_account
      ON portfolio (account_id);
  `);
}

function getDatabase() {
  if (!database) {
    const file = databasePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    database = new DatabaseSync(file);
    initialize(database);
  }
  return database;
}

function transaction(work) {
  const db = getDatabase();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work(db);
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function closeDatabase() {
  if (database) {
    database.close();
    database = undefined;
  }
}

module.exports = {
  getDatabase,
  transaction,
  closeDatabase,
  databasePath
};
