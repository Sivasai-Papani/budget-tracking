import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  BarChart3,
  Calculator,
  CircleDollarSign,
  Gauge,
  Landmark,
  LayoutDashboard,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  Save,
  Target,
  Trash2,
  WalletCards,
  X
} from 'lucide-react';
import { api } from './api';

const DEFAULT_CATEGORIES = [
  'Rent',
  'Electricity/Gas',
  'Internet',
  'Groceries',
  'Transport',
  'Entertainment',
  'Eating Out',
  'Shopping',
  'Other'
];

const CHART_COLORS = ['#26706d', '#cc5a45', '#e1a53a', '#5f7fbd', '#7d6a55', '#6c9a55', '#b45f8c', '#4f8fba', '#9b7851'];

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'income', label: 'Income', icon: WalletCards },
  { id: 'expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'loans', label: 'Loans', icon: Landmark },
  { id: 'budget', label: 'Budget', icon: Gauge },
  { id: 'savings', label: 'Savings', icon: PiggyBank },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'calculator', label: 'Calculator', icon: Calculator }
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthIso() {
  return new Date().toISOString().slice(0, 7);
}

function formatCurrency(value, currency = 'GBP', options = {}) {
  const locale = currency === 'INR' ? 'en-IN' : 'en-GB';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: options.decimals ?? (currency === 'INR' ? 0 : 2)
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0))}%`;
}

function toNumber(value) {
  return Number(value || 0);
}

function monthsToYears(months) {
  if (months === null || months === undefined) return 'n/a';
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (!years) return `${months} months`;
  if (!remaining) return `${years} years`;
  return `${years} years ${remaining} months`;
}

function ProgressBar({ value, variant = 'ok' }) {
  const width = Math.max(0, Math.min(Number(value || 0), 100));
  return (
    <div className="progress-track" aria-label={`Progress ${formatPercent(width)}`}>
      <div className={`progress-fill ${variant}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function EmptyState({ label }) {
  return <div className="empty-state">{label}</div>;
}

function ChartShell({ children, empty }) {
  if (empty) return <EmptyState label="No data for this month." />;
  return <div className="chart-shell">{children}</div>;
}

function IconButton({ label, icon: Icon, variant = 'ghost', ...props }) {
  return (
    <button className={`icon-button ${variant}`} type="button" title={label} aria-label={label} {...props}>
      <Icon size={16} />
    </button>
  );
}

function PrimaryButton({ children, icon: Icon = Save, className = '', ...props }) {
  return (
    <button className={`button primary ${className}`} type="submit" {...props}>
      <Icon size={16} />
      <span>{children}</span>
    </button>
  );
}

function SecondaryButton({ children, icon: Icon = X, className = '', ...props }) {
  return (
    <button className={`button secondary ${className}`} type="button" {...props}>
      <Icon size={16} />
      <span>{children}</span>
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ label, value, note, icon: Icon, tone = 'neutral' }) {
  return (
    <section className={`metric-card ${tone}`}>
      <div className="metric-icon">
        <Icon size={18} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {note ? <span>{note}</span> : null}
      </div>
    </section>
  );
}

function DataTable({ columns, rows, emptyLabel }) {
  if (!rows.length) return <EmptyState label={emptyLabel} />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key} data-label={column.label}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [month, setMonth] = useState(monthIso());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    dashboard: null,
    reports: null,
    income: [],
    expenses: [],
    loans: [],
    loanPayments: [],
    budgets: [],
    savingsGoals: []
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [
        dashboard,
        reports,
        income,
        expenses,
        loans,
        loanPayments,
        budgets,
        savingsGoals
      ] = await Promise.all([
        api.dashboard(month),
        api.reports(month),
        api.listIncome(month),
        api.listExpenses(month),
        api.listLoans(),
        api.listLoanPayments(),
        api.listBudgetCategories(month),
        api.listSavingsGoals()
      ]);

      setData({ dashboard, reports, income, expenses, loans, loanPayments, budgets, savingsGoals });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function runAction(action) {
    setSaving(true);
    setError('');
    try {
      await action();
      await loadData();
      return true;
    } catch (actionError) {
      setError(actionError.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  const categoryOptions = useMemo(() => {
    const fromBudgets = data.budgets.map((budget) => budget.category);
    const fromExpenses = data.expenses.map((expense) => expense.category);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromBudgets, ...fromExpenses])).sort();
  }, [data.budgets, data.expenses]);

  const page = {
    dashboard: <DashboardPage dashboard={data.dashboard} budgets={data.budgets} setActivePage={setActivePage} />,
    income: (
      <IncomePage
        records={data.income}
        saving={saving}
        onCreate={(payload) => runAction(() => api.createIncome(payload))}
        onUpdate={(id, payload) => runAction(() => api.updateIncome(id, payload))}
        onDelete={(id) => runAction(() => api.deleteIncome(id))}
      />
    ),
    expenses: (
      <ExpensesPage
        records={data.expenses}
        categories={categoryOptions}
        saving={saving}
        onCreate={(payload) => runAction(() => api.createExpense(payload))}
        onUpdate={(id, payload) => runAction(() => api.updateExpense(id, payload))}
        onDelete={(id) => runAction(() => api.deleteExpense(id))}
      />
    ),
    loans: (
      <LoansPage
        loans={data.loans}
        payments={data.loanPayments}
        saving={saving}
        onCreateLoan={(payload) => runAction(() => api.createLoan(payload))}
        onUpdateLoan={(id, payload) => runAction(() => api.updateLoan(id, payload))}
        onDeleteLoan={(id) => runAction(() => api.deleteLoan(id))}
        onCreatePayment={(payload) => runAction(() => api.createLoanPayment(payload))}
        onDeletePayment={(id) => runAction(() => api.deleteLoanPayment(id))}
      />
    ),
    budget: (
      <BudgetPage
        budgets={data.budgets}
        saving={saving}
        onCreate={(payload) => runAction(() => api.createBudgetCategory(payload))}
        onUpdate={(id, payload) => runAction(() => api.updateBudgetCategory(id, payload))}
        onDelete={(id) => runAction(() => api.deleteBudgetCategory(id))}
      />
    ),
    savings: (
      <SavingsPage
        goals={data.savingsGoals}
        saving={saving}
        onCreate={(payload) => runAction(() => api.createSavingsGoal(payload))}
        onUpdate={(id, payload) => runAction(() => api.updateSavingsGoal(id, payload))}
      />
    ),
    reports: <ReportsPage reports={data.reports} />,
    calculator: <ScenarioPage />
  }[activePage];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <CircleDollarSign size={22} />
          </div>
          <div>
            <strong>Budget Desk</strong>
            <span>Local tracker</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={activePage === item.id ? 'active' : ''}
                onClick={() => setActivePage(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p>Personal budget</p>
            <h1>{navItems.find((item) => item.id === activePage)?.label}</h1>
          </div>
          <Field label="Month">
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </Field>
        </header>

        {error ? (
          <div className="notice error">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')}>Dismiss</button>
          </div>
        ) : null}

        {loading ? <div className="loading">Loading budget data...</div> : page}
      </main>
    </div>
  );
}

function DashboardPage({ dashboard, budgets, setActivePage }) {
  if (!dashboard) return null;
  const totals = dashboard.totals;
  const savingsProgress = totals.savingsTarget ? (totals.savings / totals.savingsTarget) * 100 : 0;

  return (
    <div className="page-stack">
      <section className="metric-grid">
        <MetricCard label="Monthly income" value={formatCurrency(totals.income)} icon={WalletCards} tone="positive" />
        <MetricCard label="Monthly expenses" value={formatCurrency(totals.expenses)} icon={ReceiptText} tone="warning" />
        <MetricCard label="Monthly EMI" value={formatCurrency(totals.emi)} icon={Landmark} tone="accent" />
        <MetricCard label="Remaining balance" value={formatCurrency(totals.remainingBalance)} icon={Gauge} tone={totals.remainingBalance >= 0 ? 'positive' : 'danger'} />
        <MetricCard label="Savings balance" value={formatCurrency(totals.savings)} icon={PiggyBank} note={`${formatPercent(savingsProgress)} of emergency fund`} />
        <MetricCard label="Debt remaining" value={formatCurrency(totals.totalDebtRemainingInr, 'INR')} icon={Target} note={`${formatPercent(totals.debtProgressPercentage)} paid`} />
      </section>

      <section className="section-grid two">
        <div className="panel">
          <div className="section-heading">
            <h2>Expenses by Category</h2>
          </div>
          <ChartShell empty={!dashboard.charts.expensesByCategory.length}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dashboard.charts.expensesByCategory}
                  dataKey="total"
                  nameKey="category"
                  innerRadius={58}
                  outerRadius={96}
                  paddingAngle={2}
                >
                  {dashboard.charts.expensesByCategory.map((entry, index) => (
                    <Cell key={entry.category} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartShell>
        </div>

        <div className="panel">
          <div className="section-heading">
            <h2>Debt Reduction</h2>
          </div>
          <ChartShell empty={!dashboard.charts.debtReduction.length}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dashboard.charts.debtReduction}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `₹${Math.round(value / 100000)}L`} />
                <Tooltip formatter={(value) => formatCurrency(value, 'INR')} />
                <Legend />
                <Area type="monotone" dataKey="remaining" name="Remaining" stroke="#cc5a45" fill="#f2c8bd" />
                <Area type="monotone" dataKey="paid" name="Paid" stroke="#26706d" fill="#b9ddda" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartShell>
        </div>
      </section>

      <section className="section-grid two">
        <div className="panel">
          <div className="section-heading">
            <h2>Debt Progress</h2>
            <button className="text-button" type="button" onClick={() => setActivePage('loans')}>Update loans</button>
          </div>
          <div className="progress-block">
            <div className="progress-row">
              <span>{formatCurrency(totals.totalDebtPaidInr, 'INR')} paid</span>
              <strong>{formatPercent(totals.debtProgressPercentage)}</strong>
            </div>
            <ProgressBar value={totals.debtProgressPercentage} />
            <small>Debt totals use the local estimate rate £1 = ₹{dashboard.exchangeRate}.</small>
          </div>
        </div>

        <div className="panel">
          <div className="section-heading">
            <h2>Budget Warnings</h2>
            <button className="text-button" type="button" onClick={() => setActivePage('budget')}>Adjust budgets</button>
          </div>
          <div className="compact-list">
            {budgets.slice(0, 5).map((budget) => (
              <div className={`budget-chip ${budget.status}`} key={budget.id}>
                <span>{budget.category}</span>
                <strong>{formatPercent(budget.percentage)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function IncomePage({ records, saving, onCreate, onUpdate, onDelete }) {
  const emptyForm = { source: 'Salary', amount: '', date: todayIso(), notes: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    const payload = { ...form, amount: toNumber(form.amount) };
    const ok = editingId ? await onUpdate(editingId, payload) : await onCreate(payload);
    if (ok) {
      setForm(emptyForm);
      setEditingId(null);
    }
  }

  function edit(record) {
    setEditingId(record.id);
    setForm({
      source: record.source,
      amount: record.amount,
      date: record.date,
      notes: record.notes || ''
    });
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="section-heading">
          <h2>{editingId ? 'Edit Income' : 'Add Income'}</h2>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <Field label="Source">
            <input value={form.source} onChange={(event) => updateField('source', event.target.value)} required />
          </Field>
          <Field label="Amount">
            <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => updateField('amount', event.target.value)} required />
          </Field>
          <Field label="Date">
            <input type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} required />
          </Field>
          <Field label="Notes">
            <input value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
          </Field>
          <div className="form-actions">
            <PrimaryButton disabled={saving}>{editingId ? 'Save income' : 'Add income'}</PrimaryButton>
            {editingId ? (
              <SecondaryButton onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</SecondaryButton>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Income Records</h2>
        </div>
        <DataTable
          rows={records}
          emptyLabel="No income records for this month."
          columns={[
            { key: 'source', label: 'Source' },
            { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.amount) },
            { key: 'date', label: 'Date' },
            { key: 'notes', label: 'Notes' },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div className="row-actions">
                  <IconButton label="Edit income" icon={Pencil} onClick={() => edit(row)} />
                  <IconButton label="Delete income" icon={Trash2} variant="danger" onClick={() => onDelete(row.id)} />
                </div>
              )
            }
          ]}
        />
      </section>
    </div>
  );
}

function ExpensesPage({ records, categories, saving, onCreate, onUpdate, onDelete }) {
  const emptyForm = { category: 'Groceries', amount: '', date: todayIso(), notes: '' };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    const payload = { ...form, amount: toNumber(form.amount) };
    const ok = editingId ? await onUpdate(editingId, payload) : await onCreate(payload);
    if (ok) {
      setForm(emptyForm);
      setEditingId(null);
    }
  }

  function edit(record) {
    setEditingId(record.id);
    setForm({
      category: record.category,
      amount: record.amount,
      date: record.date,
      notes: record.notes || ''
    });
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="section-heading">
          <h2>{editingId ? 'Edit Expense' : 'Add Expense'}</h2>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <Field label="Category">
            <select value={form.category} onChange={(event) => updateField('category', event.target.value)}>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => updateField('amount', event.target.value)} required />
          </Field>
          <Field label="Date">
            <input type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} required />
          </Field>
          <Field label="Notes">
            <input value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
          </Field>
          <div className="form-actions">
            <PrimaryButton disabled={saving}>{editingId ? 'Save expense' : 'Add expense'}</PrimaryButton>
            {editingId ? (
              <SecondaryButton onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</SecondaryButton>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Expense Records</h2>
        </div>
        <DataTable
          rows={records}
          emptyLabel="No expenses for this month."
          columns={[
            { key: 'category', label: 'Category' },
            { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.amount) },
            { key: 'date', label: 'Date' },
            { key: 'notes', label: 'Notes' },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div className="row-actions">
                  <IconButton label="Edit expense" icon={Pencil} onClick={() => edit(row)} />
                  <IconButton label="Delete expense" icon={Trash2} variant="danger" onClick={() => onDelete(row.id)} />
                </div>
              )
            }
          ]}
        />
      </section>
    </div>
  );
}

function LoansPage({ loans, payments, saving, onCreateLoan, onUpdateLoan, onDeleteLoan, onCreatePayment, onDeletePayment }) {
  const emptyLoan = {
    name: '',
    original_amount: '',
    remaining_amount: '',
    currency: 'INR',
    emi_amount: '',
    emi_currency: 'GBP',
    interest_rate: 0,
    due_date: todayIso(),
    notes: '',
    status: 'active'
  };
  const emptyPayment = { loan_id: loans[0]?.id || '', amount: '', currency: 'GBP', payment_date: todayIso(), notes: '' };
  const [loanForm, setLoanForm] = useState(emptyLoan);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [editingLoanId, setEditingLoanId] = useState(null);

  useEffect(() => {
    setPaymentForm((current) => ({
      ...current,
      loan_id: current.loan_id || loans[0]?.id || ''
    }));
  }, [loans]);

  function updateLoanField(field, value) {
    setLoanForm((current) => ({ ...current, [field]: value }));
  }

  function updatePaymentField(field, value) {
    setPaymentForm((current) => ({ ...current, [field]: value }));
  }

  async function submitLoan(event) {
    event.preventDefault();
    const payload = {
      ...loanForm,
      original_amount: toNumber(loanForm.original_amount),
      remaining_amount: toNumber(loanForm.remaining_amount),
      emi_amount: toNumber(loanForm.emi_amount),
      interest_rate: toNumber(loanForm.interest_rate)
    };
    const ok = editingLoanId ? await onUpdateLoan(editingLoanId, payload) : await onCreateLoan(payload);
    if (ok) {
      setLoanForm(emptyLoan);
      setEditingLoanId(null);
    }
  }

  async function submitPayment(event) {
    event.preventDefault();
    const payload = {
      ...paymentForm,
      loan_id: Number(paymentForm.loan_id),
      amount: toNumber(paymentForm.amount)
    };
    const ok = await onCreatePayment(payload);
    if (ok) {
      setPaymentForm({ ...emptyPayment, loan_id: payload.loan_id });
    }
  }

  function editLoan(loan) {
    setEditingLoanId(loan.id);
    setLoanForm({
      name: loan.name,
      original_amount: loan.original_amount,
      remaining_amount: loan.remaining_amount,
      currency: loan.currency,
      emi_amount: loan.emi_amount,
      emi_currency: loan.emi_currency,
      interest_rate: loan.interest_rate,
      due_date: loan.due_date || '',
      notes: loan.notes || '',
      status: loan.status
    });
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="section-heading">
          <h2>{editingLoanId ? 'Edit Loan' : 'Add Loan'}</h2>
        </div>
        <form className="form-grid wide" onSubmit={submitLoan}>
          <Field label="Loan name">
            <input value={loanForm.name} onChange={(event) => updateLoanField('name', event.target.value)} required />
          </Field>
          <Field label="Original amount">
            <input type="number" min="0" step="0.01" value={loanForm.original_amount} onChange={(event) => updateLoanField('original_amount', event.target.value)} required />
          </Field>
          <Field label="Remaining amount">
            <input type="number" min="0" step="0.01" value={loanForm.remaining_amount} onChange={(event) => updateLoanField('remaining_amount', event.target.value)} required />
          </Field>
          <Field label="Debt currency">
            <select value={loanForm.currency} onChange={(event) => updateLoanField('currency', event.target.value)}>
              <option value="INR">INR</option>
              <option value="GBP">GBP</option>
            </select>
          </Field>
          <Field label="EMI amount">
            <input type="number" min="0" step="0.01" value={loanForm.emi_amount} onChange={(event) => updateLoanField('emi_amount', event.target.value)} required />
          </Field>
          <Field label="EMI currency">
            <select value={loanForm.emi_currency} onChange={(event) => updateLoanField('emi_currency', event.target.value)}>
              <option value="GBP">GBP</option>
              <option value="INR">INR</option>
            </select>
          </Field>
          <Field label="Interest rate %">
            <input type="number" min="0" step="0.01" value={loanForm.interest_rate} onChange={(event) => updateLoanField('interest_rate', event.target.value)} />
          </Field>
          <Field label="Due date">
            <input type="date" value={loanForm.due_date} onChange={(event) => updateLoanField('due_date', event.target.value)} />
          </Field>
          <Field label="Status">
            <select value={loanForm.status} onChange={(event) => updateLoanField('status', event.target.value)}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="paid">Paid</option>
            </select>
          </Field>
          <Field label="Notes">
            <input value={loanForm.notes} onChange={(event) => updateLoanField('notes', event.target.value)} />
          </Field>
          <div className="form-actions">
            <PrimaryButton disabled={saving}>{editingLoanId ? 'Save loan' : 'Add loan'}</PrimaryButton>
            {editingLoanId ? (
              <SecondaryButton onClick={() => { setEditingLoanId(null); setLoanForm(emptyLoan); }}>Cancel</SecondaryButton>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Record Loan Payment</h2>
        </div>
        <form className="form-grid" onSubmit={submitPayment}>
          <Field label="Loan">
            <select value={paymentForm.loan_id} onChange={(event) => updatePaymentField('loan_id', event.target.value)} required>
              {loans.map((loan) => (
                <option key={loan.id} value={loan.id}>{loan.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(event) => updatePaymentField('amount', event.target.value)} required />
          </Field>
          <Field label="Currency">
            <select value={paymentForm.currency} onChange={(event) => updatePaymentField('currency', event.target.value)}>
              <option value="GBP">GBP</option>
              <option value="INR">INR</option>
            </select>
          </Field>
          <Field label="Payment date">
            <input type="date" value={paymentForm.payment_date} onChange={(event) => updatePaymentField('payment_date', event.target.value)} required />
          </Field>
          <Field label="Notes">
            <input value={paymentForm.notes} onChange={(event) => updatePaymentField('notes', event.target.value)} />
          </Field>
          <div className="form-actions">
            <PrimaryButton icon={Plus} disabled={saving || !loans.length}>Add payment</PrimaryButton>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Loans</h2>
        </div>
        <DataTable
          rows={loans}
          emptyLabel="No loans yet."
          columns={[
            { key: 'name', label: 'Loan' },
            { key: 'original_amount', label: 'Original', render: (row) => formatCurrency(row.original_amount, row.currency) },
            { key: 'remaining_amount', label: 'Remaining', render: (row) => formatCurrency(row.remaining_amount, row.currency) },
            { key: 'emi_amount', label: 'EMI', render: (row) => formatCurrency(row.emi_amount, row.emi_currency) },
            { key: 'interest_rate', label: 'Interest', render: (row) => `${row.interest_rate || 0}%` },
            { key: 'due_date', label: 'Due date' },
            { key: 'status', label: 'Status', render: (row) => <span className={`status-pill ${row.status}`}>{row.status}</span> },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div className="row-actions">
                  <IconButton label="Edit loan" icon={Pencil} onClick={() => editLoan(row)} />
                  <IconButton label="Delete loan" icon={Trash2} variant="danger" onClick={() => onDeleteLoan(row.id)} />
                </div>
              )
            }
          ]}
        />
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Loan Payments</h2>
        </div>
        <DataTable
          rows={payments}
          emptyLabel="No loan payments recorded yet."
          columns={[
            { key: 'loan_name', label: 'Loan' },
            { key: 'amount', label: 'Payment', render: (row) => formatCurrency(row.amount, row.currency) },
            { key: 'converted_amount', label: 'Applied', render: (row) => formatCurrency(row.converted_amount, row.converted_currency) },
            { key: 'payment_date', label: 'Date' },
            { key: 'notes', label: 'Notes' },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div className="row-actions">
                  <IconButton label="Delete loan payment" icon={Trash2} variant="danger" onClick={() => onDeletePayment(row.id)} />
                </div>
              )
            }
          ]}
        />
      </section>
    </div>
  );
}

function BudgetPage({ budgets, saving, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState({ category: '', monthly_limit: '', currency: 'GBP' });

  async function submit(event) {
    event.preventDefault();
    const ok = await onCreate({ ...form, monthly_limit: toNumber(form.monthly_limit) });
    if (ok) setForm({ category: '', monthly_limit: '', currency: 'GBP' });
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="section-heading">
          <h2>Add Budget Category</h2>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <Field label="Category">
            <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} required />
          </Field>
          <Field label="Monthly limit">
            <input type="number" min="0" step="0.01" value={form.monthly_limit} onChange={(event) => setForm((current) => ({ ...current, monthly_limit: event.target.value }))} required />
          </Field>
          <Field label="Currency">
            <select value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}>
              <option value="GBP">GBP</option>
              <option value="INR">INR</option>
            </select>
          </Field>
          <div className="form-actions">
            <PrimaryButton icon={Plus} disabled={saving}>Add budget</PrimaryButton>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Actual vs Budget</h2>
        </div>
        <div className="budget-list">
          {budgets.map((budget) => (
            <BudgetRow key={budget.id} budget={budget} saving={saving} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      </section>
    </div>
  );
}

function BudgetRow({ budget, saving, onUpdate, onDelete }) {
  const [draft, setDraft] = useState({
    category: budget.category,
    monthly_limit: budget.monthly_limit,
    currency: budget.currency
  });

  useEffect(() => {
    setDraft({ category: budget.category, monthly_limit: budget.monthly_limit, currency: budget.currency });
  }, [budget]);

  const variant = budget.status === 'over' ? 'danger' : budget.status === 'warning' ? 'warning' : 'ok';

  return (
    <div className={`budget-row ${variant}`}>
      <div className="budget-row-main">
        <input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} />
        <div className="budget-numbers">
          <span>{formatCurrency(budget.actual)} spent</span>
          <strong>{formatPercent(budget.percentage)}</strong>
        </div>
        <ProgressBar value={budget.percentage} variant={variant} />
      </div>
      <div className="budget-row-controls">
        <input
          type="number"
          min="0"
          step="0.01"
          value={draft.monthly_limit}
          onChange={(event) => setDraft((current) => ({ ...current, monthly_limit: event.target.value }))}
        />
        <select value={draft.currency} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value }))}>
          <option value="GBP">GBP</option>
          <option value="INR">INR</option>
        </select>
        <IconButton
          label="Save budget"
          icon={Save}
          onClick={() => onUpdate(budget.id, { ...draft, monthly_limit: toNumber(draft.monthly_limit) })}
          disabled={saving}
        />
        <IconButton label="Delete budget" icon={Trash2} variant="danger" onClick={() => onDelete(budget.id)} disabled={saving} />
      </div>
    </div>
  );
}

function SavingsPage({ goals, saving, onCreate, onUpdate }) {
  const goal = goals[0];
  const [form, setForm] = useState({
    name: 'Emergency Fund',
    current_amount: 500,
    target_amount: 3000,
    currency: 'GBP',
    notes: ''
  });

  useEffect(() => {
    if (goal) {
      setForm({
        name: goal.name,
        current_amount: goal.current_amount,
        target_amount: goal.target_amount,
        currency: goal.currency,
        notes: goal.notes || ''
      });
    }
  }, [goal]);

  async function submit(event) {
    event.preventDefault();
    const payload = {
      ...form,
      current_amount: toNumber(form.current_amount),
      target_amount: toNumber(form.target_amount)
    };
    if (goal) await onUpdate(goal.id, payload);
    else await onCreate(payload);
  }

  const progress = form.target_amount ? (Number(form.current_amount || 0) / Number(form.target_amount || 1)) * 100 : 0;

  return (
    <div className="page-stack">
      <section className="panel savings-panel">
        <div className="section-heading">
          <h2>Emergency Fund</h2>
        </div>
        <div className="savings-summary">
          <strong>{formatCurrency(form.current_amount, form.currency)}</strong>
          <span>of {formatCurrency(form.target_amount, form.currency)}</span>
        </div>
        <ProgressBar value={progress} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Update Savings</h2>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <Field label="Goal name">
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          </Field>
          <Field label="Current amount">
            <input type="number" min="0" step="0.01" value={form.current_amount} onChange={(event) => setForm((current) => ({ ...current, current_amount: event.target.value }))} required />
          </Field>
          <Field label="Target amount">
            <input type="number" min="0" step="0.01" value={form.target_amount} onChange={(event) => setForm((current) => ({ ...current, target_amount: event.target.value }))} required />
          </Field>
          <Field label="Currency">
            <select value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}>
              <option value="GBP">GBP</option>
              <option value="INR">INR</option>
            </select>
          </Field>
          <Field label="Notes">
            <input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </Field>
          <div className="form-actions">
            <PrimaryButton disabled={saving}>Save savings</PrimaryButton>
          </div>
        </form>
      </section>
    </div>
  );
}

function ReportsPage({ reports }) {
  if (!reports) return null;
  const goal = reports.savingsGoal;
  const savingsProgress = goal?.target_amount ? (goal.current_amount / goal.target_amount) * 100 : 0;

  return (
    <div className="page-stack">
      <section className="metric-grid compact">
        <MetricCard label="Expense total" value={formatCurrency(reports.monthlyExpenseSummary.total)} icon={ReceiptText} />
        <MetricCard label="Transactions" value={reports.monthlyExpenseSummary.transactionCount} icon={BarChart3} />
        <MetricCard label="Savings progress" value={formatPercent(savingsProgress)} icon={PiggyBank} note={goal ? formatCurrency(goal.current_amount, goal.currency) : undefined} />
      </section>

      <section className="section-grid two">
        <div className="panel">
          <div className="section-heading">
            <h2>Category Breakdown</h2>
          </div>
          <ChartShell empty={!reports.expenseBreakdown.length}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reports.expenseBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="total" name="Spent" fill="#26706d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>
        </div>

        <div className="panel">
          <div className="section-heading">
            <h2>Income vs Expenses</h2>
          </div>
          <ChartShell empty={!reports.incomeVsExpenses.length}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={reports.incomeVsExpenses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="income" name="Income" stroke="#26706d" strokeWidth={2} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#cc5a45" strokeWidth={2} />
                <Line type="monotone" dataKey="emi" name="EMI" stroke="#e1a53a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartShell>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Debt Reduction Over Time</h2>
        </div>
        <ChartShell empty={!reports.debtReduction.length}>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={reports.debtReduction}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `₹${Math.round(value / 100000)}L`} />
              <Tooltip formatter={(value) => formatCurrency(value, 'INR')} />
              <Legend />
              <Area type="monotone" dataKey="remaining" name="Remaining" stroke="#cc5a45" fill="#f2c8bd" />
              <Area type="monotone" dataKey="paid" name="Paid" stroke="#26706d" fill="#b9ddda" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartShell>
      </section>
    </div>
  );
}

function ScenarioPage() {
  const [form, setForm] = useState({ extraPayment: 100, currency: 'GBP' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const estimate = await api.scenario({ ...form, extraPayment: toNumber(form.extraPayment) });
      setResult(estimate);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="section-heading">
          <h2>Extra Debt Payment Estimate</h2>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <Field label="Extra payment">
            <input type="number" min="0" step="0.01" value={form.extraPayment} onChange={(event) => setForm((current) => ({ ...current, extraPayment: event.target.value }))} required />
          </Field>
          <Field label="Currency">
            <select value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}>
              <option value="GBP">GBP</option>
              <option value="INR">INR</option>
            </select>
          </Field>
          <div className="form-actions">
            <PrimaryButton icon={Calculator} disabled={loading}>Calculate</PrimaryButton>
          </div>
        </form>
      </section>

      {error ? <div className="notice error">{error}</div> : null}

      {result ? (
        <section className="panel">
          <div className="section-heading">
            <h2>Estimate</h2>
          </div>
          <div className="estimate-grid">
            <MetricCard label="Debt remaining" value={formatCurrency(result.totalDebtRemainingInr, 'INR')} icon={Landmark} />
            <MetricCard label="Current timeline" value={monthsToYears(result.estimatedMonthsWithoutExtra)} icon={Target} />
            <MetricCard label="With extra payment" value={monthsToYears(result.estimatedMonthsWithExtra)} icon={Calculator} />
            <MetricCard label="Time saved" value={monthsToYears(result.monthsSaved)} icon={PiggyBank} tone="positive" />
          </div>
          <p className="estimate-note">
            {result.estimateLabel} Exchange rate used: £1 = ₹{result.exchangeRate}.
          </p>
        </section>
      ) : null}
    </div>
  );
}
