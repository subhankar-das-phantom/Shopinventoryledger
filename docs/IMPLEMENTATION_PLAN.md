# Implementation Plan: Shop Inventory Ledger

## 1. Architecture Overview

Shop Inventory Ledger is a full-stack, accounting-grade inventory management application designed for small shop operations. The system is architected around an **event-sourced ledger principle**: physical stock is never directly modified as an independent variable; instead, immutable stock movement records represent every change in inventory, and current stock is derived as `sum(inflows) - sum(outflows)`.

```
┌─────────────────────────────────────────────────────────────┐
│                       Frontend (React + Vite + TS + Tailwind)│
│  - Dashboard, Product Catalog, Movement History, Forms      │
│  - Role-aware UI (Owner vs Staff), Responsive Phone/Desktop │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON / Cookies / JWT
┌──────────────────────────────▼──────────────────────────────┐
│                    Express Backend API (Node.js + TS)       │
│  - Auth & Role Middleware (Owner / Staff guards)            │
│  - Zod Request Validation & Sanitization                    │
│  - Idempotency Gatekeeper (Payload Hash Check)              │
│  - StockMovement Domain Service                             │
└──────────────────────────────┬──────────────────────────────┘
                               │ MongoDB Driver (Mongoose)
┌──────────────────────────────▼──────────────────────────────┐
│                    MongoDB Data Layer                       │
│  - Users (Owner, Staff)                                     │
│  - Products (Metadata: SKU, Name, Unit, Price, Threshold)   │
│  - StockMovements (Immutable ledger of all IN/OUT events)   │
│  - StockBalances (Derived projection with guarded atomic inc)│
│  - IdempotencyKeys (Scoped request deduplication)           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Data Models

### 2.1 User Model
- `_id`: ObjectId
- `name`: String (trimmed, required)
- `email`: String (lowercase, trimmed, unique, required)
- `passwordHash`: String (bcrypt, salt rounds 10, excluded by default)
- `role`: Enum `['OWNER', 'STAFF']` (required)
- `isActive`: Boolean (default true)
- `createdAt`, `updatedAt`: Timestamps

### 2.2 Product Model (Metadata Catalog)
- `_id`: ObjectId
- `sku`: String (uppercase, trimmed, unique, required, indexed)
- `name`: String (trimmed, required)
- `category`: String (trimmed, required)
- `unit`: String (e.g. 'pcs', 'kg', 'box', 'bottle', default 'pcs')
- `price`: Number (min 0, required)
- `lowStockThreshold`: Number (min 0, default 5)
- `isActive`: Boolean (default true, indexed)
- `createdAt`, `updatedAt`: Timestamps
- *Note*: No mutable stock quantity in the product model!

### 2.3 StockMovement Model (The Source of Truth)
- `_id`: ObjectId
- `movementId`: String (unique UUID / nanoid for external audit reference)
- `productId`: ObjectId (ref Product, required, indexed)
- `type`: Enum `['PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT']`
- `direction`: Enum `['IN', 'OUT']` (derived unambiguously from type)
- `quantity`: Number (strictly positive integer/float > 0)
- `reason`: String (required description)
- `reference`: String (optional invoice #, PO #, RMA #)
- `movementDate`: Date (effective business date, default now)
- `actorId`: ObjectId (ref User, required)
- `idempotencyKey`: String (optional, indexed)
- `metadata`: Schema.Types.Mixed (optional audit metadata)
- `createdAt`: Date (immutable timestamp)

### 2.4 StockBalance Model (High-Performance Derived Projection)
- `_id`: ObjectId
- `productId`: ObjectId (ref Product, unique index)
- `currentStock`: Number (non-negative, default 0)
- `lastMovementId`: ObjectId (ref StockMovement)
- `version`: Number (optimistic concurrency version)
- `updatedAt`: Date

### 2.5 IdempotencyKey Model
- `key`: String (unique within user/operation scope)
- `userId`: ObjectId
- `endpoint`: String
- `requestHash`: String (SHA-256 of canonical request payload)
- `statusCode`: Number
- `responseBody`: Schema.Types.Mixed
- `createdAt`: Date (with TTL index for expiration)

---

## 3. Concurrency Safety & Invariant Guarantees

### 3.1 Guarded Atomic Mutation Strategy
To satisfy the requirement that two concurrent sales competing for the last item cannot both succeed:
1. When processing an outflow (`SALE_OUT`, `ADJUSTMENT_OUT`):
   - We execute a conditional atomic update on `StockBalance`:
     ```typescript
     const balanceDoc = await StockBalance.findOneAndUpdate(
       { productId, currentStock: { $gte: quantity } },
       { 
         $inc: { currentStock: -quantity, version: 1 },
         $set: { updatedAt: new Date() }
       },
       { new: true, session }
     );
     ```
   - If `balanceDoc === null`, stock is insufficient. The operation fails immediately with `409 Conflict / 422 Unprocessable Entity` ("Insufficient stock available").
2. Insert the corresponding `StockMovement` within the same transaction/session.
3. If database transactions are supported (replica set / in-memory replica set), both are committed together; on any error, both abort.
4. If standalone MongoDB without replica set is encountered in local dev, our service implements a compensating rollback mechanism ensuring atomic consistency.

### 3.2 Idempotency Strategy
- Client sends optional `Idempotency-Key` HTTP header.
- Before executing stock mutation, check if key exists:
  - If exists and request hash matches: return stored response immediately (safe retry).
  - If exists and request hash differs: throw `409 Conflict` ("Idempotency key reused with different payload").
  - If not exists: execute mutation and atomically persist the idempotency record.

### 3.3 Historical Reconstruction & Parity Verification
- `reconstructStock(productId)` calculates:
  ```typescript
  const [result] = await StockMovement.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: '$productId',
        totalIn: { $sum: { $cond: [{ $eq: ['$direction', 'IN'] }, '$quantity', 0] } },
        totalOut: { $sum: { $cond: [{ $eq: ['$direction', 'OUT'] }, '$quantity', 0] } }
      }
    },
    {
      $project: {
        currentStock: { $subtract: ['$totalIn', '$totalOut'] }
      }
    }
  ]);
  ```
- An automated verification method and unit test verifies that `reconstructStock(productId) === StockBalance.currentStock`.

---

## 4. API Endpoints

### Auth
- `POST /api/auth/login` - Public (rate limited)
- `POST /api/auth/logout` - Authenticated
- `GET /api/auth/me` - Authenticated

### Products
- `GET /api/products` - Authenticated (Staff & Owner)
- `GET /api/products/:id` - Authenticated
- `POST /api/products` - Owner only
- `PATCH /api/products/:id` - Owner only
- `POST /api/products/:id/deactivate` - Owner only

### Stock & Movements
- `GET /api/products/:id/movements` - Authenticated (paginated)
- `POST /api/stock-movements/sale` - Authenticated (Staff & Owner)
- `POST /api/stock-movements/return` - Authenticated (Staff & Owner)
- `POST /api/stock-movements/purchase` - Owner only
- `POST /api/stock-movements/adjustment` - Owner only
- `GET /api/stock-movements` - Authenticated (paginated filter by product, type, date)
- `GET /api/stock/low-stock` - Authenticated (Staff & Owner)
- `GET /api/stock/report.csv` - Owner only (CSV download with formula escaping)
- `GET /api/stock/verify-parity/:id` - Owner only (Verifies ledger parity)

### Staff Management
- `GET /api/staff` - Owner only
- `POST /api/staff` - Owner only
- `PATCH /api/staff/:id` - Owner only

---

## 5. Implementation Phases & Gateways

- **Phase 0 — Inspect and Plan** *(Complete)*
- **Phase 1 — Foundation**:
  - Directory structure (`backend/`, `frontend/`).
  - Backend package.json, TypeScript, tsconfig, express app, error handler, health check, DB connection.
  - Progressive git commit.
- **Phase 2 — Data Models & Stock Ledger Engine**:
  - Models (`User`, `Product`, `StockMovement`, `StockBalance`, `IdempotencyRecord`).
  - `StockMovementService` with guarded conditional updates, idempotency, and parity reconstruction.
  - Progressive git commit.
- **Phase 3 — Authentication & Authorization**:
  - Password hashing, JWT signing/verifying, auth middleware (`protect`, `requireRole('OWNER')`).
  - Auth controllers & routes.
  - Progressive git commit.
- **Phase 4 — Product and Stock APIs & Backend Tests**:
  - Product controllers, stock controllers, staff controllers, CSV export.
  - Comprehensive automated tests with Vitest/Jest (at least 7 test suites covering all required scenarios).
  - Progressive git commit.
- **Phase 5 — Frontend Application**:
  - Vite + React 19 + TypeScript + Tailwind CSS + Lucide Icons + React Router.
  - Auth context, responsive layout (mobile hamburger / bottom nav + desktop sidebar).
  - Dashboard, Product Catalog, Product Detail with Movement History, Record Sale/Return/Purchase/Adjustment modals, Low Stock view, Staff Management, CSV Export button.
  - Progressive git commit.
- **Phase 6 — Seed Data & Verification**:
  - Repeatable seed script populating Owner, Staff, and demo products across all stock levels using domain service movements.
  - Parity check verification.
  - Progressive git commit.
- **Phase 7 — Comprehensive Documentation & Quality Checks**:
  - Complete `README.md` satisfying all 22 required sections.
  - `.env.example`, `.gitignore`.
  - Full test execution & build verification.
- **Phase 8 — Final Report & Review Readiness**:
  - Final report with test results, commit history, and demo recording script.
