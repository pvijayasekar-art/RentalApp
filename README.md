# 🏠 Rental Management System

A full-stack rental property management application with MySQL persistence, containerized with Docker. Built with React + Node.js/Express.

---

## 📁 Project Structure

```
rental-app/
├── backend/
│   ├── server.js          # Express API server
│   ├── schema.sql         # MySQL database schema + sample data
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Complete React app (all pages)
│   │   └── main.jsx       # Entry point
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml     # Docker orchestration
├── .env                   # Environment variables
└── README.md
```

---

## 🚀 Quick Start with Docker (Recommended)

### Prerequisites
- Docker Desktop installed and running
- Docker Compose

### Run the Application

```bash
# Navigate to project
cd rental-app

# Start all services (MySQL, Backend, Frontend)
docker-compose up -d

# Wait for MySQL to initialize (about 30 seconds on first run)
# Then access the application:
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
```

### Stop the Application

```bash
docker-compose down

# To remove all data including database:
docker-compose down -v
```

---

## 🛠️ Manual Setup (Without Docker)

### 1. MySQL Database

```bash
# Log into MySQL
mysql -u root -p

# Run the schema (creates DB, tables, and sample data)
source /path/to/rental-app/backend/schema.sql
```

### 2. Backend (Node.js + Express)

```bash
cd backend
npm install

# Configure environment variables
cp ../.env.example .env
# Edit .env with your MySQL credentials

npm start
```

The API server runs on **http://localhost:5000**

### 3. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

The app opens at **http://localhost:3000**

---

## 🌟 Features

| Page | Features |
|------|----------|
| **Dashboard** | KPI stats, collection trend chart, recent activity |
| **Properties** | Add/edit/delete properties, type, status, rent per unit |
| **Tenants** | Full details with Aadhar & PAN IDs, lease dates, security deposit |
| **Collections** | Rent tracking with UPI/NEFT/Cash/Cheque, month-wise, reference numbers |
| **Expenses** | Categorized expenses (maintenance, utilities, taxes, etc.) per property |

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Dashboard stats & recent activity |
| GET/POST | `/api/properties` | List / create properties |
| GET/PUT/DELETE | `/api/properties/:id` | Read / update / delete |
| GET/POST | `/api/tenants` | List / create tenants |
| GET/PUT/DELETE | `/api/tenants/:id` | Read / update / delete |
| GET/POST | `/api/collections` | List / create rent collections |
| GET/PUT/DELETE | `/api/collections/:id` | Read / update / delete |
| GET/POST | `/api/expenses` | List / create expenses |
| GET/PUT/DELETE | `/api/expenses/:id` | Read / update / delete |

---

## ⚙️ Environment Variables

```env
# Database Configuration
DB_HOST=localhost        # Use 'mysql' for Docker, 'localhost' for local
DB_USER=root
DB_PASS=rentalpass123
DB_NAME=rental_db

# Backend
PORT=5000

# Frontend
VITE_API_URL=http://localhost:5000/api
```

---

## 🐳 Docker Commands Reference

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f mysql

# Restart service
docker-compose restart backend

# Execute MySQL shell
docker-compose exec mysql mysql -uroot -prentalpass123 rental_db
```

---

## 💰 Currency

All monetary values are stored and displayed in **Indian Rupees (₹ INR)**.

---

## 🛡️ Tenant ID Storage

- **Aadhar Number** — stored as VARCHAR, formatted `XXXX XXXX XXXX`
- **PAN Number** — stored as VARCHAR, formatted `ABCDE1234F`
- Both are searchable from the Tenants page
