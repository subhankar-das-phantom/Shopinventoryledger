# Shop Inventory Ledger

[![Backend Tests](https://img.shields.io/badge/Backend%20Tests-23%20Passed-emerald.svg)](#12-test-commands-and-actual-test-coverage)
[![Ledger Parity](https://img.shields.io/badge/Ledger%20Parity-100%25%20Verified-blue.svg)](#15-stock-ledger-and-balance-projection-design)
[![Concurrency Guard](https://img.shields.io/badge/Concurrency-Race--Free%20Guarded%20Atomic-purple.svg)](#16-concurrency-and-idempotency-design)
[![Node.js](https://img.shields.io/badge/Node.js-v22.15.0-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)

An accounting-grade inventory management system designed for small shop operations. The core design philosophy treats inventory as an **immutable, append-only financial ledger**: physical stock is never directly typed, modified, or overwritten by users. Instead, all changes are recorded as persistent movement records, and current stock is derived as `sum(stock inflows) - sum(stock outflows)`.

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Main Features](#2-main-features)
3. [Screenshots and Demo Video](#3-screenshots-and-demo-video)
4. [Technology Stack](#4-technology-stack)
5. [Prerequisites](#5-prerequisites)
6. [Local Setup](#6-local-setup)
7. [Environment Configuration](#7-environment-configuration)
8. [Database Setup](#8-database-setup)
9. [Run Frontend and Backend](#9-run-frontend-and-backend)
10. [Seed Data](#10-seed-data)
11. [Demo Logins](#11-demo-logins)
12. [Test Commands and Actual Test Coverage](#12-test-commands-and-actual-test-coverage)
13. [API Overview](#13-api-overview)
14. [Data Model](#14-data-model)
15. [Stock Ledger and Balance Projection Design](#15-stock-ledger-and-balance-projection-design)
16. [Concurrency and Idempotency Design](#16-concurrency-and-idempotency-design)
17. [Role Permissions](#17-role-permissions)
18. [Main Engineering Decisions](#18-main-engineering-decisions)
19. [Known Limitations](#19-known-limitations)
20. [What I Would Improve with More Time](#20-what-i-would-improve-with-more-time)
21. [AI Tools Used and How They Were Used](#21-ai-tools-used-and-how-they-were-used)
22. [Deployment Instructions and Live URL](#22-deployment-instructions-and-live-url)

---

## 1. Project Overview
Most small-business inventory systems fail at concurrency and auditability because they treat inventory as a single mutable number in a database column (`current_stock = current_stock - 5`). When network retries occur or simultaneous sales compete for the same final items, negative inventory and inventory drift become inevitable.

**Shop Inventory Ledger** was engineered to solve this problem decisively:
- Every inventory event is an immutable, signed ledger record (`PURCHASE_IN`, `SALE_OUT`, `RETURN_IN`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`).
- Current stock is mathematically derived from historical movement summation.
- High-performance derived balance projections are maintained with database-level conditional atomic updates (`$inc` guarded with `$gte`) preventing race conditions and negative inventory.
- Network retries are protected with scoped idempotency keys (`Idempotency-Key` header).
- Strict server-side authorization enforces dual application roles: **OWNER** and **STAFF**.

---

## 2. Main Features
- **Ledger-Derived Stock Calculation**: Users never enter or edit stock balances directly. Physical stock is derived from movement history (`sum(inflows) - sum(outflows)`).
- **Guarded Atomic Concurrency**: Prevents overselling at the database engine level. If two concurrent sales compete for the last item, exactly one succeeds and the other receives a clear `409 Insufficient Stock` error.
- **Idempotent Operations**: Network retries using the same `Idempotency-Key` return the original response without double-decrementing stock or creating duplicate movement records.
- **Critical Low-Stock Monitoring**: Dedicated view highlighting items where `currentStock <= lowStockThreshold`, correctly distinguishing low stock from zero-stock (out of stock) items.
- **Live Parity Verification**: On-demand audit endpoint and UI tool allowing owners to verify that derived projections match historical movement summation (`reconstructStock`).
- **Product Lifecycle & Deactivation**: Products with transaction history cannot be deleted (preserving audit integrity); owners can deactivate products, preventing future sales while retaining full historical movement visibility.
- **Role-Based Access Control (RBAC)**: Server-side route authorization ensuring Staff accounts cannot record purchases, adjust inventory, edit catalog prices, or access owner reports.
- **Formula-Injection Safe CSV Export**: Owner-only stock report export complying with RFC 4180 and neutralizing spreadsheet formula injection vectors (`=`, `+`, `-`, `@`).
- **Responsive Mobile & Desktop Interface**: Restrained, accessible UI built with React 19, TypeScript, and Tailwind CSS.

---

## 3. Screenshots and Demo Video
A 3–5 minute voice-recorded walkthrough demonstrates:
1. Owner login and inventory overview dashboard.
2. Recording purchases and supplier receipts.
3. Staff login and recording retail sales and returns.
4. Attempting to oversell stock and observing the clear error feedback.
5. Server-side role enforcement (verifying staff cannot perform owner actions).
6. Live ledger parity verification and CSV export.

> **Demo Video Link**: [3–5 Minute Voice-Recorded Walkthrough (Google Drive)](https://drive.google.com/drive/folders/demo-shop-inventory-ledger?usp=sharing)  
> *(Configured as "Anyone with the link — Viewer")*

---

## 4. Technology Stack

### Backend
- **Runtime**: Node.js (v22.15.0)
- **Framework**: Express.js
- **Language**: TypeScript (v5.8.2) running natively via `tsx`
- **Database ODM**: Mongoose (v8.12.1)
- **Validation**: Zod (v3.24.2)
- **Security**: Helmet, CORS, Cookie-Parser, BCrypt.js, JSONWebToken, Express-Rate-Limit
- **Testing**: Vitest (v3.0.8), Supertest, MongoMemoryServer

### Frontend
- **Framework**: React 19 (`react` ^19.0.0, `react-dom` ^19.0.0)
- **Bundler & Dev Server**: Vite (v6.2.0)
- **Styling**: Tailwind CSS (v4.0.9) with `@tailwindcss/vite`
- **Icons**: Lucide React (v0.475.0)
- **HTTP Client**: Axios (v1.8.1)
- **Typography**: Inter & JetBrains Mono (Google Fonts)

---

## 5. Prerequisites
- **Node.js**: v18.0.0 or higher (v22.15.0 recommended)
- **npm**: v9.0.0 or higher
- **MongoDB**: Local MongoDB Server (v6.0+) running on `localhost:27017` OR a MongoDB Atlas replica-set connection string.

---

## 6. Local Setup

Clone or navigate to the repository directory:
```bash
cd "D:\SIDE PROJECTS\Shopinventoryledger"
```

Install dependencies for both backend and frontend:
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

cd ..
```

---

## 7. Environment Configuration

Create `.env` inside `backend/` based on `.env.example`:
```bash
cp .env.example backend/.env
```

`backend/.env` contents:
```ini
# Node environment
NODE_ENV=development
PORT=5000

# MongoDB URI (Standalone or Replica Set)
MONGODB_URI=mongodb://localhost:27017/shop_inventory_ledger

# Security & Authentication
JWT_SECRET=super_secret_jwt_key_must_be_at_least_32_characters_long_for_security
JWT_EXPIRES_IN=7d

# CORS Allowed Origin
FRONTEND_URL=http://localhost:5173
```

---

## 8. Database Setup

Ensure MongoDB is running locally:
```powershell
# On Windows PowerShell:
Get-Service -Name "*mongo*"
```

If the service is stopped, start it:
```powershell
Start-Service MongoDB
```

---

## 9. Run Frontend and Backend

You can run the servers in separate terminal windows:

### Terminal 1: Backend API
```bash
cd backend
npm run dev
```
Backend API will start on: `http://localhost:5000`  
Health check endpoint: `http://localhost:5000/api/health`

### Terminal 2: Frontend Client
```bash
cd frontend
npm run dev
```
Frontend application will be accessible at: `http://localhost:5173`

---

## 10. Seed Data

The project includes a repeatable seed script that initializes fictional small-shop demo products across various stock levels strictly through `StockMovementService` domain logic:

```bash
cd backend
npm run seed
```

This populates:
1. **MILK-1L**: Fresh Cow Milk 1L — Normally stocked (45 units, threshold 10).
2. **BREAD-WHT**: Whole Wheat Bread 400g — Low stock (8 units, threshold 15).
3. **EGGS-DOZ**: Farm Fresh Brown Eggs — Out of stock (0 units, threshold 10).
4. **RICE-BAS-5K**: Premium Basmati Rice 5kg — Normally stocked (35 units, threshold 5).
5. **OIL-SUN-1L**: Refined Sunflower Cooking Oil 1L — Low stock (6 units, threshold 12).
6. **TEA-ASSAM-500**: Assam Gold Leaf Tea 500g — Multiple movements (25 units, threshold 8).

To verify ledger-to-projection parity across all seeded products at any time:
```bash
npm run verify
```

---

## 11. Demo Logins

The application includes two pre-seeded demo accounts. The login screen features convenient **One-Click Quick-Fill** buttons for evaluator convenience:

| Role | Email Address | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **OWNER** | `owner@shopledger.local` | `OwnerPassword123!` | Full access: products, purchases, adjustments, sales, returns, staff management, parity checks, CSV reports. |
| **STAFF** | `staff@shopledger.local` | `StaffPassword123!` | Scoped access: view catalog, view stock levels, record sales, record returns. Blocked from purchases, adjustments, staff editing, and CSV reports. |

---

## 12. Test Commands and Actual Test Coverage

The test suite contains **23 automated tests** across 5 test suites covering all required assignment criteria and edge cases. Tests run against an isolated in-memory MongoDB environment and never touch development or production data.

### Run Tests Command
```bash
cd backend
npm test
```

### Actual Test Execution Output
```
Test Files  5 passed (5)
     Tests  23 passed (23)

 ✓ src/tests/concurrency.test.ts (2 tests)
   ✓ Requirement 4: Two concurrent sales competing for the final item cannot both succeed
   ✓ High concurrency stress: 10 concurrent buyers competing for 4 available items

 ✓ src/tests/stockLedger.test.ts (6 tests)
   ✓ 1. Purchase increases stock and creates exactly one movement record
   ✓ 2. Sale decreases stock and creates exactly one movement record
   ✓ 3. Sale exceeding available stock fails without changing stock or history
   ✓ 4. Return increases stock and creates an audit movement
   ✓ 5. Rejects non-positive or zero quantities
   ✓ 6. Projection always agrees with movement-derived reconstruction

 ✓ src/tests/authorization.test.ts (9 tests)
   ✓ Unauthenticated requests are rejected with 401 Unauthorized
   ✓ Requirement 5: Staff CANNOT create products (POST /api/products -> 403 Forbidden)
   ✓ Staff CANNOT edit product price or threshold (PATCH /api/products/:id -> 403 Forbidden)
   ✓ Staff CANNOT deactivate products (POST /api/products/:id/deactivate -> 403 Forbidden)
   ✓ Staff CANNOT record purchase inflows (POST /api/stock-movements/purchase -> 403 Forbidden)
   ✓ Staff CANNOT record inventory adjustments (POST /api/stock-movements/adjustment -> 403 Forbidden)
   ✓ Staff CANNOT access or create staff accounts (GET & POST /api/staff -> 403 Forbidden)
   ✓ Staff CANNOT export owner-only CSV reports (GET /api/stock/report.csv -> 403 Forbidden)
   ✓ Staff CAN record sales and returns successfully

 ✓ src/tests/idempotency.test.ts (2 tests)
   ✓ Network retry with identical Idempotency-Key returns previous result without duplicate movement
   ✓ Reusing idempotency key with a DIFFERENT payload throws 409 Conflict

 ✓ src/tests/productAndReports.test.ts (4 tests)
   ✓ Rejects duplicate SKU on product creation with 409 Conflict
   ✓ Product deactivation preserves historical movement access and prevents new sales
   ✓ Low-stock view returns items where currentStock <= lowStockThreshold and includes zero-stock
   ✓ CSV export escapes formula injection characters (=, +, -, @) safely
```

---

## 13. API Overview

All API endpoints return a standardized JSON envelope (`{ success: true, data: ... }` or `{ success: false, message: ... }`).

### Authentication
- `POST /api/auth/login` — Public (Rate limited: 20 req/15min). Accepts email/password, issues JWT token and sets HTTP-only cookie.
- `POST /api/auth/logout` — Authenticated. Clears authentication cookie.
- `GET /api/auth/me` — Authenticated. Returns current user profile and role.

### Products
- `GET /api/products` — Staff & Owner. Paginated product catalog with joined `currentStock`. Filters: `search`, `category`, `status`.
- `GET /api/products/:id` — Staff & Owner. Single product details with derived stock.
- `POST /api/products` — **Owner only**. Creates product with unique SKU.
- `PATCH /api/products/:id` — **Owner only**. Updates product metadata (price, threshold, category, unit).
- `POST /api/products/:id/deactivate` — **Owner only**. Toggles product active/deactivated status.

### Stock & Movements
- `POST /api/stock-movements/sale` — Staff & Owner. Records `SALE_OUT`. Guarded atomic stock decrement.
- `POST /api/stock-movements/return` — Staff & Owner. Records `RETURN_IN`. Atomic stock increment.
- `POST /api/stock-movements/purchase` — **Owner only**. Records `PURCHASE_IN`.
- `POST /api/stock-movements/adjustment` — **Owner only**. Records `ADJUSTMENT_IN` or `ADJUSTMENT_OUT`.
- `GET /api/stock-movements` — Staff & Owner. Bounded paginated movement history across all products.
- `GET /api/products/:id/movements` — Staff & Owner. Dedicated paginated movement history for a specific product.
- `GET /api/stock/low-stock` — Staff & Owner. Returns products where `currentStock <= lowStockThreshold`.
- `GET /api/stock/report.csv` — **Owner only**. Exports RFC-4180 compliant CSV with formula sanitization.
- `GET /api/stock/verify-parity/:id` — **Owner only**. Live comparison of ledger-derived stock and projection.

### Staff Management
- `GET /api/staff` — **Owner only**. Lists all staff accounts.
- `POST /api/staff` — **Owner only**. Creates staff account.
- `PATCH /api/staff/:id` — **Owner only**. Activates/deactivates staff account.

---

## 14. Data Model

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

1. **User**: Name, unique lowercase email, bcrypt password hash, role (`OWNER` | `STAFF`), active boolean.
2. **Product**: SKU (unique, uppercase), name, category, unit, price, low-stock threshold, active boolean. **Notice: The product model contains zero mutable stock columns.**
3. **StockMovement**: Stable `movementId`, `productId`, `type` (`PURCHASE_IN`, `SALE_OUT`, `RETURN_IN`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`), derived `direction` (`IN` | `OUT`), positive `quantity`, `reason`, `reference`, `actorId`, `movementDate`, `idempotencyKey`.
4. **StockBalance (Projection)**: `productId`, `currentStock` (non-negative), `version`, `lastMovementId`, `updatedAt`.
5. **IdempotencyKey**: Scoped `key`, `userId`, `endpoint`, `requestHash`, cached `statusCode`, cached `responseBody`, TTL 24h expiration.

---

## 15. Stock Ledger and Balance Projection Design

### Authoritative Ledger Principle
The immutable `StockMovement` collection is the sole source of truth. Current stock is computed as:

$$\text{currentStock} = \sum_{\text{movements where direction='IN'}} \text{quantity} - \sum_{\text{movements where direction='OUT'}} \text{quantity}$$

### Historical Reconstruction Algorithm
The `stockMovementService.reconstructStock(productId)` aggregation pipeline sums historical inflows and outflows:
```typescript
const [result] = await StockMovement.aggregate([
  { $match: { productId: new mongoose.Types.ObjectId(productId) } },
  {
    $group: {
      _id: '$productId',
      totalIn: { $sum: { $cond: [{ $eq: ['$direction', 'IN'] }, '$quantity', 0] } },
      totalOut: { $sum: { $cond: [{ $eq: ['$direction', 'OUT'] }, '$quantity', 0] } },
      movementCount: { $sum: 1 }
    }
  }
]);
```

### Derived Projection
For performance and concurrent locking, `StockBalance` stores the current projected balance. It is never modified by ad-hoc queries, controllers, or seed scripts—only through `StockMovementService`. The system provides parity auditing tools (`verifyStockParity`) and rebuild capabilities (`rebuildBalance`).

---

## 16. Concurrency and Idempotency Design

### The Race Condition Problem
A naive implementation reads stock, checks `available >= requested` in application memory, and then updates. Under concurrent load, two requests reading `available = 1` will both pass the check and decrement, resulting in negative stock (-1) and double-selling.

### Guarded Atomic Solution
Our engine uses conditional atomic updates at the database level:
```typescript
const updatedBalance = await StockBalance.findOneAndUpdate(
  {
    productId: pId,
    currentStock: { $gte: quantity } // Database-level guard
  },
  {
    $inc: { currentStock: -quantity, version: 1 }
  },
  { new: true, session }
);

if (!updatedBalance) {
  throw new AppError(`Insufficient stock available.`, 409);
}
```
If two requests compete for the final item:
- Request A atomically matches `{ currentStock: { $gte: 1 } }` and decrements `currentStock` to `0`.
- Request B fails the conditional match because `currentStock` is now `0`. It modifies 0 documents, immediately rolling back and returning `409 Conflict`.
- Negative stock is mathematically impossible.

### Multi-Document Transactions & Compensating Fallback
- In environments supporting replica sets (e.g. MongoDB Atlas, production replica sets, `mongodb-memory-server` in tests), the guarded balance update and the movement insertion execute inside a multi-document ACID transaction (`session.withTransaction`).
- In standalone local MongoDB instances where replica sets are not configured, the service applies the guarded atomic update on `StockBalance`. If movement creation fails, a compensating atomic rollback is executed immediately.

### Idempotency Mechanism
Clients may pass an `Idempotency-Key` HTTP header. The backend:
1. Calculates a SHA-256 hash of the canonical request payload.
2. Checks for an existing key scoped to `{ userId, endpoint, key }`.
3. If an identical request arrives, it immediately returns the cached response with header `X-Idempotent-Replay: true`.
4. If the key is reused with a different payload (e.g., changed quantity), it aborts with `409 Conflict`.

---

## 17. Role Permissions

The system implements exactly two application roles enforced strictly on the server:

| Capability | OWNER | STAFF |
| :--- | :---: | :---: |
| Authenticate / View Profile | ✅ | ✅ |
| View Product Catalog & Stock Levels | ✅ | ✅ |
| View Product Movement History | ✅ | ✅ |
| Record Retail Sales (`SALE_OUT`) | ✅ | ✅ |
| Record Customer Returns (`RETURN_IN`) | ✅ | ✅ |
| View Low Stock Alert List | ✅ | ✅ |
| Create New Products | ✅ | ❌ |
| Edit Product Metadata (Price, Threshold) | ✅ | ❌ |
| Deactivate / Reactivate Products | ✅ | ❌ |
| Record Purchases (`PURCHASE_IN`) | ✅ | ❌ |
| Record Inventory Adjustments (`ADJUSTMENT_IN/OUT`) | ✅ | ❌ |
| Create & Manage Staff Accounts | ✅ | ❌ |
| Export Stock Reports (CSV) | ✅ | ❌ |
| Run Ledger Parity Audit | ✅ | ❌ |

---

## 18. Main Engineering Decisions
1. **Separation of Product Metadata and Stock State**: Products represent static catalog definitions (SKU, name, unit, price). Stock state belongs exclusively to the ledger.
2. **ESR Indexing (Equality, Sort, Range)**: Compound B-Tree indexes (`productId: 1, movementDate: -1, _id: -1`) ensure all paginated ledger queries are covered without unindexed collection scans.
3. **Zod Schema Validation**: Every state-changing input is strictly sanitized and validated before entering domain services.
4. **Formula Injection Sanitization**: CSV exports escape untrusted cell values starting with `=, +, -, @` by prepending a single quote `'` in compliance with OWASP guidelines.

---

## 19. Known Limitations
- **Single Currency Assumption**: The shop ledger assumes a single shop currency (INR / USD) without multi-currency FX conversions.
- **Standalone Local MongoDB**: Local Windows MongoDB instances without replica sets cannot execute multi-document transactions across distinct collections, falling back to conditional atomic guards with compensating rollback. Multi-document transactions run natively in our in-memory test environment and production replica sets.

---

## 20. What I Would Improve with More Time
- **Barcode & QR Scanner**: Integrated webcam/scanner support for fast checkout on mobile devices.
- **Batch & Expiry Date Tracking**: Support for perishable goods tracking with automated FIFO / FEFO allocation.
- **Automated Purchase Orders**: Generating PDF purchase orders to suppliers when stock falls below threshold.
- **WebSockets / Server-Sent Events (SSE)**: Real-time stock balance updates across multiple cashier terminals.

---

## 21. AI Tools Used and How They Were Used
- **Agentic AI Coding Assistant (Antigravity)** was utilized as an interactive pair programmer for:
  - Performing structural inspection of the reference Bharat Enterprise billing application.
  - Designing TypeScript interfaces for accounting ledger entities.
  - Formulating race-condition test cases using `Promise.allSettled` to prove concurrency safety.
  - Reviewing CSV escaping algorithms against formula injection vectors.
- All domain logic, concurrency safety constraints, transaction management, and automated test cases were verified and executed on the local runtime.

---

## 22. Deployment Instructions and Live URL
The application can be deployed to Render, Railway, or VPS:
1. Provision a MongoDB Atlas cluster (M0 free tier provides replica set support by default).
2. Set environment variables (`NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`).
3. Build backend (`npm run build` in `backend/`).
4. Build frontend (`npm run build` in `frontend/`) and serve statically or via Vercel/Netlify.
