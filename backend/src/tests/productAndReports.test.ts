import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { StockBalance } from '../models/StockBalance.js';
import { generateToken } from '../middleware/auth.js';
import { stockMovementService } from '../services/stockMovementService.js';

describe('Products, Low-Stock Calculations & CSV Security', () => {
  const app = createApp();
  let ownerUser: any;
  let ownerToken: string;

  beforeEach(async () => {
    ownerUser = await User.create({
      name: 'Owner Admin',
      email: 'owner-prod@test.local',
      passwordHash: 'dummy',
      role: 'OWNER',
      isActive: true
    });

    ownerToken = generateToken(ownerUser);
  });

  it('Rejects duplicate SKU on product creation with 409 Conflict', async () => {
    await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sku: 'UNIQUE-SKU-1',
        name: 'First Product',
        category: 'Dairy',
        unit: 'pack',
        price: 25,
        lowStockThreshold: 5
      });

    const duplicateRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sku: 'UNIQUE-SKU-1',
        name: 'Second Product with same SKU',
        category: 'Dairy',
        unit: 'pack',
        price: 30,
        lowStockThreshold: 5
      });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.message).toMatch(/already exists/i);
  });

  it('Product deactivation preserves historical movement access and prevents new sales', async () => {
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sku: 'DEACT-SKU-1',
        name: 'Deactivatable Product',
        category: 'Snacks',
        unit: 'bar',
        price: 15,
        lowStockThreshold: 2
      });

    const productId = prodRes.body.data._id;

    // Record a purchase
    await stockMovementService.recordStockMovement({
      productId,
      type: 'PURCHASE_IN',
      quantity: 10,
      reason: 'Initial purchase',
      actorId: ownerUser._id
    });

    // Deactivate the product
    const deactRes = await request(app)
      .post(`/api/products/${productId}/deactivate`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(deactRes.status).toBe(200);
    expect(deactRes.body.data.isActive).toBe(false);

    // Historical movements are STILL accessible
    const movRes = await request(app)
      .get(`/api/products/${productId}/movements`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(movRes.status).toBe(200);
    expect(movRes.body.data.length).toBe(1);

    // Attempting a new sale on deactivated product fails
    const saleRes = await request(app)
      .post('/api/stock-movements/sale')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productId,
        quantity: 1,
        reason: 'Sale attempt on deactivated item'
      });

    expect(saleRes.status).toBe(400);
    expect(saleRes.body.message).toMatch(/deactivated product/i);
  });

  it('Low-stock view returns items where currentStock <= lowStockThreshold and includes zero-stock', async () => {
    // Product A: 10 in stock, threshold 5 (Normal stock)
    const prodA = await Product.create({
      sku: 'NORM-1',
      name: 'Normal Item',
      category: 'Test',
      unit: 'pcs',
      price: 10,
      lowStockThreshold: 5,
      isActive: true
    });
    await stockMovementService.recordStockMovement({
      productId: prodA._id,
      type: 'PURCHASE_IN',
      quantity: 10,
      reason: 'Stock',
      actorId: ownerUser._id
    });

    // Product B: 3 in stock, threshold 5 (Low stock)
    const prodB = await Product.create({
      sku: 'LOW-1',
      name: 'Low Stock Item',
      category: 'Test',
      unit: 'pcs',
      price: 10,
      lowStockThreshold: 5,
      isActive: true
    });
    await stockMovementService.recordStockMovement({
      productId: prodB._id,
      type: 'PURCHASE_IN',
      quantity: 3,
      reason: 'Stock',
      actorId: ownerUser._id
    });

    // Product C: 0 in stock, threshold 5 (Zero stock)
    const prodC = await Product.create({
      sku: 'ZERO-1',
      name: 'Out of Stock Item',
      category: 'Test',
      unit: 'pcs',
      price: 10,
      lowStockThreshold: 5,
      isActive: true
    });
    await stockMovementService.ensureBalanceProjection(prodC._id);

    const res = await request(app)
      .get('/api/stock/low-stock')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const lowStockSkus = res.body.data.map((p: any) => p.sku);

    expect(lowStockSkus).toContain('LOW-1');
    expect(lowStockSkus).toContain('ZERO-1');
    expect(lowStockSkus).not.toContain('NORM-1');
  });

  it('CSV export escapes formula injection characters (=, +, -, @) safely', async () => {
    // Create product with potentially malicious formula name
    await Product.create({
      sku: 'MAL-1',
      name: '=cmd|’ /C calc’!A0', // Excel formula injection vector
      category: '+DangerousCategory',
      unit: '@pcs',
      price: 10,
      lowStockThreshold: 5,
      isActive: true
    });

    const res = await request(app)
      .get('/api/stock/report.csv')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);

    const csvText = res.text;

    // Check that leading formula characters are prefixed with a single quote '
    expect(csvText).toContain("`=cmd|’ /C calc’!A0".replace('`', "'"));
    expect(csvText).toContain("'+DangerousCategory");
    expect(csvText).toContain("'@pcs");
  });

  it('Multi-format export /api/products/export supports Excel, CSV, and JSON', async () => {
    await Product.create({
      sku: 'EXP-1',
      name: 'Exportable Widget',
      category: 'Gadgets',
      unit: 'pcs',
      price: 150,
      lowStockThreshold: 10,
      isActive: true
    });

    // 1. Test Excel export
    const excelRes = await request(app)
      .get('/api/products/export?format=excel')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(excelRes.status).toBe(200);
    expect(excelRes.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(excelRes.headers['content-disposition']).toContain('.xlsx');

    // 2. Test CSV export
    const csvRes = await request(app)
      .get('/api/products/export?format=csv')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain('Exportable Widget');

    // 3. Test JSON export
    const jsonRes = await request(app)
      .get('/api/products/export?format=json')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(jsonRes.status).toBe(200);
    expect(jsonRes.headers['content-type']).toContain('application/json');
    expect(jsonRes.body.reportTitle).toBe('Inventory & Stock Valuation Report');
    expect(jsonRes.body.data.length).toBeGreaterThan(0);
  });
});
