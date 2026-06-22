const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbFile = process.env.DB_FILE || path.join(__dirname, '..', '..', 'data', 'budget.sqlite');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const GBP_TO_INR = Number(process.env.EXCHANGE_GBP_TO_INR || 105);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfNextMonth() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1, 1);
  return date.toISOString().slice(0, 10);
}

function convertAmount(amount, fromCurrency, toCurrency) {
  const value = Number(amount || 0);
  if (fromCurrency === toCurrency) return value;
  if (fromCurrency === 'GBP' && toCurrency === 'INR') return value * GBP_TO_INR;
  if (fromCurrency === 'INR' && toCurrency === 'GBP') return value / GBP_TO_INR;
  return value;
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount >= 0),
      date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount >= 0),
      date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      original_amount REAL NOT NULL CHECK(original_amount >= 0),
      remaining_amount REAL NOT NULL CHECK(remaining_amount >= 0),
      currency TEXT NOT NULL CHECK(currency IN ('GBP', 'INR')),
      emi_amount REAL NOT NULL CHECK(emi_amount >= 0),
      emi_currency TEXT NOT NULL CHECK(emi_currency IN ('GBP', 'INR')),
      interest_rate REAL DEFAULT 0,
      due_date TEXT,
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'paid')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loan_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL,
      amount REAL NOT NULL CHECK(amount >= 0),
      currency TEXT NOT NULL CHECK(currency IN ('GBP', 'INR')),
      converted_amount REAL NOT NULL CHECK(converted_amount >= 0),
      converted_currency TEXT NOT NULL CHECK(converted_currency IN ('GBP', 'INR')),
      payment_date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS budget_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL UNIQUE,
      monthly_limit REAL NOT NULL CHECK(monthly_limit >= 0),
      currency TEXT NOT NULL DEFAULT 'GBP' CHECK(currency IN ('GBP', 'INR')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      current_amount REAL NOT NULL CHECK(current_amount >= 0),
      target_amount REAL NOT NULL CHECK(target_amount >= 0),
      currency TEXT NOT NULL DEFAULT 'GBP' CHECK(currency IN ('GBP', 'INR')),
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedDatabase();
}

function seedDatabase() {
  const seedDate = today();
  const expenseRows = [
    ['Rent', 350],
    ['Electricity/Gas', 50],
    ['Internet', 10],
    ['Groceries', 180],
    ['Transport', 50],
    ['Entertainment', 40],
    ['Eating Out', 100],
    ['Shopping', 50]
  ];

  const seed = db.transaction(() => {
    if (db.prepare('SELECT COUNT(*) AS count FROM income').get().count === 0) {
      db.prepare(`
        INSERT INTO income (source, amount, date, notes)
        VALUES (?, ?, ?, ?)
      `).run('Salary', 1700, seedDate, 'Default monthly salary');
    }

    if (db.prepare('SELECT COUNT(*) AS count FROM expenses').get().count === 0) {
      const insertExpense = db.prepare(`
        INSERT INTO expenses (category, amount, date, notes)
        VALUES (?, ?, ?, ?)
      `);
      for (const [category, amount] of expenseRows) {
        insertExpense.run(category, amount, seedDate, 'Seeded monthly value');
      }
    }

    if (db.prepare('SELECT COUNT(*) AS count FROM budget_categories').get().count === 0) {
      const insertBudget = db.prepare(`
        INSERT INTO budget_categories (category, monthly_limit, currency)
        VALUES (?, ?, 'GBP')
      `);
      for (const [category, amount] of expenseRows) {
        insertBudget.run(category, amount);
      }
      insertBudget.run('Other', 100);
    }

    if (db.prepare('SELECT COUNT(*) AS count FROM loans').get().count === 0) {
      db.prepare(`
        INSERT INTO loans (
          name, original_amount, remaining_amount, currency, emi_amount, emi_currency,
          interest_rate, due_date, notes, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'Indian Debt',
        3500000,
        3500000,
        'INR',
        650,
        'GBP',
        0,
        firstDayOfNextMonth(),
        'Default debt balance and EMI',
        'active'
      );
    }

    if (db.prepare('SELECT COUNT(*) AS count FROM savings_goals').get().count === 0) {
      db.prepare(`
        INSERT INTO savings_goals (name, current_amount, target_amount, currency, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run('Emergency Fund', 500, 3000, 'GBP', 'Default emergency fund goal');
    }
  });

  seed();
}

module.exports = {
  db,
  GBP_TO_INR,
  convertAmount,
  initializeDatabase
};
