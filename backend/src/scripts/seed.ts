import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { StockBalance } from '../models/StockBalance.js';
import { IdempotencyKey } from '../models/IdempotencyKey.js';
import { stockMovementService } from '../services/stockMovementService.js';
import { ENV } from '../config/env.js';

export const DEMO_CREDENTIALS = {
  owner: {
    name: 'Shop Owner',
    email: 'owner@shopledger.local',
    password: 'OwnerPassword123!',
    role: 'OWNER' as const
  },
  staff: {
    name: 'Shop Cashier',
    email: 'staff@shopledger.local',
    password: 'StaffPassword123!',
    role: 'STAFF' as const
  }
};

export const seedDatabase = async (): Promise<void> => {
  if (ENV.NODE_ENV === 'production' && !process.env.ALLOW_PROD_SEED) {
    throw new Error('Refusing to run seed script against production database without explicit override.');
  }

  console.log('--- Starting Safe Database Seed ---');

  // Clean existing data for clean demo environment
  await Promise.all([
    User.deleteMany({}),
    Product.deleteMany({}),
    StockMovement.deleteMany({}),
    StockBalance.deleteMany({}),
    IdempotencyKey.deleteMany({})
  ]);

  console.log('Cleared existing demo collections.');

  // 1. Seed Users
  const ownerHash = await (User as any).hashPassword(DEMO_CREDENTIALS.owner.password);
  const staffHash = await (User as any).hashPassword(DEMO_CREDENTIALS.staff.password);

  const owner = await User.create({
    name: DEMO_CREDENTIALS.owner.name,
    email: DEMO_CREDENTIALS.owner.email,
    passwordHash: ownerHash,
    role: DEMO_CREDENTIALS.owner.role,
    isActive: true
  });

  const staff = await User.create({
    name: DEMO_CREDENTIALS.staff.name,
    email: DEMO_CREDENTIALS.staff.email,
    passwordHash: staffHash,
    role: DEMO_CREDENTIALS.staff.role,
    isActive: true
  });

  console.log(`Created Owner (${owner.email}) and Staff (${staff.email}) accounts.`);

  // 2. Seed Products (Pure Metadata Catalog)
  const productDefinitions = [
    {
      sku: 'MILK-1L',
      name: 'Fresh Cow Milk 1L',
      category: 'Dairy',
      unit: 'bottle',
      price: 65.0,
      lowStockThreshold: 10,
      isActive: true
    },
    {
      sku: 'BREAD-WHT',
      name: 'Whole Wheat Bread 400g',
      category: 'Bakery',
      unit: 'pack',
      price: 45.0,
      lowStockThreshold: 15, // Will end up LOW STOCK (~8)
      isActive: true
    },
    {
      sku: 'EGGS-DOZ',
      name: 'Farm Fresh Brown Eggs',
      category: 'Poultry',
      unit: 'dozen',
      price: 90.0,
      lowStockThreshold: 10, // Will end up OUT OF STOCK (0)
      isActive: true
    },
    {
      sku: 'RICE-BAS-5K',
      name: 'Premium Basmati Rice 5kg',
      category: 'Grains & Staples',
      unit: 'bag',
      price: 480.0,
      lowStockThreshold: 5, // Normally stocked (~35)
      isActive: true
    },
    {
      sku: 'OIL-SUN-1L',
      name: 'Refined Sunflower Cooking Oil 1L',
      category: 'Cooking Essentials',
      unit: 'pouch',
      price: 135.0,
      lowStockThreshold: 12, // Will end up LOW STOCK (~6)
      isActive: true
    },
    {
      sku: 'TEA-ASSAM-500',
      name: 'Assam Gold Leaf Tea 500g',
      category: 'Beverages',
      unit: 'pack',
      price: 220.0,
      lowStockThreshold: 8, // Multiple movements
      isActive: true
    }
  ];

  const createdProducts: Record<string, any> = {};
  for (const def of productDefinitions) {
    const prod = await Product.create(def);
    await stockMovementService.ensureBalanceProjection(prod._id);
    createdProducts[def.sku] = prod;
  }

  console.log(`Created ${productDefinitions.length} product catalog records.`);

  // 3. Seed Stock Movements strictly through StockMovementService domain logic!
  console.log('Seeding stock movements through authoritative StockMovementService domain logic...');

  // Product 1: MILK-1L (Normally stocked ~45)
  await stockMovementService.recordStockMovement({
    productId: createdProducts['MILK-1L']._id,
    type: 'PURCHASE_IN',
    quantity: 60,
    reason: 'Initial morning dairy shipment',
    actorId: owner._id,
    reference: 'PO-2026-001'
  });
  await stockMovementService.recordStockMovement({
    productId: createdProducts['MILK-1L']._id,
    type: 'SALE_OUT',
    quantity: 18,
    reason: 'Morning retail counter sales',
    actorId: staff._id,
    reference: 'INV-1001'
  });
  await stockMovementService.recordStockMovement({
    productId: createdProducts['MILK-1L']._id,
    type: 'RETURN_IN',
    quantity: 3,
    reason: 'Customer exchange - sealed bottle',
    actorId: staff._id,
    reference: 'RET-001'
  });

  // Product 2: BREAD-WHT (Low stock: 8 remaining, threshold 15)
  await stockMovementService.recordStockMovement({
    productId: createdProducts['BREAD-WHT']._id,
    type: 'PURCHASE_IN',
    quantity: 25,
    reason: 'Daily bakery delivery',
    actorId: owner._id,
    reference: 'PO-2026-002'
  });
  await stockMovementService.recordStockMovement({
    productId: createdProducts['BREAD-WHT']._id,
    type: 'SALE_OUT',
    quantity: 17,
    reason: 'Rush hour walk-in sales',
    actorId: staff._id,
    reference: 'INV-1002'
  });

  // Product 3: EGGS-DOZ (Out of stock: 0 remaining, threshold 10)
  await stockMovementService.recordStockMovement({
    productId: createdProducts['EGGS-DOZ']._id,
    type: 'PURCHASE_IN',
    quantity: 30,
    reason: 'Poultry farm crate delivery',
    actorId: owner._id,
    reference: 'PO-2026-003'
  });
  await stockMovementService.recordStockMovement({
    productId: createdProducts['EGGS-DOZ']._id,
    type: 'SALE_OUT',
    quantity: 28,
    reason: 'Bulk breakfast diner order',
    actorId: staff._id,
    reference: 'INV-1003'
  });
  await stockMovementService.recordStockMovement({
    productId: createdProducts['EGGS-DOZ']._id,
    type: 'ADJUSTMENT_OUT',
    quantity: 2,
    reason: 'Damaged cartons during transit',
    actorId: owner._id,
    reference: 'ADJ-DMG-01'
  });

  // Product 4: RICE-BAS-5K (Normally stocked: 35 remaining, threshold 5)
  await stockMovementService.recordStockMovement({
    productId: createdProducts['RICE-BAS-5K']._id,
    type: 'PURCHASE_IN',
    quantity: 40,
    reason: 'Wholesale grain warehouse delivery',
    actorId: owner._id,
    reference: 'PO-2026-004'
  });
  await stockMovementService.recordStockMovement({
    productId: createdProducts['RICE-BAS-5K']._id,
    type: 'SALE_OUT',
    quantity: 5,
    reason: 'Family grocery order',
    actorId: staff._id,
    reference: 'INV-1004'
  });

  // Product 5: OIL-SUN-1L (Low stock: 6 remaining, threshold 12)
  await stockMovementService.recordStockMovement({
    productId: createdProducts['OIL-SUN-1L']._id,
    type: 'PURCHASE_IN',
    quantity: 20,
    reason: 'Fortnightly edible oil replenishment',
    actorId: owner._id,
    reference: 'PO-2026-005'
  });
  await stockMovementService.recordStockMovement({
    productId: createdProducts['OIL-SUN-1L']._id,
    type: 'SALE_OUT',
    quantity: 14,
    reason: 'Retail customer sales',
    actorId: staff._id,
    reference: 'INV-1005'
  });

  // Product 6: TEA-ASSAM-500 (Multiple movements: 25 remaining)
  await stockMovementService.recordStockMovement({
    productId: createdProducts['TEA-ASSAM-500']._id,
    type: 'PURCHASE_IN',
    quantity: 50,
    reason: 'Direct tea garden consignment',
    actorId: owner._id,
    reference: 'PO-2026-006'
  });
  await stockMovementService.recordStockMovement({
    productId: createdProducts['TEA-ASSAM-500']._id,
    type: 'SALE_OUT',
    quantity: 30,
    reason: 'Bulk hotel order',
    actorId: staff._id,
    reference: 'INV-1006'
  });
  await stockMovementService.recordStockMovement({
    productId: createdProducts['TEA-ASSAM-500']._id,
    type: 'RETURN_IN',
    quantity: 2,
    reason: 'Excess order returned unopened',
    actorId: staff._id,
    reference: 'RET-002'
  });
  await stockMovementService.recordStockMovement({
    productId: createdProducts['TEA-ASSAM-500']._id,
    type: 'ADJUSTMENT_IN',
    quantity: 3,
    reason: 'Annual inventory physical count surplus adjustment',
    actorId: owner._id,
    reference: 'AUDIT-2026'
  });

  // 4. Parity Verification Check
  console.log('\n--- Verifying Ledger Parity for All Seeded Products ---');
  let allPassed = true;
  for (const [sku, product] of Object.entries(createdProducts)) {
    const parity = await stockMovementService.verifyStockParity(product._id);
    const status = parity.parity ? '✅ PARITY OK' : '❌ PARITY MISMATCH';
    console.log(
      `Product [${sku}] ${product.name}: Ledger Derived = ${parity.derivedStock}, Projected = ${parity.projectedStock} (${status})`
    );
    if (!parity.parity) allPassed = false;
  }

  if (!allPassed) {
    throw new Error('Seed validation failed: One or more products had ledger/projection parity mismatch.');
  }

  console.log('\n======================================================');
  console.log('  Database Seed Completed Successfully!');
  console.log('======================================================');
  console.log('  Demo Logins:');
  console.log(`    OWNER: ${DEMO_CREDENTIALS.owner.email} / ${DEMO_CREDENTIALS.owner.password}`);
  console.log(`    STAFF: ${DEMO_CREDENTIALS.staff.email} / ${DEMO_CREDENTIALS.staff.password}`);
  console.log('======================================================\n');
};

// If executed directly via `tsx src/scripts/seed.ts`
if (process.argv[1] && process.argv[1].includes('seed')) {
  (async () => {
    try {
      await connectDB();
      await seedDatabase();
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error('Seed execution failed:', err);
      process.exit(1);
    }
  })();
}
