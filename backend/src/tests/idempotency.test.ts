import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { StockBalance } from '../models/StockBalance.js';
import { generateToken } from '../middleware/auth.js';
import { stockMovementService } from '../services/stockMovementService.js';

describe('Idempotency & Safe Network Retries', () => {
  const app = createApp();
  let ownerUser: any;
  let ownerToken: string;
  let product: any;

  beforeEach(async () => {
    ownerUser = await User.create({
      name: 'Idempotency Owner',
      email: 'owner-idem@test.local',
      passwordHash: 'dummy',
      role: 'OWNER',
      isActive: true
    });

    ownerToken = generateToken(ownerUser);

    product = await Product.create({
      sku: 'IDEM-TEST-1',
      name: 'Idempotent Testing Product',
      category: 'General',
      unit: 'pcs',
      price: 200,
      lowStockThreshold: 5,
      isActive: true
    });

    // Initial stock: 50 items
    await stockMovementService.recordStockMovement({
      productId: product._id,
      type: 'PURCHASE_IN',
      quantity: 50,
      reason: 'Initial stock',
      actorId: ownerUser._id
    });
  });

  it('Network retry with identical Idempotency-Key returns previous result without duplicate movement', async () => {
    const key = 'req_idempotent_test_unique_123';
    const payload = {
      productId: product._id.toString(),
      quantity: 5,
      reason: 'Sale with idempotency key',
      reference: 'INV-IDEM-01'
    };

    // First request
    const firstRes = await request(app)
      .post('/api/stock-movements/sale')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', key)
      .send(payload);

    expect(firstRes.status).toBe(201);
    expect(firstRes.body.data.currentStock).toBe(45);

    // Initial movement count should be 2 (1 purchase + 1 sale)
    const movementsAfterFirst = await StockMovement.find({ productId: product._id });
    expect(movementsAfterFirst.length).toBe(2);

    // Simulated network retry with identical payload and key
    const secondRes = await request(app)
      .post('/api/stock-movements/sale')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', key)
      .send(payload);

    expect(secondRes.status).toBe(201);
    expect(secondRes.headers['x-idempotent-replay']).toBe('true');
    expect(secondRes.body.data.currentStock).toBe(45);

    // CRITICAL ASSERTION: Total movements must STILL be 2, not 3!
    const movementsAfterRetry = await StockMovement.find({ productId: product._id });
    expect(movementsAfterRetry.length).toBe(2);

    // Stock balance must still be 45 (not double decremented to 40)
    const balance = await StockBalance.findOne({ productId: product._id });
    expect(balance?.currentStock).toBe(45);
  });

  it('Reusing idempotency key with a DIFFERENT payload throws 409 Conflict', async () => {
    const key = 'req_idempotent_test_mismatch_456';

    // First request
    const firstRes = await request(app)
      .post('/api/stock-movements/sale')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', key)
      .send({
        productId: product._id.toString(),
        quantity: 2,
        reason: 'Original payload'
      });

    expect(firstRes.status).toBe(201);

    // Second request with SAME key but DIFFERENT payload (different quantity)
    const secondRes = await request(app)
      .post('/api/stock-movements/sale')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', key)
      .send({
        productId: product._id.toString(),
        quantity: 10, // Tampered or conflicting quantity
        reason: 'Modified payload'
      });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.message).toMatch(/Idempotency key reused with a different request payload/i);
  });
});
