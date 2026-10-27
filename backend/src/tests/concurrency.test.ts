import { describe, it, expect, beforeEach } from 'vitest';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { StockBalance } from '../models/StockBalance.js';
import { stockMovementService } from '../services/stockMovementService.js';

describe('Concurrency Safety & Race Condition Protection', () => {
  let staffUser: any;
  let ownerUser: any;
  let product: any;

  beforeEach(async () => {
    ownerUser = await User.create({
      name: 'Owner',
      email: 'owner-concurrency@test.local',
      passwordHash: 'dummy',
      role: 'OWNER'
    });

    staffUser = await User.create({
      name: 'Staff',
      email: 'staff-concurrency@test.local',
      passwordHash: 'dummy',
      role: 'STAFF'
    });

    product = await Product.create({
      sku: 'CONC-TEST-1',
      name: 'Hot Ticket Item',
      category: 'Electronics',
      unit: 'pcs',
      price: 500,
      lowStockThreshold: 2,
      isActive: true
    });
  });

  it('Requirement 4: Two concurrent sales competing for the final item cannot both succeed', async () => {
    // 1. Establish initial stock of exactly 1 item
    await stockMovementService.recordStockMovement({
      productId: product._id,
      type: 'PURCHASE_IN',
      quantity: 1,
      reason: 'Stock final item',
      actorId: ownerUser._id
    });

    const initialBalance = await StockBalance.findOne({ productId: product._id });
    expect(initialBalance?.currentStock).toBe(1);

    // 2. Fire two simultaneous sale requests for the single item
    const sale1Promise = stockMovementService.recordStockMovement({
      productId: product._id,
      type: 'SALE_OUT',
      quantity: 1,
      reason: 'Concurrent Buyer 1',
      actorId: staffUser._id,
      reference: 'ORDER-1'
    });

    const sale2Promise = stockMovementService.recordStockMovement({
      productId: product._id,
      type: 'SALE_OUT',
      quantity: 1,
      reason: 'Concurrent Buyer 2',
      actorId: staffUser._id,
      reference: 'ORDER-2'
    });

    const results = await Promise.allSettled([sale1Promise, sale2Promise]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // 3. Exactly one sale succeeded, exactly one failed
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // 4. Verify failure reason was Insufficient Stock
    const failureReason = (failures[0] as PromiseRejectedResult).reason;
    expect(failureReason.message).toMatch(/Insufficient stock available/i);

    // 5. Verify final balance is 0 (never negative!)
    const finalBalance = await StockBalance.findOne({ productId: product._id });
    expect(finalBalance?.currentStock).toBe(0);

    // 6. Verify total movements recorded: 1 PURCHASE_IN + exactly 1 SALE_OUT = 2 total
    const movements = await StockMovement.find({ productId: product._id });
    expect(movements.length).toBe(2);

    const saleMovements = movements.filter((m) => m.type === 'SALE_OUT');
    expect(saleMovements.length).toBe(1);

    // 7. Verify ledger parity
    const parity = await stockMovementService.verifyStockParity(product._id);
    expect(parity.parity).toBe(true);
    expect(parity.derivedStock).toBe(0);
    expect(parity.projectedStock).toBe(0);
  });

  it('High concurrency stress: 10 concurrent buyers competing for 4 available items', async () => {
    // Stock with 4 items
    await stockMovementService.recordStockMovement({
      productId: product._id,
      type: 'PURCHASE_IN',
      quantity: 4,
      reason: 'Stock 4 items',
      actorId: ownerUser._id
    });

    // 10 concurrent requests for 1 item each
    const promises = Array.from({ length: 10 }, (_, i) =>
      stockMovementService.recordStockMovement({
        productId: product._id,
        type: 'SALE_OUT',
        quantity: 1,
        reason: `Buyer #${i + 1}`,
        actorId: staffUser._id,
        reference: `ORD-${i + 1}`
      })
    );

    const results = await Promise.allSettled(promises);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    expect(successes.length).toBe(4);
    expect(failures.length).toBe(6);

    const finalBalance = await StockBalance.findOne({ productId: product._id });
    expect(finalBalance?.currentStock).toBe(0);

    const parity = await stockMovementService.verifyStockParity(product._id);
    expect(parity.parity).toBe(true);
    expect(parity.derivedStock).toBe(0);
  });
});
