const express = require('express');
const cors = require('cors');
const { db, GBP_TO_INR, convertAmount, initializeDatabase } = require('./database');

initializeDatabase();

const app = express();
const PORT = Number(process.env.PORT || 5001);
const VALID_CURRENCIES = ['GBP', 'INR'];
const VALID_LOAN_STATUSES = ['active', 'paused', 'paid'];
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : undefined;

app.set('trust proxy', 1);
app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));
app.use(express.json());

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function wrap(handler) {
  return (req, res, next) => {
    try {
      handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function requireString(body, field) {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError(400, `${field} is required`);
  }
  return value.trim();
}

function optionalString(body, field) {
  return typeof body[field] === 'string' ? body[field].trim() : '';
}

function optionalDate(body, field) {
  if (body[field] === undefined || body[field] === null || body[field] === '') return '';
  return requireString(body, field);
}

function requireNumber(body, field) {
  const value = Number(body[field]);
  if (!Number.isFinite(value) || value < 0) {
    throw new ApiError(400, `${field} must be a positive number`);
  }
  return value;
}

function requireCurrency(body, field) {
  const value = requireString(body, field).toUpperCase();
  if (!VALID_CURRENCIES.includes(value)) {
    throw new ApiError(400, `${field} must be GBP or INR`);
  }
  return value;
}

function normalizeLoanStatus(status) {
  const value = String(status || 'active').toLowerCase();
  if (!VALID_LOAN_STATUSES.includes(value)) {
    throw new ApiError(400, 'status must be active, paused, or paid');
  }
  return value;
}

function getById(table, id) {
  const record = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!record) throw new ApiError(404, `${table} record not found`);
  return record;
}

function selectedMonth(req) {
  return typeof req.query.month === 'string' && req.query.month.length >= 7
    ? req.query.month.slice(0, 7)
    : new Date().toISOString().slice(0, 7);
}

function monthFilterSql(req) {
  if (typeof req.query.month === 'string' && req.query.month.length >= 7) {
    return {
      clause: 'WHERE substr(date, 1, 7) = ?',
      params: [req.query.month.slice(0, 7)]
    };
  }
  return { clause: '', params: [] };
}

function monthFilterPaymentSql(req) {
  if (typeof req.query.month === 'string' && req.query.month.length >= 7) {
    return {
      clause: 'WHERE substr(payment_date, 1, 7) = ?',
      params: [req.query.month.slice(0, 7)]
    };
  }
  return { clause: '', params: [] };
}

function sumIncome(month) {
  return db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM income
    WHERE substr(date, 1, 7) = ?
  `).get(month).total;
}

function sumExpenses(month) {
  return db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM expenses
    WHERE substr(date, 1, 7) = ?
  `).get(month).total;
}

function getLoans() {
  return db.prepare('SELECT * FROM loans ORDER BY status ASC, due_date ASC, id DESC').all();
}

function debtTotals(loans = getLoans()) {
  const totalOriginalInr = loans.reduce(
    (sum, loan) => sum + convertAmount(loan.original_amount, loan.currency, 'INR'),
    0
  );
  const totalRemainingInr = loans.reduce(
    (sum, loan) => sum + convertAmount(loan.remaining_amount, loan.currency, 'INR'),
    0
  );
  const totalPaidInr = Math.max(totalOriginalInr - totalRemainingInr, 0);
  return {
    totalOriginalInr,
    totalRemainingInr,
    totalPaidInr,
    progressPercentage: totalOriginalInr ? (totalPaidInr / totalOriginalInr) * 100 : 0
  };
}

function totalMonthlyEmi(loans = getLoans()) {
  return loans
    .filter((loan) => loan.status === 'active')
    .reduce((sum, loan) => sum + convertAmount(loan.emi_amount, loan.emi_currency, 'GBP'), 0);
}

function totalMonthlyEmiInr(loans = getLoans()) {
  return loans
    .filter((loan) => loan.status === 'active')
    .reduce((sum, loan) => sum + convertAmount(loan.emi_amount, loan.emi_currency, 'INR'), 0);
}

function expenseBreakdown(month) {
  return db.prepare(`
    SELECT category, COALESCE(SUM(amount), 0) AS total
    FROM expenses
    WHERE substr(date, 1, 7) = ?
    GROUP BY category
    ORDER BY total DESC
  `).all(month);
}

function budgetUsage(month) {
  const actuals = new Map(expenseBreakdown(month).map((row) => [row.category, row.total]));
  return db.prepare('SELECT * FROM budget_categories ORDER BY category ASC').all().map((budget) => {
    const actual = actuals.get(budget.category) || 0;
    const percentage = budget.monthly_limit ? (actual / budget.monthly_limit) * 100 : 0;
    return {
      ...budget,
      actual,
      percentage,
      status: percentage >= 100 ? 'over' : percentage >= 80 ? 'warning' : 'ok'
    };
  });
}

function buildMonthWindow(endMonth, count = 6) {
  const [year, month] = endMonth.split('-').map(Number);
  const endDate = new Date(Date.UTC(year, month - 1, 1));
  const months = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(endDate);
    date.setUTCMonth(date.getUTCMonth() - index);
    months.push(date.toISOString().slice(0, 7));
  }
  return months;
}

function incomeVsExpenses(endMonth) {
  return buildMonthWindow(endMonth, 6).map((month) => ({
    month,
    income: sumIncome(month),
    expenses: sumExpenses(month),
    emi: totalMonthlyEmi()
  }));
}

function debtReduction(endMonth) {
  const months = buildMonthWindow(endMonth, 6);
  const loans = getLoans();
  const totals = debtTotals(loans);
  const payments = db.prepare(`
    SELECT payment_date, converted_amount, converted_currency
    FROM loan_payments
    ORDER BY payment_date ASC
  `).all();

  return months.map((month, index) => {
    const paidThroughMonth = payments
      .filter((payment) => payment.payment_date.slice(0, 7) <= month)
      .reduce(
        (sum, payment) => sum + convertAmount(payment.converted_amount, payment.converted_currency, 'INR'),
        0
      );

    const isLastPoint = index === months.length - 1;
    const remaining = isLastPoint
      ? totals.totalRemainingInr
      : Math.max(totals.totalOriginalInr - paidThroughMonth, 0);
    const paid = isLastPoint
      ? totals.totalPaidInr
      : Math.min(paidThroughMonth, totals.totalOriginalInr);

    return { month, paid, remaining };
  });
}

function savingsGoal() {
  return db.prepare('SELECT * FROM savings_goals ORDER BY id ASC LIMIT 1').get() || null;
}

function dashboardData(month) {
  const loans = getLoans();
  const totals = debtTotals(loans);
  const incomeTotal = sumIncome(month);
  const expenseTotal = sumExpenses(month);
  const emiTotal = totalMonthlyEmi(loans);
  const goal = savingsGoal();

  return {
    month,
    exchangeRate: GBP_TO_INR,
    totals: {
      income: incomeTotal,
      expenses: expenseTotal,
      emi: emiTotal,
      remainingBalance: incomeTotal - expenseTotal - emiTotal,
      savings: goal ? goal.current_amount : 0,
      savingsTarget: goal ? goal.target_amount : 0,
      totalDebtRemainingInr: totals.totalRemainingInr,
      totalDebtOriginalInr: totals.totalOriginalInr,
      totalDebtPaidInr: totals.totalPaidInr,
      debtProgressPercentage: totals.progressPercentage
    },
    charts: {
      expensesByCategory: expenseBreakdown(month),
      debtReduction: debtReduction(month)
    },
    budgetUsage: budgetUsage(month),
    savingsGoal: goal
  };
}

function reportsData(month) {
  return {
    month,
    monthlyExpenseSummary: {
      total: sumExpenses(month),
      transactionCount: db.prepare(`
        SELECT COUNT(*) AS count
        FROM expenses
        WHERE substr(date, 1, 7) = ?
      `).get(month).count
    },
    expenseBreakdown: expenseBreakdown(month),
    incomeVsExpenses: incomeVsExpenses(month),
    debtReduction: debtReduction(month),
    savingsGoal: savingsGoal(),
    budgetUsage: budgetUsage(month)
  };
}

function scenarioEstimate(extraPayment, currency) {
  const loans = getLoans();
  const totals = debtTotals(loans);
  const emiInr = totalMonthlyEmiInr(loans);
  const extraInr = convertAmount(extraPayment, currency, 'INR');
  const currentMonthlyPayment = emiInr;
  const newMonthlyPayment = emiInr + extraInr;

  return {
    exchangeRate: GBP_TO_INR,
    totalDebtRemainingInr: totals.totalRemainingInr,
    currentMonthlyPaymentInr: currentMonthlyPayment,
    extraPaymentInr: extraInr,
    estimatedMonthsWithoutExtra: currentMonthlyPayment > 0
      ? Math.ceil(totals.totalRemainingInr / currentMonthlyPayment)
      : null,
    estimatedMonthsWithExtra: newMonthlyPayment > 0
      ? Math.ceil(totals.totalRemainingInr / newMonthlyPayment)
      : null,
    estimateLabel: 'Simple estimate using current remaining debt, fixed EMI values, and no interest compounding.'
  };
}

app.get('/api/health', wrap((req, res) => {
  res.json({ ok: true, database: 'sqlite', exchangeRate: GBP_TO_INR });
}));

app.get('/api/dashboard', wrap((req, res) => {
  res.json(dashboardData(selectedMonth(req)));
}));

app.get('/api/reports', wrap((req, res) => {
  res.json(reportsData(selectedMonth(req)));
}));

app.post('/api/scenario', wrap((req, res) => {
  const extraPayment = requireNumber(req.body, 'extraPayment');
  const currency = requireCurrency(req.body, 'currency');
  const estimate = scenarioEstimate(extraPayment, currency);
  const monthsSaved = estimate.estimatedMonthsWithoutExtra !== null && estimate.estimatedMonthsWithExtra !== null
    ? Math.max(estimate.estimatedMonthsWithoutExtra - estimate.estimatedMonthsWithExtra, 0)
    : null;
  res.json({ ...estimate, monthsSaved });
}));

app.get('/api/income', wrap((req, res) => {
  const { clause, params } = monthFilterSql(req);
  const rows = db.prepare(`
    SELECT * FROM income
    ${clause}
    ORDER BY date DESC, id DESC
  `).all(...params);
  res.json(rows);
}));

app.post('/api/income', wrap((req, res) => {
  const payload = {
    source: requireString(req.body, 'source'),
    amount: requireNumber(req.body, 'amount'),
    date: requireString(req.body, 'date'),
    notes: optionalString(req.body, 'notes')
  };
  const result = db.prepare(`
    INSERT INTO income (source, amount, date, notes)
    VALUES (@source, @amount, @date, @notes)
  `).run(payload);
  res.status(201).json(getById('income', result.lastInsertRowid));
}));

app.put('/api/income/:id', wrap((req, res) => {
  getById('income', req.params.id);
  const payload = {
    id: req.params.id,
    source: requireString(req.body, 'source'),
    amount: requireNumber(req.body, 'amount'),
    date: requireString(req.body, 'date'),
    notes: optionalString(req.body, 'notes')
  };
  db.prepare(`
    UPDATE income
    SET source = @source, amount = @amount, date = @date, notes = @notes, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run(payload);
  res.json(getById('income', req.params.id));
}));

app.delete('/api/income/:id', wrap((req, res) => {
  getById('income', req.params.id);
  db.prepare('DELETE FROM income WHERE id = ?').run(req.params.id);
  res.status(204).end();
}));

app.get('/api/expenses', wrap((req, res) => {
  const { clause, params } = monthFilterSql(req);
  const rows = db.prepare(`
    SELECT * FROM expenses
    ${clause}
    ORDER BY date DESC, id DESC
  `).all(...params);
  res.json(rows);
}));

app.post('/api/expenses', wrap((req, res) => {
  const payload = {
    category: requireString(req.body, 'category'),
    amount: requireNumber(req.body, 'amount'),
    date: requireString(req.body, 'date'),
    notes: optionalString(req.body, 'notes')
  };
  const result = db.prepare(`
    INSERT INTO expenses (category, amount, date, notes)
    VALUES (@category, @amount, @date, @notes)
  `).run(payload);
  res.status(201).json(getById('expenses', result.lastInsertRowid));
}));

app.put('/api/expenses/:id', wrap((req, res) => {
  getById('expenses', req.params.id);
  const payload = {
    id: req.params.id,
    category: requireString(req.body, 'category'),
    amount: requireNumber(req.body, 'amount'),
    date: requireString(req.body, 'date'),
    notes: optionalString(req.body, 'notes')
  };
  db.prepare(`
    UPDATE expenses
    SET category = @category, amount = @amount, date = @date, notes = @notes, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run(payload);
  res.json(getById('expenses', req.params.id));
}));

app.delete('/api/expenses/:id', wrap((req, res) => {
  getById('expenses', req.params.id);
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.status(204).end();
}));

app.get('/api/loans', wrap((req, res) => {
  res.json(getLoans());
}));

app.post('/api/loans', wrap((req, res) => {
  const payload = {
    name: requireString(req.body, 'name'),
    original_amount: requireNumber(req.body, 'original_amount'),
    remaining_amount: requireNumber(req.body, 'remaining_amount'),
    currency: requireCurrency(req.body, 'currency'),
    emi_amount: requireNumber(req.body, 'emi_amount'),
    emi_currency: requireCurrency(req.body, 'emi_currency'),
    interest_rate: Number(req.body.interest_rate || 0),
    due_date: optionalDate(req.body, 'due_date'),
    notes: optionalString(req.body, 'notes'),
    status: normalizeLoanStatus(req.body.status)
  };
  const result = db.prepare(`
    INSERT INTO loans (
      name, original_amount, remaining_amount, currency, emi_amount, emi_currency,
      interest_rate, due_date, notes, status
    )
    VALUES (
      @name, @original_amount, @remaining_amount, @currency, @emi_amount, @emi_currency,
      @interest_rate, @due_date, @notes, @status
    )
  `).run(payload);
  res.status(201).json(getById('loans', result.lastInsertRowid));
}));

app.put('/api/loans/:id', wrap((req, res) => {
  getById('loans', req.params.id);
  const payload = {
    id: req.params.id,
    name: requireString(req.body, 'name'),
    original_amount: requireNumber(req.body, 'original_amount'),
    remaining_amount: requireNumber(req.body, 'remaining_amount'),
    currency: requireCurrency(req.body, 'currency'),
    emi_amount: requireNumber(req.body, 'emi_amount'),
    emi_currency: requireCurrency(req.body, 'emi_currency'),
    interest_rate: Number(req.body.interest_rate || 0),
    due_date: optionalDate(req.body, 'due_date'),
    notes: optionalString(req.body, 'notes'),
    status: normalizeLoanStatus(req.body.status)
  };
  db.prepare(`
    UPDATE loans
    SET name = @name,
        original_amount = @original_amount,
        remaining_amount = @remaining_amount,
        currency = @currency,
        emi_amount = @emi_amount,
        emi_currency = @emi_currency,
        interest_rate = @interest_rate,
        due_date = @due_date,
        notes = @notes,
        status = @status,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run(payload);
  res.json(getById('loans', req.params.id));
}));

app.delete('/api/loans/:id', wrap((req, res) => {
  getById('loans', req.params.id);
  db.prepare('DELETE FROM loans WHERE id = ?').run(req.params.id);
  res.status(204).end();
}));

function applyLoanPayment(loan, amount, currency) {
  const convertedAmount = convertAmount(amount, currency, loan.currency);
  const nextRemaining = Math.max(loan.remaining_amount - convertedAmount, 0);
  const nextStatus = nextRemaining === 0 ? 'paid' : loan.status === 'paid' ? 'active' : loan.status;
  db.prepare(`
    UPDATE loans
    SET remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nextRemaining, nextStatus, loan.id);
  return { convertedAmount, convertedCurrency: loan.currency };
}

function restoreLoanPayment(loan, payment) {
  const restored = Math.min(loan.remaining_amount + payment.converted_amount, loan.original_amount);
  const status = restored > 0 && loan.status === 'paid' ? 'active' : loan.status;
  db.prepare(`
    UPDATE loans
    SET remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(restored, status, loan.id);
}

app.get('/api/loan-payments', wrap((req, res) => {
  const filters = [];
  const params = [];

  if (req.query.loanId) {
    filters.push('loan_payments.loan_id = ?');
    params.push(req.query.loanId);
  }
  if (req.query.month) {
    filters.push('substr(loan_payments.payment_date, 1, 7) = ?');
    params.push(String(req.query.month).slice(0, 7));
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT loan_payments.*, loans.name AS loan_name
    FROM loan_payments
    JOIN loans ON loans.id = loan_payments.loan_id
    ${whereClause}
    ORDER BY payment_date DESC, id DESC
  `).all(...params);
  res.json(rows);
}));

app.post('/api/loan-payments', wrap((req, res) => {
  const createPayment = db.transaction((body) => {
    const loan = getById('loans', body.loan_id);
    const amount = requireNumber(body, 'amount');
    const currency = requireCurrency(body, 'currency');
    const { convertedAmount, convertedCurrency } = applyLoanPayment(loan, amount, currency);
    const payload = {
      loan_id: loan.id,
      amount,
      currency,
      converted_amount: convertedAmount,
      converted_currency: convertedCurrency,
      payment_date: requireString(body, 'payment_date'),
      notes: optionalString(body, 'notes')
    };
    const result = db.prepare(`
      INSERT INTO loan_payments (
        loan_id, amount, currency, converted_amount, converted_currency, payment_date, notes
      )
      VALUES (
        @loan_id, @amount, @currency, @converted_amount, @converted_currency, @payment_date, @notes
      )
    `).run(payload);
    return result.lastInsertRowid;
  });

  const id = createPayment(req.body);
  res.status(201).json(getById('loan_payments', id));
}));

app.put('/api/loan-payments/:id', wrap((req, res) => {
  const updatePayment = db.transaction((id, body) => {
    const existing = getById('loan_payments', id);
    const oldLoan = getById('loans', existing.loan_id);
    restoreLoanPayment(oldLoan, existing);

    const newLoan = getById('loans', body.loan_id);
    const amount = requireNumber(body, 'amount');
    const currency = requireCurrency(body, 'currency');
    const { convertedAmount, convertedCurrency } = applyLoanPayment(newLoan, amount, currency);
    const payload = {
      id,
      loan_id: newLoan.id,
      amount,
      currency,
      converted_amount: convertedAmount,
      converted_currency: convertedCurrency,
      payment_date: requireString(body, 'payment_date'),
      notes: optionalString(body, 'notes')
    };
    db.prepare(`
      UPDATE loan_payments
      SET loan_id = @loan_id,
          amount = @amount,
          currency = @currency,
          converted_amount = @converted_amount,
          converted_currency = @converted_currency,
          payment_date = @payment_date,
          notes = @notes,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run(payload);
  });

  updatePayment(req.params.id, req.body);
  res.json(getById('loan_payments', req.params.id));
}));

app.delete('/api/loan-payments/:id', wrap((req, res) => {
  const deletePayment = db.transaction((id) => {
    const payment = getById('loan_payments', id);
    const loan = getById('loans', payment.loan_id);
    restoreLoanPayment(loan, payment);
    db.prepare('DELETE FROM loan_payments WHERE id = ?').run(id);
  });

  deletePayment(req.params.id);
  res.status(204).end();
}));

app.get('/api/budget-categories', wrap((req, res) => {
  const month = selectedMonth(req);
  res.json(budgetUsage(month));
}));

app.post('/api/budget-categories', wrap((req, res) => {
  const payload = {
    category: requireString(req.body, 'category'),
    monthly_limit: requireNumber(req.body, 'monthly_limit'),
    currency: requireCurrency(req.body, 'currency')
  };
  const result = db.prepare(`
    INSERT INTO budget_categories (category, monthly_limit, currency)
    VALUES (@category, @monthly_limit, @currency)
  `).run(payload);
  res.status(201).json(getById('budget_categories', result.lastInsertRowid));
}));

app.put('/api/budget-categories/:id', wrap((req, res) => {
  getById('budget_categories', req.params.id);
  const payload = {
    id: req.params.id,
    category: requireString(req.body, 'category'),
    monthly_limit: requireNumber(req.body, 'monthly_limit'),
    currency: requireCurrency(req.body, 'currency')
  };
  db.prepare(`
    UPDATE budget_categories
    SET category = @category, monthly_limit = @monthly_limit, currency = @currency, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run(payload);
  res.json(getById('budget_categories', req.params.id));
}));

app.delete('/api/budget-categories/:id', wrap((req, res) => {
  getById('budget_categories', req.params.id);
  db.prepare('DELETE FROM budget_categories WHERE id = ?').run(req.params.id);
  res.status(204).end();
}));

app.get('/api/savings-goals', wrap((req, res) => {
  res.json(db.prepare('SELECT * FROM savings_goals ORDER BY id ASC').all());
}));

app.post('/api/savings-goals', wrap((req, res) => {
  const payload = {
    name: requireString(req.body, 'name'),
    current_amount: requireNumber(req.body, 'current_amount'),
    target_amount: requireNumber(req.body, 'target_amount'),
    currency: requireCurrency(req.body, 'currency'),
    notes: optionalString(req.body, 'notes')
  };
  const result = db.prepare(`
    INSERT INTO savings_goals (name, current_amount, target_amount, currency, notes)
    VALUES (@name, @current_amount, @target_amount, @currency, @notes)
  `).run(payload);
  res.status(201).json(getById('savings_goals', result.lastInsertRowid));
}));

app.put('/api/savings-goals/:id', wrap((req, res) => {
  getById('savings_goals', req.params.id);
  const payload = {
    id: req.params.id,
    name: requireString(req.body, 'name'),
    current_amount: requireNumber(req.body, 'current_amount'),
    target_amount: requireNumber(req.body, 'target_amount'),
    currency: requireCurrency(req.body, 'currency'),
    notes: optionalString(req.body, 'notes')
  };
  db.prepare(`
    UPDATE savings_goals
    SET name = @name,
        current_amount = @current_amount,
        target_amount = @target_amount,
        currency = @currency,
        notes = @notes,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run(payload);
  res.json(getById('savings_goals', req.params.id));
}));

app.delete('/api/savings-goals/:id', wrap((req, res) => {
  getById('savings_goals', req.params.id);
  db.prepare('DELETE FROM savings_goals WHERE id = ?').run(req.params.id);
  res.status(204).end();
}));

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((error, req, res, next) => {
  const status = error.status || 500;
  const message = status === 500 ? 'Internal server error' : error.message;
  if (status === 500) {
    console.error(error);
  }
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Budget API running on port ${PORT}`);
});
