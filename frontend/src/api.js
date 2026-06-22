const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  };

  if (config.body && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(`${API_BASE}${path}`, config);
  if (response.status === 204) return null;

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed with ${response.status}`);
  }

  return body;
}

function query(params) {
  const search = new URLSearchParams(params);
  const value = search.toString();
  return value ? `?${value}` : '';
}

export const api = {
  dashboard: (month) => request(`/dashboard${query({ month })}`),
  reports: (month) => request(`/reports${query({ month })}`),
  scenario: (payload) => request('/scenario', { method: 'POST', body: payload }),

  listIncome: (month) => request(`/income${query({ month })}`),
  createIncome: (payload) => request('/income', { method: 'POST', body: payload }),
  updateIncome: (id, payload) => request(`/income/${id}`, { method: 'PUT', body: payload }),
  deleteIncome: (id) => request(`/income/${id}`, { method: 'DELETE' }),

  listExpenses: (month) => request(`/expenses${query({ month })}`),
  createExpense: (payload) => request('/expenses', { method: 'POST', body: payload }),
  updateExpense: (id, payload) => request(`/expenses/${id}`, { method: 'PUT', body: payload }),
  deleteExpense: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),

  listLoans: () => request('/loans'),
  createLoan: (payload) => request('/loans', { method: 'POST', body: payload }),
  updateLoan: (id, payload) => request(`/loans/${id}`, { method: 'PUT', body: payload }),
  deleteLoan: (id) => request(`/loans/${id}`, { method: 'DELETE' }),

  listLoanPayments: () => request('/loan-payments'),
  createLoanPayment: (payload) => request('/loan-payments', { method: 'POST', body: payload }),
  updateLoanPayment: (id, payload) => request(`/loan-payments/${id}`, { method: 'PUT', body: payload }),
  deleteLoanPayment: (id) => request(`/loan-payments/${id}`, { method: 'DELETE' }),

  listBudgetCategories: (month) => request(`/budget-categories${query({ month })}`),
  createBudgetCategory: (payload) => request('/budget-categories', { method: 'POST', body: payload }),
  updateBudgetCategory: (id, payload) => request(`/budget-categories/${id}`, { method: 'PUT', body: payload }),
  deleteBudgetCategory: (id) => request(`/budget-categories/${id}`, { method: 'DELETE' }),

  listSavingsGoals: () => request('/savings-goals'),
  createSavingsGoal: (payload) => request('/savings-goals', { method: 'POST', body: payload }),
  updateSavingsGoal: (id, payload) => request(`/savings-goals/${id}`, { method: 'PUT', body: payload }),
  deleteSavingsGoal: (id) => request(`/savings-goals/${id}`, { method: 'DELETE' })
};
