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
├── caddy
│   └── Caddyfile
├── frontend
│   ├── Dockerfile
│   ├── Dockerfile.prod
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
├── docker-compose.prod.yml
├── .env.production.example
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

## Production Deployment on AWS Ubuntu

The production setup is separate from the local development setup:

- `docker-compose.yml` runs the Vite development server on port `5173`.
- `docker-compose.prod.yml` builds static frontend files, serves them through Caddy, reverse proxies `/api` to Express, and exposes only ports `80` and `443`.
- `caddy/Caddyfile` is configured for `hodimoit.co.uk` and automatic HTTPS.
- SQLite remains local and persistent at `./data/budget.sqlite`.

Important: this app still has no authentication. If ports `80` and `443` are open to the whole internet, anyone who finds `https://hodimoit.co.uk` can view and edit the data. For personal use, restrict the AWS security group to your own IP address where practical.

### AWS VM Requirements

Use an Ubuntu EC2 instance with:

- Docker Engine and Docker Compose plugin installed.
- An Elastic IP associated with the instance.
- Inbound security group rules:
  - SSH `22` from your IP only.
  - HTTP `80` from your IP only, or from `0.0.0.0/0` if you want public access.
  - HTTPS `443` from your IP only, or from `0.0.0.0/0` if you want public access.
- Do not expose backend port `5001` or Vite port `5173` in production.

AWS notes that an Elastic IP is a static public IPv4 address and can be used in a DNS record for your domain. AWS security groups have no inbound rules by default, so you must add the required allow rules.

### Point `hodimoit.co.uk` to the VM

In the DNS provider that manages `hodimoit.co.uk`, create this record:

```text
Type: A
Host/Name: @
Value: <your AWS Elastic IP>
TTL: 300 or Auto
```

After DNS updates, check it from your machine:

```bash
dig hodimoit.co.uk A
```

The returned IP should match the AWS Elastic IP. Caddy needs the domain to resolve to the VM and ports `80` and `443` to be reachable before it can issue the HTTPS certificate.

### Install Docker on Ubuntu

On the EC2 instance:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

Optional, to run Docker without `sudo`:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Deploy the App

Copy or clone this project onto the VM, then run:

```bash
cd yamini
cp .env.production.example .env.production
mkdir -p data
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Check status and logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f
```

Open:

```text
https://hodimoit.co.uk
```

### Production Environment

Edit `.env.production` on the VM if you want to change the domain, certificate email, exchange rate, or allowed frontend origin:

```text
APP_DOMAIN=hodimoit.co.uk
ACME_EMAIL=admin@hodimoit.co.uk
EXCHANGE_GBP_TO_INR=120
CORS_ORIGIN=https://hodimoit.co.uk
```

### Update the App on the VM

After copying new code or pulling changes:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### Backup SQLite Data

The production database lives in `data/budget.sqlite`. Back it up before server changes:

```bash
tar -czf budget-data-backup.tgz data
```

### References

- Docker Engine Ubuntu install: https://docs.docker.com/engine/install/ubuntu/
- AWS Elastic IP documentation: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html
- AWS security group rules: https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html
- Caddy automatic HTTPS: https://caddyserver.com/docs/automatic-https

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
EXCHANGE_GBP_TO_INR=120
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
