import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { generateToken } from '../middleware/auth.js';
import { stockMovementService } from '../services/stockMovementService.js';

describe('Server-Side Role-Based Authorization Guards', () => {
  const app = createApp();
  let ownerUser: any;
  let staffUser: any;
  let ownerToken: string;
  let staffToken: string;
  let product: any;

  beforeEach(async () => {
    ownerUser = await User.create({
      name: 'Owner Admin',
      email: 'owner-auth@test.local',
      passwordHash: 'dummy',
      role: 'OWNER',
      isActive: true
    });

    staffUser = await User.create({
      name: 'Staff Member',
      email: 'staff-auth@test.local',
      passwordHash: 'dummy',
      role: 'STAFF',
      isActive: true
    });

    ownerToken = generateToken(ownerUser);
    staffToken = generateToken(staffUser);

    product = await Product.create({
      sku: 'AUTH-TEST-1',
      name: 'Authorization Testing Item',
      category: 'General',
      unit: 'pcs',
      price: 50,
      lowStockThreshold: 5,
      isActive: true
    });

    await stockMovementService.ensureBalanceProjection(product._id);
  });

  it('Unauthenticated requests are rejected with 401 Unauthorized', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('Requirement 5: Staff CANNOT create products (POST /api/products -> 403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        sku: 'NEW-PROD-STAFF',
        name: 'Unauthorized Product',
        category: 'Test',
        unit: 'pcs',
        price: 99
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Forbidden: Access restricted to OWNER/i);
  });

  it('Staff CANNOT edit product price or threshold (PATCH /api/products/:id -> 403 Forbidden)', async () => {
    const res = await request(app)
      .patch(`/api/products/${product._id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        price: 10
      });

    expect(res.status).toBe(403);
  });

  it('Staff CANNOT deactivate products (POST /api/products/:id/deactivate -> 403 Forbidden)', async () => {
    const res = await request(app)
      .post(`/api/products/${product._id}/deactivate`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it('Staff CANNOT record purchase inflows (POST /api/stock-movements/purchase -> 403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/stock-movements/purchase')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        productId: product._id.toString(),
        quantity: 20,
        reason: 'Staff illegal purchase attempt'
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Forbidden/i);
  });

  it('Staff CANNOT record inventory adjustments (POST /api/stock-movements/adjustment -> 403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/stock-movements/adjustment')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        productId: product._id.toString(),
        type: 'ADJUSTMENT_IN',
        quantity: 5,
        reason: 'Staff illegal adjustment attempt'
      });

    expect(res.status).toBe(403);
  });

  it('Staff CANNOT access or create staff accounts (GET & POST /api/staff -> 403 Forbidden)', async () => {
    const getRes = await request(app)
      .get('/api/staff')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(getRes.status).toBe(403);

    const postRes = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: 'Hacker',
        email: 'hacker@test.local',
        password: 'Password123!',
        role: 'OWNER'
      });
    expect(postRes.status).toBe(403);
  });

  it('Staff CANNOT export owner-only CSV reports (GET /api/stock/report.csv -> 403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/stock/report.csv')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it('Staff CAN record sales and returns successfully', async () => {
    // Owner adds stock first
    await stockMovementService.recordStockMovement({
      productId: product._id,
      type: 'PURCHASE_IN',
      quantity: 15,
      reason: 'Stocking',
      actorId: ownerUser._id
    });

    // Staff records sale
    const saleRes = await request(app)
      .post('/api/stock-movements/sale')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        productId: product._id.toString(),
        quantity: 3,
        reason: 'Counter sale by staff',
        reference: 'REC-001'
      });

    expect(saleRes.status).toBe(201);
    expect(saleRes.body.data.currentStock).toBe(12);

    // Staff records return
    const returnRes = await request(app)
      .post('/api/stock-movements/return')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        productId: product._id.toString(),
        quantity: 1,
        reason: 'Item return processed by staff',
        reference: 'RET-001'
      });

    expect(returnRes.status).toBe(201);
    expect(returnRes.body.data.currentStock).toBe(13);
  });

  it('User preferences (theme) can be updated and are persisted in the user model', async () => {
    // 1. Initial state defaults to dark
    const meRes1 = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(meRes1.status).toBe(200);
    expect(meRes1.body.data.user.preferences.theme).toBe('dark');

    // 2. Update to light mode
    const patchRes = await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ theme: 'light' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.preferences.theme).toBe('light');

    // 3. Subsequent /me request reflects the updated theme in user model
    const meRes2 = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(meRes2.status).toBe(200);
    expect(meRes2.body.data.user.preferences.theme).toBe('light');
  });
});
