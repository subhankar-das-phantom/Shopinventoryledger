import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { StockBalance } from '../models/StockBalance.js';
import { stockMovementService } from '../services/stockMovementService.js';
import { AppError } from '../middleware/errorHandler.js';

describe('Stock Ledger & Domain Invariants', () => {
  let ownerUser: any;
  let staffUser: any;
  let testProduct: any;

  beforeEach(async () => {
    ownerUser = await User.create({
      name: 'Test Owner',
      email: 'owner@test.local',
      passwordHash: 'dummyhash',
      role: 'OWNER'
    });

    staffUser = await User.create({
      name: 'Test Staff',
      email: 'staff@test.local',
      passwordHash: 'dummyhash',
      role: 'STAFF'
    });

    testProduct = await Product.create({
      sku: 'TEST-SKU-1',
      name: 'Ledger Test Product',
      category: 'Electronics',
      unit: 'pcs',
      price: 100,
      lowStockThreshold: 5,
      isActive: true
    });
  });

  it('1. Purchase increases stock and creates exactly one movement record', async () => {
    const initialMovements = await StockMovement.countDocuments({ productId: testProduct._id });
    expect(initialMovements).toBe(0);

    const purchaseResult = await stockMovementService.recordStockMovement({
      productId: testProduct._id,
      type: 'PURCHASE_IN',
      quantity: 50,
      reason: 'Initial wholesale purchase',
      actorId: ownerUser._id,
      reference: 'PO-1001'
    });

    expect(purchaseResult.currentStock).toBe(50);

    const movements = await StockMovement.find({ productId: testProduct._id });
    expect(movements.length).toBe(1);
    expect(movements[0].type).toBe('PURCHASE_IN');
    expect(movements[0].direction).toBe('IN');
    expect(movements[0].quantity).toBe(50);
    expect(movements[0].reference).toBe('PO-1001');

    const balance = await StockBalance.findOne({ productId: testProduct._id });
    expect(balance?.currentStock).toBe(50);
  });

  it('2. Sale decreases stock and creates exactly one movement record', async () => {
    // Start with 20 items
    await stockMovementService.recordStockMovement({
      productId: testProduct._id,
      type: 'PURCHASE_IN',
      quantity: 20,
      reason: 'Stocking',
      actorId: ownerUser._id
    });

    const saleResult = await stockMovementService.recordStockMovement({
      productId: testProduct._id,
      type: 'SALE_OUT',
      quantity: 7,
      reason: 'Retail sale',
      actorId: staffUser._id,
      reference: 'INV-5001'
    });

    expect(saleResult.currentStock).toBe(13);

    const movements = await StockMovement.find({ productId: testProduct._id }).sort({ createdAt: -1 });
    expect(movements.length).toBe(2);
    expect(movements[0].type).toBe('SALE_OUT');
    expect(movements[0].direction).toBe('OUT');
    expect(movements[0].quantity).toBe(7);

    const balance = await StockBalance.findOne({ productId: testProduct._id });
    expect(balance?.currentStock).toBe(13);
  });

  it('3. Sale exceeding available stock fails without changing stock or history', async () => {
    // Start with 5 items
    await stockMovementService.recordStockMovement({
      productId: testProduct._id,
      type: 'PURCHASE_IN',
      quantity: 5,
      reason: 'Stocking',
      actorId: ownerUser._id
    });

    const movementCountBefore = await StockMovement.countDocuments({ productId: testProduct._id });

    // Attempt to sell 6 items
    await expect(
      stockMovementService.recordStockMovement({
        productId: testProduct._id,
        type: 'SALE_OUT',
        quantity: 6,
        reason: 'Oversell attempt',
        actorId: staffUser._id
      })
    ).rejects.toThrow(/Insufficient stock available/i);

    // Verify stock balance remained untouched at 5
    const balance = await StockBalance.findOne({ productId: testProduct._id });
    expect(balance?.currentStock).toBe(5);

    // Verify no movement was inserted
    const movementCountAfter = await StockMovement.countDocuments({ productId: testProduct._id });
    expect(movementCountAfter).toBe(movementCountBefore);
  });

  it('4. Return increases stock and creates an audit movement', async () => {
    await stockMovementService.recordStockMovement({
      productId: testProduct._id,
      type: 'PURCHASE_IN',
      quantity: 10,
      reason: 'Initial',
      actorId: ownerUser._id
    });
    await stockMovementService.recordStockMovement({
      productId: testProduct._id,
      type: 'SALE_OUT',
      quantity: 4,
      reason: 'Sale',
      actorId: staffUser._id
    });

    const returnResult = await stockMovementService.recordStockMovement({
      productId: testProduct._id,
      type: 'RETURN_IN',
      quantity: 2,
      reason: 'Customer return unopened',
      actorId: staffUser._id,
      reference: 'RET-01'
    });

    expect(returnResult.currentStock).toBe(8); // 10 - 4 + 2 = 8

    const latestMovement = await StockMovement.findOne({ productId: testProduct._id }).sort({
      createdAt: -1
    });
    expect(latestMovement?.type).toBe('RETURN_IN');
    expect(latestMovement?.direction).toBe('IN');
  });

  it('5. Rejects non-positive or zero quantities', async () => {
    await expect(
      stockMovementService.recordStockMovement({
        productId: testProduct._id,
        type: 'PURCHASE_IN',
        quantity: 0,
        reason: 'Zero quantity test',
        actorId: ownerUser._id
      })
    ).rejects.toThrow(/positive number greater than zero/i);

    await expect(
      stockMovementService.recordStockMovement({
        productId: testProduct._id,
        type: 'SALE_OUT',
        quantity: -10,
        reason: 'Negative quantity test',
        actorId: staffUser._id
      })
    ).rejects.toThrow(/positive number greater than zero/i);
  });

  it('6. Projection always agrees with movement-derived reconstruction', async () => {
    // Perform multiple varied operations
    await stockMovementService.recordStockMovement({
      productId: testProduct._id,
      type: 'PURCHASE_IN',
      quantity: 100,
      reason: 'Purchase',
      actorId: ownerUser._id
    });
    await stockMovementService.recordStockMovement({
      productId: testProduct._id,
      type: 'SALE_OUT',
      quantity: 35,
      reason: 'Sale 1',
      actorId: staffUser._id
    });
    await stockMovementService.recordStockMovement({
      productId: testProduct._id,
      type: 'SALE_OUT',
      quantity: 15,
      reason: 'Sale 2',
      actorId: staffUser._id
    });
    await stockMovementService.recordStockMovement({
      productId: testProduct._id,
      type: 'RETURN_IN',
      quantity: 5,
      reason: 'Return',
      actorId: staffUser._id
    });
    await stockMovementService.recordStockMovement({
      productId: testProduct._id,
      type: 'ADJUSTMENT_OUT',
      quantity: 3,
      reason: 'Damaged item',
      actorId: ownerUser._id
    });

    // Net expected: 100 - 35 - 15 + 5 - 3 = 52
    const parity = await stockMovementService.verifyStockParity(testProduct._id);
    expect(parity.parity).toBe(true);
    expect(parity.derivedStock).toBe(52);
    expect(parity.projectedStock).toBe(52);
    expect(parity.difference).toBe(0);
  });
});
