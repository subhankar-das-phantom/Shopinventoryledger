# Shop Inventory Ledger

[![CI Pipeline](https://github.com/subhankarmusic/Shopinventoryledger/actions/workflows/ci.yml/badge.svg)](https://github.com/subhankarmusic/Shopinventoryledger/actions/workflows/ci.yml)
[![Backend Tests](https://img.shields.io/badge/Backend%20Tests-23%20Passed-emerald.svg)](#automated-tests-and-ci-pipeline)
[![Ledger Parity](https://img.shields.io/badge/Ledger%20Parity-100%25%20Verified-blue.svg)](#data-model-and-main-design-decisions)
[![Concurrency Guard](https://img.shields.io/badge/Concurrency-Race--Free%20Guarded%20Atomic-purple.svg)](#data-model-and-main-design-decisions)
[![Node.js](https://img.shields.io/badge/Node.js-v22.15.0-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)

An accounting-grade inventory management system designed for small shop operations. The core design philosophy treats inventory as an **immutable, append-only financial ledger**: physical stock is never directly typed, modified, or overwritten by users. Instead, every inventory event is recorded as a persistent movement record, and current stock is mathematically derived as:

$$\text{Current Stock} = \sum(\text{Stock Inflows}) - \sum(\text{Stock Outflows})$$

---

## ⚡ Quick Demo Logins

The application includes pre-seeded demo accounts. The login screen also features **1-Click Quick Fill** buttons for immediate testing:

| Role | Email Address | Password | Permissions & Scope |
| :--- | :--- | :--- | :--- |
| **OWNER** | `owner@shopledger.local` | `OwnerPassword123!` | **Full administrative access**: Add/edit products, record wholesale purchases, physical inventory count adjustments, manage staff accounts, run live parity audits, export CSV reports. |
| **STAFF** | `staff@shopledger.local` | `StaffPassword123!` | **Operational access**: View product catalog, view live stock levels, record customer sales (`SALE_OUT`), record returns (`RETURN_IN`). Blocked from purchases, adjustments, staff editing, and CSV exports. |

---

## 🚀 How to Set Up and Run the Project

### 1. Prerequisites
- **Node.js**: `v18.0.0` or higher (`v22.x` recommended)
- **npm**: `v9.0.0` or higher
- **MongoDB**: Either a local MongoDB instance running on `mongodb://localhost:27017` OR a free MongoDB Atlas replica set cluster.

### 2. Clone and Install Dependencies
```bash
# Clone the repository
git clone https://github.com/subhankarmusic/Shopinventoryledger.git
cd Shopinventoryledger

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

cd ..
```

### 3. Environment Configuration
Copy the template environment configuration. **Never commit real secrets or `.env` files to git**; `.env` is already configured in `.gitignore`.

```bash
# Copy template configuration
cp .env.example backend/.env
```

Your `backend/.env` should contain:
```ini
NODE_ENV=development
PORT=5000

# Choose Local MongoDB or MongoDB Atlas:
# Local Standalone:
MONGODB_URI=mongodb://localhost:27017/shop_inventory_ledger

# Or MongoDB Atlas (enables multi-document ACID transactions):
# MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.sveiydr.mongodb.net/shop_inventory_ledger?retryWrites=true&w=majority

JWT_SECRET=super_secret_jwt_key_must_be_at_least_32_characters_long_for_security
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
```

### 4. Seed Demo Data
Populate the database with demo accounts, a 6-item grocery & staples catalog, and ledger movements:
```bash
cd backend
npm run seed
```

Verify ledger parity across all seeded items:
```bash
npm run verify
```

### 5. Run the Application

#### Terminal 1 — Backend Server
```bash
cd backend
npm run dev
```
*API running on: `http://localhost:5000` (Health check: `http://localhost:5000/api/health`)*

#### Terminal 2 — Frontend Application
```bash
cd frontend
npm run dev
```
*Web application available on: `http://localhost:5173`*

---

## 🧪 Automated Tests and CI Pipeline

### Backend Test Suite (23 Automated Tests across 5 Critical Suites)
To run all tests against an isolated in-memory MongoDB environment:
```bash
cd backend
npm test
```

### The 5 Most Important Backend Logic Suites
1. **Double-Entry Ledger & Parity Invariants** ([`backend/src/tests/stockLedger.test.ts`](backend/src/tests/stockLedger.test.ts))
   - Proves purchases increment stock and create exactly one audit movement.
   - Proves sales decrement stock and create an immutable audit record.
   - Enforces that sales exceeding available stock are rejected without changing stock or history.
   - Verifies physical adjustments calculate correct delta `IN` / `OUT`.
   - Proves that `sum(IN) - sum(OUT)` strictly matches the derived projected balance at all times.
2. **Concurrency Safety & Race Condition Protection** ([`backend/src/tests/concurrency.test.ts`](backend/src/tests/concurrency.test.ts))
   - Simulates two cashier requests hitting the server at the exact same millisecond competing for the final available item (`stock = 1`).
   - Asserts that exactly one transaction succeeds and the other receives a clean `409 Insufficient Stock` error.
   - High-concurrency stress test: 10 concurrent requests competing for 4 items correctly permits 4 and safely rejects 6 without ledger corruption or negative stock.
3. **Idempotency & Safe Network Retries** ([`backend/src/tests/idempotency.test.ts`](backend/src/tests/idempotency.test.ts))
   - Re-sending a request with an identical `Idempotency-Key` returns the cached previous result without duplicate movement creation or double-decrementing inventory.
   - Reusing an existing idempotency key with an altered payload aborts with `409 Conflict`.
4. **Role-Based Access Control (RBAC)** ([`backend/src/tests/authorization.test.ts`](backend/src/tests/authorization.test.ts))
   - Strict server-side route guards ensuring Staff accounts cannot create products, change prices, deactivate items, record purchases, adjust physical stock, create staff accounts, or export owner CSV reports.
   - Validates that unauthenticated requests are rejected with `401 Unauthorized`.
5. **Data Constraints, Valuation & CSV Formula Injection Protection** ([`backend/src/tests/productAndReports.test.ts`](backend/src/tests/productAndReports.test.ts))
   - Rejects duplicate SKUs with `409 Conflict`.
   - Protects CSV export against spreadsheet formula injection (`=`, `+`, `-`, `@`) in compliance with OWASP guidelines.
   - Validates low-stock boundary queries (`currentStock <= lowStockThreshold`).

### GitHub Actions CI Workflow
We have configured a comprehensive GitHub Actions CI pipeline in [`.github/workflows/ci.yml`](.github/workflows/ci.yml). On every push or pull request:
- Spins up a real `mongo:7.0` container.
- Installs dependencies and runs all 23 Vitest automated tests.
- Executes the database seed and ledger parity audit (`npm run verify`).
- Typechecks and builds the production frontend bundle (`npm run build`).

---

## 🏛️ Data Model and Main Design Decisions

### Architectural Schema Overview
```
┌─────────────────┐       1:N       ┌──────────────────┐
│     Product     ├────────────────►│  StockMovement   │
│ (Catalog Meta)  │                 │ (Immutable Event)│
└────────┬────────┘                 └──────────────────┘
         │ 1:1                                ▲
         ▼                                    │
┌─────────────────┐                           │
│  StockBalance   │◄──────────────────────────┘
│(Derived Project)│  Updated transactionally
└─────────────────┘
```

### 1. Separation of Catalog Metadata and Inventory State
The `Product` collection only holds static catalog attributes: `sku`, `name`, `category`, `unit`, `price`, `costPrice`, `lowStockThreshold`, and `isActive`. **There is no mutable `stock` field on the Product model.** This eliminates field mutation vulnerabilities.

### 2. Immutable Stock Movement Ledger
The `StockMovement` collection is an append-only ledger. Records can never be updated or deleted:
- `movementId`: Unique nanoid tracking code.
- `productId`: Foreign key to `Product`.
- `type`: `PURCHASE_IN`, `SALE_OUT`, `RETURN_IN`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`.
- `direction`: Strictly `IN` (adds stock) or `OUT` (reduces stock).
- `quantity`: Strictly positive number (`> 0`).
- `reason`, `reference`, `actorId`, `movementDate`, `idempotencyKey`.

### 3. Guarded Atomic Balance Projections
To eliminate expensive real-time aggregations on high-frequency read paths, `StockBalance` stores a materialized projection of current stock.
To prevent overselling and race conditions without performance bottlenecks, all decrements use **database-level guarded atomic updates**:
```typescript
const updatedBalance = await StockBalance.findOneAndUpdate(
  {
    productId: pId,
    currentStock: { $gte: quantity } // Atomic conditional guard
  },
  {
    $inc: { currentStock: -quantity, version: 1 },
    $set: { lastMovementId: movement.movementId, updatedAt: new Date() }
  },
  { new: true, session }
);

if (!updatedBalance) {
  throw new AppError('Insufficient stock available for this sale.', 409);
}
```
If two requests race for the final item, MongoDB locks the document at the engine level. The first request decrements stock from 1 to 0; the second request evaluates `0 >= 1`, fails the match, modifies zero documents, and immediately returns a `409` conflict error.

### 4. Hybrid Transaction Support (Replica Sets vs. Standalone)
- When connected to a replica set (MongoDB Atlas, Docker replica sets, or `mongodb-memory-server`), all balance updates and movement insertions run inside a multi-document **ACID transaction** (`session.withTransaction`).
- When running against a standalone local MongoDB instance without replica sets, the service employs guarded atomic updates with **compensating atomic rollback** if the subsequent ledger entry fails.

### 5. ESR Compound Indexing
Compound B-tree indexes (`productId: 1, movementDate: -1, _id: -1`) ensure all ledger queries satisfy MongoDB's **Equality, Sort, Range (ESR)** rule, preventing collection scans.

---

## 🔒 Security & Environment Settings

**Rule**: Never commit secrets or credentials to git. All sensitive settings are loaded from `.env` (which is gitignored).

A documented [`.env.example`](.env.example) is provided at the repository root and in [`backend/.env.example`](backend/.env.example) describing all required settings:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | `development` |
| `PORT` | Backend API port | `5000` |
| `MONGODB_URI` | MongoDB connection URI (local or Atlas replica set) | `mongodb://localhost:27017/shop_inventory_ledger` |
| `JWT_SECRET` | Cryptographic secret for signing session JWTs (min 32 chars) | Random 32+ character string |
| `JWT_EXPIRES_IN` | Token expiration duration | `7d` |
| `FRONTEND_URL` | Allowed origin for CORS headers | `http://localhost:5173` |

---

## 📊 What is Finished, What Isn't, and What I Would Do with More Time

### ✅ What is Finished
- **Authoritative Double-Entry Ledger Engine**: Full implementation of immutable `StockMovement` records and derived `StockBalance` projections.
- **Race-Free Concurrency Guard**: Guarded conditional atomic decrements preventing overselling under high concurrency.
- **Idempotent Movement Recording**: HTTP `Idempotency-Key` tracking and replay caching for safe mobile/network retries.
- **Role-Based Access Control (RBAC)**: Complete server-side role separation between `OWNER` (full admin) and `STAFF` (pos/sales only).
- **Automated Test Coverage**: 23 comprehensive tests covering race conditions, domain invariants, idempotency, RBAC, and data validation.
- **Continuous Integration (CI)**: GitHub Actions workflow testing and building the full stack with live MongoDB service.
- **Audit Parity Verification**: On-demand CLI (`npm run verify`) and API verification comparing ledger sums against projected balances.
- **High-Density SaaS Frontend**: Premium obsidian UI matching Bharat Enterprise aesthetic with KPI cards, segmented stock filters, dynamic category pill selector, instant debounced search, and zero-page-reload reactive updates.
- **Formula-Injection Safe CSV Export**: Owner export compliant with RFC 4180 that neutralizes spreadsheet formula execution vulnerabilities (`=`, `+`, `-`, `@`).

### ⏳ What Isn't Finished
- **Batch / Expiry Date (FIFO / FEFO) Allocation**: Tracking batch lots and expiring dates for perishable goods.
- **Multi-Warehouse / Location Tracking**: Partitioning inventory movements across multiple branch stores or warehouses.
- **Hardware POS Integration**: Native thermal receipt printer drivers (ESC/POS) and direct cash drawer kick-triggers.

### 🔮 What I Would Do with More Time
1. **Hardware Barcode & QR Scanner Integration**: Add live camera-based barcode scanning using WebAssembly / `html5-qrcode` to allow mobile cashier scanning.
2. **WebSockets / Server-Sent Events (SSE)**: Push real-time balance updates to all cashier screens instantly when a sale or purchase is posted by another terminal.
3. **Automated Purchase Order Generation**: When stock falls below `lowStockThreshold`, automatically draft PDF purchase orders to suppliers.
4. **Offline PWA Sync**: Service Worker with IndexedDB queue allowing cashiers to record offline sales during internet outages, syncing back to the ledger with idempotency keys upon reconnection.

---

## 🤖 Which AI Tools Were Used and What For

During the engineering of this system, **Google Antigravity (Advanced Agentic AI Assistant)** was utilized as an interactive pair-programming partner:

1. **Architecture & Schema Design**:
   - Formulating the mathematical invariants between immutable double-entry movements and derived balance projections.
   - Structuring the guarded atomic query syntax (`$gte` conditional `$inc`) to prevent race conditions at the database engine level.
2. **Automated Test Generation**:
   - Crafting high-concurrency race condition tests (`concurrency.test.ts`) using `Promise.all` and `Promise.allSettled` to prove that concurrent sales for the last item cannot oversell.
   - Setting up isolated `mongodb-memory-server` testing environments.
3. **Design Aesthetic & De-Vibecoding**:
   - Inspecting and replicating the high-density layout, KPI summary cards, and flat obsidian color palette from the reference Bharat Enterprise billing system.
   - Eliminating generic templates, gradients, and capsule buttons in favor of restrained, state-of-the-art enterprise typography and contrast.
4. **End-to-End Browser Automation**:
   - Using the headless browser subagent to execute real user flows (logging in, creating products with brand-new categories, testing instant reactive catalog updates without page reload, and auditing dashboard charts).

---

## 🌐 Live Demo & Deployment

- **Local Development URL**: `http://localhost:5173` (Frontend) & `http://localhost:5000` (Backend API)
- **Production Deployment Instructions**:
  1. Provision a free M0 cluster on [MongoDB Atlas](https://www.mongodb.com/atlas) (replica set enabled by default).
  2. Deploy the backend to [Render](https://render.com) or [Railway](https://railway.app):
     - Build Command: `npm install && npm run build`
     - Start Command: `npm start`
     - Environment Variables: `NODE_ENV=production`, `PORT=5000`, `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`.
  3. Deploy the frontend to [Vercel](https://vercel.com) or [Netlify](https://netlify.com):
     - Build Command: `npm run build`
     - Output Directory: `dist`
     - Environment Variable: `VITE_API_URL=https://your-backend-api.onrender.com/api`
