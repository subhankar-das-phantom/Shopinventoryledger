# Reference Analysis: Bharat Enterprise vs Shop Inventory Ledger

## 1. Executive Summary
This document analyzes the reference project (`Bharat Enterprise / Billing Software`) against the technical and architectural requirements for the new `Shop Inventory Ledger` project. 

The primary distinction is architectural: the reference project evolved organically as a distributor billing application where stock was primarily an attribute on products and batches (`currentStockQty`, `remainingQty`), with an audit trail added retroactively. In contrast, **Shop Inventory Ledger** requires an **accounting-grade stock ledger** where stock is fundamentally derived from immutable movement history (`sum(inflows) - sum(outflows)`), concurrency is strictly protected against overselling at the database engine level, and idempotency guarantees retry safety.

---

## 2. Useful Reference Patterns
Several high-quality engineering practices from Bharat Enterprise provide valuable guidance:

1. **Clean Layered Architecture**:
   - Clear separation of concerns: Express routes -> Controllers -> Domain Services -> Mongoose Models.
2. **ESR Indexing & Query Optimization**:
   - Compound B-Tree index ordering (Equality -> Sort -> Range) to ensure fast query response and zero unindexed collection scans.
   - Bounded queries with pagination (`skip`/`limit` with `countDocuments`) avoiding memory exhaustion.
3. **Authentication & Role Middleware**:
   - JWT-based authentication verifying signed tokens from headers (`Bearer <token>`) and HTTP-only cookies.
   - User identity hydration (`req.user`) and role-based guard middleware (`requireRole('OWNER')`).
4. **Validation & Error Handling**:
   - Centralized error-handling middleware preventing unhandled promise rejections and stack trace leakage to clients.
   - Consistent API response envelopes (`{ success: true, data: ... }` / `{ success: false, message: ... }`).
5. **Modern Frontend Foundation**:
   - React + Vite + Tailwind CSS with Lucide icons for clean, readable operational interfaces.
   - Responsive layouts designed for both mobile and desktop screen sizes.

---

## 3. Reference Patterns That Do NOT Satisfy This Assignment

| Pattern in Reference Project | Problem / Non-Compliance | Required Assignment Behavior |
| :--- | :--- | :--- |
| **Mutable Product Stock Field** (`currentStockQty` on `Product`) | Stock is directly stored and updated as a primary field. History was an array of subdocuments or a secondary mirror. | **Movement history is authoritative.** Product catalog contains metadata only. Balance projection is derived and must be verified/reconstructable via ledger summation. |
| **Check-then-Act Race Condition in Allocations** (`if (available < qty) throw; await Product.updateOne(...)`) | Two concurrent requests can read identical stock simultaneously, pass the check, and both decrement, creating negative stock (overselling). | **Guarded Atomic Operations** (`$inc` guarded with `{ balance: { $gte: qty } }`) executed within a database transaction or atomic boundary. Rollback on guard failure. |
| **Multi-Tenant Complexity** (`tenantId` across all collections, dual Admin/Employee models) | Overhead of multi-tenant distributor SaaS adds unnecessary schema noise and complex model references. | **Clean Single-Shop Model** with unified `User` model supporting exactly two roles: `OWNER` and `STAFF`. |
| **Missing Request Idempotency** | Repeating a network call (e.g. timeout retry) creates duplicate sales or duplicate inventory deductions. | **Idempotency Key Mechanism** on stock-changing POST endpoints returning original results on safe retry and rejecting duplicate payloads. |
| **Ad-Hoc Movement Types** | Over 11 loosely typed event names (`invoice`, `invoice_edit`, `invoice_cancelled`, `opening`, etc.). | **Strict Finite State Machine**: Exactly `PURCHASE_IN`, `SALE_OUT`, `RETURN_IN`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`. |
| **Client-Side CSV Formatting / Formula Vulnerabilities** | Generating CSVs without strict formula escaping (`=`, `+`, `-`, `@`) exposes Excel/Sheets users to CSV injection. | **Server-side CSV export** with RFC 4180 compliance, sanitization against formula injection, and owner-only authorization. |

---

## 4. What Will Be Reused Conceptually
1. **JWT Authentication & Authorization Pattern**:
   - Secure password hashing with `bcryptjs`.
   - Bearer token / cookie authentication with express middleware checking active status.
2. **Centralized Error Handling**:
   - Uniform error response schema with safe HTTP status codes (400, 401, 403, 404, 409, 500).
3. **Compound Database Indexing Strategies**:
   - Efficient indexing for `productId + createdAt` on stock movements and `currentStock <= threshold` filtering on projections.
4. **UX Patterns for Inventory Operations**:
   - Clear visual distinction between inflows (green badge, + qty) and outflows (rose/red badge, - qty).
   - High-density, accessible product tables with search, category filtering, and mobile card view fallback.

---

## 5. What Will Be Redesigned from Scratch

1. **Ledger-First Domain Engine (`StockMovementService`)**:
   - Immutable `StockMovement` records are the sole source of truth.
   - Every movement has an unambiguous direction (`IN` vs `OUT`) and magnitude (`quantity > 0`).
   - Transactional execution: Movement insertion and StockBalance projection update are coupled atomically.
   - Built-in audit function `reconstructStock(productId)` that computes `sum(inflows) - sum(outflows)` via MongoDB aggregation pipeline and validates projection parity.
2. **Guarded Atomic Concurrency & Negative Stock Rejection**:
   - Stock deduction executes a conditional update where `availableQuantity >= requestedQuantity`. If 0 documents are modified, the transaction aborts with a 409/422 Insufficient Stock error.
   - Zero negative stock can ever be committed, even under high concurrency.
3. **Idempotency Layer**:
   - Idempotency key tracking table storing request hash, response status, and response body.
   - Repeated requests with the identical key within expiry return the cached response; mismatched payloads return a 409 Conflict.
4. **Unified User & Permission System**:
   - Single `User` model with `role: 'OWNER' | 'STAFF'`.
   - Server-side route authorization middleware rejecting unauthorized operations at the controller gate.
5. **Modern Full-Stack TypeScript Architecture**:
   - Strict typing across backend models, services, controllers, and frontend queries.
   - Zod validation schemas validating all request payloads before hitting database services.

---

## 6. Assumptions & Technical Environment Notes
- **Local MongoDB Environment**: Local Windows MongoDB service is running (port 27017). Standalone local MongoDB does not support multi-document replica-set transactions unless replica set is enabled or `mongodb-memory-server` is utilized.
- **Testing Strategy**: Backend integration tests will utilize an isolated test database (using `mongodb-memory-server` or an isolated test DB URI) to guarantee tests run reliably, test real concurrency, and never touch production or development data.
- **Stock Balance Projection**: Stored in a dedicated `StockBalance` collection (or dedicated projection document) transactionally paired with movements, never directly editable by users.
