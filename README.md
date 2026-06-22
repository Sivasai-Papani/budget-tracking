# Personal Budget and Debt Tracker

A local-only budgeting web app built with React, Vite, Express, SQLite, and Recharts. It has no login or authentication.

## Features

- Dashboard with monthly income, expenses, EMI, remaining balance, savings, total debt, and progress.
- Income, expense, loan, loan payment, budget category, and savings goal management.
- SQLite database with seeded starting values:
  - Salary: £1700
  - Savings: £500 toward a £3000 emergency fund
  - Debt: ₹35,00,000 INR
  - EMI: £650 per month
  - Expense categories and starting monthly values from the request
- Budget warnings at 80% and 100%.
- Reports with monthly summaries and charts.
- Scenario calculator for simple extra debt payment estimates.
- GBP and INR support using a local exchange-rate estimate.

## Folder Structure

```text
.
├── backend
│   ├── Dockerfile
│   ├── package.json
│   └── src
│       ├── database.js
│       └── server.js
├── frontend
│   ├── Dockerfile
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src
│       ├── api.js
│       ├── App.jsx
│       ├── main.jsx
│       └── styles.css
├── data
├── docker-compose.yml
└── README.md
```

## Run With Docker Compose

```bash
docker compose up --build
```

Open the app at:

```text
http://localhost:5173
```

The API runs at:

```text
http://localhost:5001/api/health
```

SQLite data is stored in `./data/budget.sqlite` and is mounted into the backend container.

## Run Locally Without Docker

Install backend dependencies and start the API:

```bash
cd backend
npm install
npm run dev
```

In another terminal, install frontend dependencies and start Vite:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Configuration

The backend accepts these environment variables:

```text
PORT=5001
DB_FILE=/path/to/budget.sqlite
EXCHANGE_GBP_TO_INR=105
```

The exchange rate is only used for local estimates when combining GBP and INR values. No external or paid service is used.

## API Routes

```text
GET    /api/health
GET    /api/dashboard?month=YYYY-MM
GET    /api/reports?month=YYYY-MM
POST   /api/scenario

GET    /api/income?month=YYYY-MM
POST   /api/income
PUT    /api/income/:id
DELETE /api/income/:id

GET    /api/expenses?month=YYYY-MM
POST   /api/expenses
PUT    /api/expenses/:id
DELETE /api/expenses/:id

GET    /api/loans
POST   /api/loans
PUT    /api/loans/:id
DELETE /api/loans/:id

GET    /api/loan-payments
POST   /api/loan-payments
PUT    /api/loan-payments/:id
DELETE /api/loan-payments/:id

GET    /api/budget-categories?month=YYYY-MM
POST   /api/budget-categories
PUT    /api/budget-categories/:id
DELETE /api/budget-categories/:id

GET    /api/savings-goals
POST   /api/savings-goals
PUT    /api/savings-goals/:id
DELETE /api/savings-goals/:id
```

## Notes

Seed data is inserted only when each table is empty. To reset the app completely, stop the containers and delete `data/budget.sqlite`.
