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
  },
  ownerDemo: {
    name: 'Admin Owner',
    email: 'owner@demo.com',
    password: 'Demo@1234',
    role: 'OWNER' as const
  },
  staffDemo: {
    name: 'Cashier Staff',
    email: 'staff@demo.com',
    password: 'Demo@1234',
    role: 'STAFF' as const
  }
};

/**
 * Helper to compute realistic movement timestamps spread over the year
 */
const getPastDate = (daysAgo: number, hours = 10, minutes = 30): Date => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

export const seedDatabase = async (): Promise<void> => {
  if (ENV.NODE_ENV === 'production' && !process.env.ALLOW_PROD_SEED) {
    throw new Error('Refusing to run seed script against production database without explicit override.');
  }

  console.log('--- Starting Safe Accounting-Grade Database Seed (Year-Round Historical Data) ---');

  // 1. Clean existing collections for a consistent state
  await Promise.all([
    User.deleteMany({}),
    Product.deleteMany({}),
    StockMovement.deleteMany({}),
    StockBalance.deleteMany({}),
    IdempotencyKey.deleteMany({})
  ]);

  console.log('✓ Cleared existing collections.');

  // 2. Seed Users
  const [ownerHash, staffHash, ownerDemoHash, staffDemoHash] = await Promise.all([
    (User as any).hashPassword(DEMO_CREDENTIALS.owner.password),
    (User as any).hashPassword(DEMO_CREDENTIALS.staff.password),
    (User as any).hashPassword(DEMO_CREDENTIALS.ownerDemo.password),
    (User as any).hashPassword(DEMO_CREDENTIALS.staffDemo.password)
  ]);

  const [owner, staff] = await Promise.all([
    User.create({
      name: DEMO_CREDENTIALS.owner.name,
      email: DEMO_CREDENTIALS.owner.email,
      passwordHash: ownerHash,
      role: DEMO_CREDENTIALS.owner.role,
      isActive: true
    }),
    User.create({
      name: DEMO_CREDENTIALS.staff.name,
      email: DEMO_CREDENTIALS.staff.email,
      passwordHash: staffHash,
      role: DEMO_CREDENTIALS.staff.role,
      isActive: true
    }),
    // Extra convenience logins for demo/testing
    User.create({
      name: DEMO_CREDENTIALS.ownerDemo.name,
      email: DEMO_CREDENTIALS.ownerDemo.email,
      passwordHash: ownerDemoHash,
      role: DEMO_CREDENTIALS.ownerDemo.role,
      isActive: true
    }),
    User.create({
      name: DEMO_CREDENTIALS.staffDemo.name,
      email: DEMO_CREDENTIALS.staffDemo.email,
      passwordHash: staffDemoHash,
      role: DEMO_CREDENTIALS.staffDemo.role,
      isActive: true
    })
  ]);

  console.log(`✓ Seeded users: ${owner.email}, ${staff.email}, ${DEMO_CREDENTIALS.ownerDemo.email}`);

  // 3. Define 12 diverse business catalog products
  const productDefinitions = [
    {
      sku: 'MILK-1L',
      name: 'Fresh Cow Milk 1L',
      category: 'Dairy',
      unit: 'bottle',
      price: 65.0,
      lowStockThreshold: 15,
      isActive: true
    },
    {
      sku: 'BUTTER-500G',
      name: 'Pasteurised Table Butter 500g',
      category: 'Dairy',
      unit: 'pack',
      price: 275.0,
      lowStockThreshold: 10,
      isActive: true
    },
    {
      sku: 'PANEER-200G',
      name: 'Fresh Malai Paneer 200g',
      category: 'Dairy',
      unit: 'pack',
      price: 95.0,
      lowStockThreshold: 10, // Ends up LOW STOCK (~4)
      isActive: true
    },
    {
      sku: 'BREAD-WHT',
      name: 'Whole Wheat Bread 400g',
      category: 'Bakery',
      unit: 'pack',
      price: 45.0,
      lowStockThreshold: 15,
      isActive: true
    },
    {
      sku: 'EGGS-DOZ',
      name: 'Farm Fresh Brown Eggs',
      category: 'Poultry',
      unit: 'dozen',
      price: 90.0,
      lowStockThreshold: 12, // Ends up OUT OF STOCK (0)
      isActive: true
    },
    {
      sku: 'RICE-BAS-5K',
      name: 'Premium Basmati Rice 5kg',
      category: 'Grains & Staples',
      unit: 'bag',
      price: 480.0,
      lowStockThreshold: 8,
      isActive: true
    },
    {
      sku: 'DAL-TOOR-1K',
      name: 'Unpolished Toor Dal 1kg',
      category: 'Grains & Staples',
      unit: 'pack',
      price: 165.0,
      lowStockThreshold: 10,
      isActive: true
    },
    {
      sku: 'FLOUR-ATTA-5K',
      name: 'Chakki Fresh Whole Wheat Atta 5kg',
      category: 'Grains & Staples',
      unit: 'bag',
      price: 245.0,
      lowStockThreshold: 8,
      isActive: true
    },
    {
      sku: 'OIL-SUN-1L',
      name: 'Refined Sunflower Cooking Oil 1L',
      category: 'Cooking Essentials',
      unit: 'pouch',
      price: 135.0,
      lowStockThreshold: 15, // Ends up LOW STOCK (~6)
      isActive: true
    },
    {
      sku: 'SALT-IOD-1K',
      name: 'Vacuum Evaporated Iodized Salt 1kg',
      category: 'Cooking Essentials',
      unit: 'pack',
      price: 28.0,
      lowStockThreshold: 20,
      isActive: true
    },
    {
      sku: 'TEA-ASSAM-500',
      name: 'Assam Gold CTC Leaf Tea 500g',
      category: 'Beverages',
      unit: 'pack',
      price: 220.0,
      lowStockThreshold: 10,
      isActive: true
    },
    {
      sku: 'COFFEE-ROAST-200',
      name: 'Dark Roast Filter Coffee Powder 200g',
      category: 'Beverages',
      unit: 'tin',
      price: 310.0,
      lowStockThreshold: 6,
      isActive: true
    }
  ];

  const createdProducts: Record<string, any> = {};
  for (const def of productDefinitions) {
    const prod = await Product.create(def);
    await stockMovementService.ensureBalanceProjection(prod._id);
    createdProducts[def.sku] = prod;
  }

  console.log(`✓ Created ${productDefinitions.length} catalog products with initialized balance projections.`);

  // 4. Build chronological movement timeline spanning the entire past 360 days (12 months)
  interface MovementPlan {
    sku: string;
    type: 'PURCHASE_IN' | 'SALE_OUT' | 'RETURN_IN' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
    quantity: number;
    daysAgo: number;
    hours?: number;
    reason: string;
    reference: string;
    actor: 'owner' | 'staff';
  }

  const timeline: MovementPlan[] = [
    // Month 12 (~350-330 days ago) - November 2025 Opening Consignment
    { sku: 'RICE-BAS-5K', type: 'PURCHASE_IN', quantity: 50, daysAgo: 345, reason: 'Annual wholesale grain stock replenishment', reference: 'PO-2025-11-01', actor: 'owner' },
    { sku: 'RICE-BAS-5K', type: 'SALE_OUT', quantity: 8, daysAgo: 335, reason: 'Wholesale restaurant supply', reference: 'INV-2025-1102', actor: 'staff' },
    { sku: 'OIL-SUN-1L', type: 'PURCHASE_IN', quantity: 60, daysAgo: 342, reason: 'Initial bulk oil container procurement', reference: 'PO-2025-11-02', actor: 'owner' },
    { sku: 'OIL-SUN-1L', type: 'SALE_OUT', quantity: 12, daysAgo: 332, reason: 'Festival weekend sales', reference: 'INV-2025-1105', actor: 'staff' },
    { sku: 'TEA-ASSAM-500', type: 'PURCHASE_IN', quantity: 40, daysAgo: 340, reason: 'Direct tea estate autumn flush', reference: 'PO-2025-11-03', actor: 'owner' },
    { sku: 'TEA-ASSAM-500', type: 'SALE_OUT', quantity: 6, daysAgo: 330, reason: 'Retail counter sales', reference: 'INV-2025-1108', actor: 'staff' },

    // Month 11 (~320-300 days ago) - December 2025 Winter Stock
    { sku: 'MILK-1L', type: 'PURCHASE_IN', quantity: 80, daysAgo: 315, reason: 'Winter dairy supplier delivery', reference: 'PO-2025-12-01', actor: 'owner' },
    { sku: 'MILK-1L', type: 'SALE_OUT', quantity: 70, daysAgo: 310, reason: 'December holiday baking sales', reference: 'INV-2025-1201', actor: 'staff' },
    { sku: 'EGGS-DOZ', type: 'PURCHASE_IN', quantity: 60, daysAgo: 314, reason: 'Farm crate intake', reference: 'PO-2025-12-02', actor: 'owner' },
    { sku: 'EGGS-DOZ', type: 'SALE_OUT', quantity: 45, daysAgo: 308, reason: 'Bakery holiday bulk purchase', reference: 'INV-2025-1205', actor: 'staff' },
    { sku: 'COFFEE-ROAST-200', type: 'PURCHASE_IN', quantity: 30, daysAgo: 312, reason: 'Winter roast coffee shipment', reference: 'PO-2025-12-03', actor: 'owner' },
    { sku: 'COFFEE-ROAST-200', type: 'SALE_OUT', quantity: 5, daysAgo: 305, reason: 'Cafe counter order', reference: 'INV-2025-1210', actor: 'staff' },

    // Month 10 (~290-270 days ago) - January 2026 New Year Stock
    { sku: 'FLOUR-ATTA-5K', type: 'PURCHASE_IN', quantity: 40, daysAgo: 285, reason: 'Chakki wholesale delivery', reference: 'PO-2026-01-01', actor: 'owner' },
    { sku: 'FLOUR-ATTA-5K', type: 'SALE_OUT', quantity: 10, daysAgo: 280, reason: 'Household monthly grocery basket', reference: 'INV-2026-0102', actor: 'staff' },
    { sku: 'DAL-TOOR-1K', type: 'PURCHASE_IN', quantity: 45, daysAgo: 284, reason: 'Fresh harvest unpolished dal delivery', reference: 'PO-2026-01-02', actor: 'owner' },
    { sku: 'DAL-TOOR-1K', type: 'SALE_OUT', quantity: 8, daysAgo: 278, reason: 'Walk-in grocery sales', reference: 'INV-2026-0105', actor: 'staff' },
    { sku: 'SALT-IOD-1K', type: 'PURCHASE_IN', quantity: 80, daysAgo: 282, reason: 'Quarterly salt consignment', reference: 'PO-2026-01-03', actor: 'owner' },
    { sku: 'SALT-IOD-1K', type: 'SALE_OUT', quantity: 15, daysAgo: 275, reason: 'Community kitchen bulk order', reference: 'INV-2026-0112', actor: 'staff' },

    // Month 9 (~260-240 days ago) - February 2026
    { sku: 'BREAD-WHT', type: 'PURCHASE_IN', quantity: 50, daysAgo: 255, reason: 'Bakery supplier batch', reference: 'PO-2026-02-01', actor: 'owner' },
    { sku: 'BREAD-WHT', type: 'SALE_OUT', quantity: 42, daysAgo: 250, reason: 'Daily sandwich shop sales', reference: 'INV-2026-0202', actor: 'staff' },
    { sku: 'BUTTER-500G', type: 'PURCHASE_IN', quantity: 35, daysAgo: 252, reason: 'Cold chain dairy shipment', reference: 'PO-2026-02-02', actor: 'owner' },
    { sku: 'BUTTER-500G', type: 'SALE_OUT', quantity: 12, daysAgo: 248, reason: 'Retail customers', reference: 'INV-2026-0206', actor: 'staff' },
    { sku: 'PANEER-200G', type: 'PURCHASE_IN', quantity: 30, daysAgo: 250, reason: 'Weekly fresh paneer supply', reference: 'PO-2026-02-03', actor: 'owner' },
    { sku: 'PANEER-200G', type: 'SALE_OUT', quantity: 24, daysAgo: 245, reason: 'Weekend catering supply', reference: 'INV-2026-0209', actor: 'staff' },

    // Month 8 (~230-210 days ago) - March 2026 Q1 Physical Audit
    { sku: 'RICE-BAS-5K', type: 'SALE_OUT', quantity: 12, daysAgo: 228, reason: 'Spring wedding season order', reference: 'INV-2026-0301', actor: 'staff' },
    { sku: 'OIL-SUN-1L', type: 'SALE_OUT', quantity: 15, daysAgo: 225, reason: 'Commercial snack vendor sales', reference: 'INV-2026-0304', actor: 'staff' },
    { sku: 'TEA-ASSAM-500', type: 'RETURN_IN', quantity: 2, daysAgo: 220, reason: 'Customer exchange - unopened pack', reference: 'RET-2026-0301', actor: 'staff' },
    { sku: 'RICE-BAS-5K', type: 'ADJUSTMENT_IN', quantity: 2, daysAgo: 215, reason: 'Q1 Physical inventory audit count surplus', reference: 'AUDIT-2026-Q1', actor: 'owner' },

    // Month 7 (~200-180 days ago) - April 2026
    { sku: 'MILK-1L', type: 'PURCHASE_IN', quantity: 70, daysAgo: 195, reason: 'Spring dairy intake', reference: 'PO-2026-04-01', actor: 'owner' },
    { sku: 'MILK-1L', type: 'SALE_OUT', quantity: 65, daysAgo: 190, reason: 'Residential neighborhood delivery', reference: 'INV-2026-0402', actor: 'staff' },
    { sku: 'EGGS-DOZ', type: 'PURCHASE_IN', quantity: 50, daysAgo: 192, reason: 'Poultry farm replenishment', reference: 'PO-2026-04-02', actor: 'owner' },
    { sku: 'EGGS-DOZ', type: 'SALE_OUT', quantity: 40, daysAgo: 188, reason: 'Breakfast counter sales', reference: 'INV-2026-0405', actor: 'staff' },

    // Month 6 (~170-150 days ago) - May 2026 Summer Stock
    { sku: 'FLOUR-ATTA-5K', type: 'PURCHASE_IN', quantity: 35, daysAgo: 165, reason: 'Flour mill summer replenishment', reference: 'PO-2026-05-01', actor: 'owner' },
    { sku: 'FLOUR-ATTA-5K', type: 'SALE_OUT', quantity: 12, daysAgo: 158, reason: 'Apartment complex collective order', reference: 'INV-2026-0504', actor: 'staff' },
    { sku: 'DAL-TOOR-1K', type: 'SALE_OUT', quantity: 10, daysAgo: 155, reason: 'Retail grocery customers', reference: 'INV-2026-0508', actor: 'staff' },
    { sku: 'COFFEE-ROAST-200', type: 'SALE_OUT', quantity: 6, daysAgo: 152, reason: 'Coffee connoisseur club', reference: 'INV-2026-0512', actor: 'staff' },

    // Month 5 (~140-120 days ago) - June 2026 Monsoon Prep & Audit
    { sku: 'BREAD-WHT', type: 'PURCHASE_IN', quantity: 45, daysAgo: 135, reason: 'Daily bakery dispatch', reference: 'PO-2026-06-01', actor: 'owner' },
    { sku: 'BREAD-WHT', type: 'SALE_OUT', quantity: 38, daysAgo: 130, reason: 'Monsoon tea stall orders', reference: 'INV-2026-0603', actor: 'staff' },
    { sku: 'OIL-SUN-1L', type: 'PURCHASE_IN', quantity: 40, daysAgo: 132, reason: 'Monsoon stock replenishment', reference: 'PO-2026-06-02', actor: 'owner' },
    { sku: 'OIL-SUN-1L', type: 'SALE_OUT', quantity: 18, daysAgo: 126, reason: 'Retail grocery counter', reference: 'INV-2026-0608', actor: 'staff' },
    { sku: 'BREAD-WHT', type: 'ADJUSTMENT_OUT', quantity: 2, daysAgo: 122, reason: 'Moisture damaged packaging written off', reference: 'ADJ-DMG-Q2', actor: 'owner' },

    // Month 4 (~110-90 days ago) - July 2026
    { sku: 'RICE-BAS-5K', type: 'PURCHASE_IN', quantity: 35, daysAgo: 105, reason: 'Basmati rice distributor delivery', reference: 'PO-2026-07-01', actor: 'owner' },
    { sku: 'RICE-BAS-5K', type: 'SALE_OUT', quantity: 15, daysAgo: 98, reason: 'Hostel mess monthly order', reference: 'INV-2026-0705', actor: 'staff' },
    { sku: 'TEA-ASSAM-500', type: 'PURCHASE_IN', quantity: 30, daysAgo: 102, reason: 'Second flush monsoon tea shipment', reference: 'PO-2026-07-02', actor: 'owner' },
    { sku: 'TEA-ASSAM-500', type: 'SALE_OUT', quantity: 14, daysAgo: 95, reason: 'Corporate office pantry supply', reference: 'INV-2026-0710', actor: 'staff' },

    // Month 3 (~85-60 days ago) - August 2026
    { sku: 'MILK-1L', type: 'PURCHASE_IN', quantity: 90, daysAgo: 80, reason: 'Morning dairy route consignment', reference: 'PO-2026-08-01', actor: 'owner' },
    { sku: 'MILK-1L', type: 'SALE_OUT', quantity: 82, daysAgo: 74, reason: 'Daily retail customer deliveries', reference: 'INV-2026-0802', actor: 'staff' },
    { sku: 'BUTTER-500G', type: 'PURCHASE_IN', quantity: 25, daysAgo: 78, reason: 'Cold storage butter delivery', reference: 'PO-2026-08-02', actor: 'owner' },
    { sku: 'BUTTER-500G', type: 'SALE_OUT', quantity: 15, daysAgo: 72, reason: 'Bakery kitchen supply', reference: 'INV-2026-0806', actor: 'staff' },
    { sku: 'EGGS-DOZ', type: 'PURCHASE_IN', quantity: 45, daysAgo: 75, reason: 'Farm fresh crate delivery', reference: 'PO-2026-08-03', actor: 'owner' },
    { sku: 'EGGS-DOZ', type: 'SALE_OUT', quantity: 40, daysAgo: 68, reason: 'Local cafe weekly intake', reference: 'INV-2026-0811', actor: 'staff' },

    // Month 2 (~55-30 days ago) - September 2026 (Past Month Period)
    { sku: 'FLOUR-ATTA-5K', type: 'PURCHASE_IN', quantity: 30, daysAgo: 50, reason: 'Pre-festival wholesale flour shipment', reference: 'PO-2026-09-01', actor: 'owner' },
    { sku: 'FLOUR-ATTA-5K', type: 'SALE_OUT', quantity: 14, daysAgo: 45, reason: 'Sweet shop festival order', reference: 'INV-2026-0903', actor: 'staff' },
    { sku: 'DAL-TOOR-1K', type: 'PURCHASE_IN', quantity: 35, daysAgo: 48, reason: 'Pulses market supply', reference: 'PO-2026-09-02', actor: 'owner' },
    { sku: 'DAL-TOOR-1K', type: 'SALE_OUT', quantity: 12, daysAgo: 42, reason: 'Retail counter sales', reference: 'INV-2026-0906', actor: 'staff' },
    { sku: 'COFFEE-ROAST-200', type: 'PURCHASE_IN', quantity: 20, daysAgo: 46, reason: 'Specialty coffee roasters batch', reference: 'PO-2026-09-03', actor: 'owner' },
    { sku: 'COFFEE-ROAST-200', type: 'SALE_OUT', quantity: 8, daysAgo: 38, reason: 'Retail gourmet customers', reference: 'INV-2026-0912', actor: 'staff' },
    { sku: 'PANEER-200G', type: 'PURCHASE_IN', quantity: 25, daysAgo: 44, reason: 'Dairy fresh intake', reference: 'PO-2026-09-04', actor: 'owner' },
    { sku: 'PANEER-200G', type: 'SALE_OUT', quantity: 22, daysAgo: 36, reason: 'Catering dinner sales', reference: 'INV-2026-0916', actor: 'staff' },

    // Month 1 (~28-8 days ago) - October 2026 (Last 30 Days & High Activity)
    { sku: 'MILK-1L', type: 'PURCHASE_IN', quantity: 80, daysAgo: 26, reason: 'Weekly dairy bulk intake', reference: 'PO-2026-10-01', actor: 'owner' },
    { sku: 'MILK-1L', type: 'SALE_OUT', quantity: 45, daysAgo: 22, reason: 'Neighborhood daily morning milk dispatch', reference: 'INV-2026-1002', actor: 'staff' },
    { sku: 'BREAD-WHT', type: 'PURCHASE_IN', quantity: 40, daysAgo: 24, reason: 'Fresh bakery crate', reference: 'PO-2026-10-02', actor: 'owner' },
    { sku: 'BREAD-WHT', type: 'SALE_OUT', quantity: 22, daysAgo: 20, reason: 'Breakfast walk-ins', reference: 'INV-2026-1005', actor: 'staff' },
    { sku: 'RICE-BAS-5K', type: 'PURCHASE_IN', quantity: 25, daysAgo: 22, reason: 'Warehouse direct pallet delivery', reference: 'PO-2026-10-03', actor: 'owner' },
    { sku: 'RICE-BAS-5K', type: 'SALE_OUT', quantity: 12, daysAgo: 18, reason: 'Family bulk purchases', reference: 'INV-2026-1008', actor: 'staff' },
    { sku: 'OIL-SUN-1L', type: 'PURCHASE_IN', quantity: 30, daysAgo: 20, reason: 'Edible oil distributor batch', reference: 'PO-2026-10-04', actor: 'owner' },
    { sku: 'OIL-SUN-1L', type: 'SALE_OUT', quantity: 20, daysAgo: 16, reason: 'Festival festive snack cooking sales', reference: 'INV-2026-1011', actor: 'staff' },
    { sku: 'TEA-ASSAM-500', type: 'PURCHASE_IN', quantity: 25, daysAgo: 18, reason: 'Autumn specialty tea delivery', reference: 'PO-2026-10-05', actor: 'owner' },
    { sku: 'TEA-ASSAM-500', type: 'SALE_OUT', quantity: 12, daysAgo: 14, reason: 'Tea room wholesale', reference: 'INV-2026-1015', actor: 'staff' },
    { sku: 'EGGS-DOZ', type: 'PURCHASE_IN', quantity: 35, daysAgo: 16, reason: 'Poultry farm weekly delivery', reference: 'PO-2026-10-06', actor: 'owner' },
    { sku: 'EGGS-DOZ', type: 'SALE_OUT', quantity: 28, daysAgo: 12, reason: 'Morning diner breakfast orders', reference: 'INV-2026-1018', actor: 'staff' },

    // Recent 7 Days (Days 7 to 2) - Dense Recent Velocity
    { sku: 'MILK-1L', type: 'PURCHASE_IN', quantity: 40, daysAgo: 7, reason: 'Dairy morning tank delivery', reference: 'PO-2026-10-07', actor: 'owner' },
    { sku: 'MILK-1L', type: 'SALE_OUT', quantity: 15, daysAgo: 6, reason: 'Store counter sales', reference: 'INV-2026-1020', actor: 'staff' },
    { sku: 'BREAD-WHT', type: 'SALE_OUT', quantity: 8, daysAgo: 5, reason: 'Evening retail rush', reference: 'INV-2026-1021', actor: 'staff' },
    { sku: 'PANEER-200G', type: 'SALE_OUT', quantity: 5, daysAgo: 5, reason: 'Family dinner purchase', reference: 'INV-2026-1022', actor: 'staff' },
    { sku: 'BUTTER-500G', type: 'SALE_OUT', quantity: 5, daysAgo: 4, reason: 'Bakery retail walk-in', reference: 'INV-2026-1023', actor: 'staff' },
    { sku: 'OIL-SUN-1L', type: 'SALE_OUT', quantity: 6, daysAgo: 4, reason: 'Customer cooking oil purchase', reference: 'INV-2026-1024', actor: 'staff' },
    { sku: 'SALT-IOD-1K', type: 'SALE_OUT', quantity: 8, daysAgo: 3, reason: 'Retail counter sales', reference: 'INV-2026-1025', actor: 'staff' },
    { sku: 'DAL-TOOR-1K', type: 'SALE_OUT', quantity: 5, daysAgo: 3, reason: 'Pantry restocking order', reference: 'INV-2026-1026', actor: 'staff' },
    { sku: 'COFFEE-ROAST-200', type: 'SALE_OUT', quantity: 3, daysAgo: 2, reason: 'Fresh brew morning purchase', reference: 'INV-2026-1027', actor: 'staff' },

    // Yesterday (Day 1) - Clear out eggs, trigger low stock on oil & paneer
    { sku: 'EGGS-DOZ', type: 'SALE_OUT', quantity: 7, daysAgo: 1, reason: 'Evening bulk diner order (cleared all cartons)', reference: 'INV-2026-1028', actor: 'staff' },
    { sku: 'OIL-SUN-1L', type: 'SALE_OUT', quantity: 5, daysAgo: 1, reason: 'Walk-in customer purchase (reaches low stock alert)', reference: 'INV-2026-1029', actor: 'staff' },
    { sku: 'PANEER-200G', type: 'SALE_OUT', quantity: 4, daysAgo: 1, reason: 'Party food order (reaches low stock alert)', reference: 'INV-2026-1030', actor: 'staff' },

    // Today (Day 0) - Live day activity
    { sku: 'MILK-1L', type: 'PURCHASE_IN', quantity: 20, daysAgo: 0, hours: 8, reason: 'Early morning express dairy delivery', reference: 'PO-2026-10-LIVE', actor: 'owner' },
    { sku: 'MILK-1L', type: 'SALE_OUT', quantity: 7, daysAgo: 0, hours: 11, reason: 'Walk-in customer bottle sales', reference: 'INV-2026-1031', actor: 'staff' },
    { sku: 'BREAD-WHT', type: 'SALE_OUT', quantity: 5, daysAgo: 0, hours: 12, reason: 'Lunchtime bread sales', reference: 'INV-2026-1032', actor: 'staff' },
    { sku: 'RICE-BAS-5K', type: 'SALE_OUT', quantity: 3, daysAgo: 0, hours: 14, reason: 'Afternoon family grocery order', reference: 'INV-2026-1033', actor: 'staff' },
    { sku: 'MILK-1L', type: 'RETURN_IN', quantity: 1, daysAgo: 0, hours: 16, reason: 'Customer exchanged unopened chilled bottle', reference: 'RET-2026-1001', actor: 'staff' }
  ];

  // Sort timeline chronologically (earliest daysAgo first)
  timeline.sort((a, b) => b.daysAgo - a.daysAgo);

  console.log(`Seeding ${timeline.length} authoritative stock movement ledger records across the year...`);

  let count = 0;
  for (const item of timeline) {
    const product = createdProducts[item.sku];
    if (!product) continue;

    const actorId = item.actor === 'owner' ? owner._id : staff._id;
    const movementDate = getPastDate(item.daysAgo, item.hours || 10, (count * 7) % 60);

    await stockMovementService.recordStockMovement({
      productId: product._id,
      type: item.type,
      quantity: item.quantity,
      reason: item.reason,
      actorId,
      movementDate,
      reference: item.reference
    });

    count++;
  }

  console.log(`✓ Recorded all ${count} chronological movements strictly via StockMovementService domain logic.`);

  // 5. Run 100% strict Ledger vs Projection Parity Audit
  console.log('\n--- Verifying Stock Ledger Parity for All Seeded Products ---');
  let allParityPassed = true;

  for (const [sku, prod] of Object.entries(createdProducts)) {
    const parity = await stockMovementService.verifyStockParity(prod._id);
    const status = parity.parity ? '✅ PARITY OK' : '❌ MISMATCH';

    // Refresh product to show final stock
    const freshProd = await Product.findById(prod._id).lean();
    let healthLabel = 'OPTIMAL';
    if (freshProd && freshProd.currentStock === 0) healthLabel = '🚨 OUT OF STOCK';
    else if (freshProd && freshProd.currentStock <= freshProd.lowStockThreshold) healthLabel = '⚠️ LOW STOCK';

    console.log(
      `Product [${sku.padEnd(15)}] ${prod.name.padEnd(35)}: Stock = ${String(parity.projectedStock).padStart(3)} ${prod.unit.padEnd(6)} | Ledger = ${String(parity.derivedStock).padStart(3)} | ${status} | ${healthLabel}`
    );

    if (!parity.parity) allParityPassed = false;
  }

  if (!allParityPassed) {
    throw new Error('Seed validation error: One or more products had ledger/projection parity mismatch.');
  }

  console.log('\n================================================================');
  console.log('  Database Seed Completed Successfully! (12 Months of Ledger History)');
  console.log('================================================================');
  console.log('  Official Demo Credentials:');
  console.log(`    OWNER: ${DEMO_CREDENTIALS.owner.email}     / ${DEMO_CREDENTIALS.owner.password}`);
  console.log(`    STAFF: ${DEMO_CREDENTIALS.staff.email}     / ${DEMO_CREDENTIALS.staff.password}`);
  console.log('  Alternative Demo Logins:');
  console.log(`    OWNER: ${DEMO_CREDENTIALS.ownerDemo.email}              / ${DEMO_CREDENTIALS.ownerDemo.password}`);
  console.log(`    STAFF: ${DEMO_CREDENTIALS.staffDemo.email}              / ${DEMO_CREDENTIALS.staffDemo.password}`);
  console.log('================================================================\n');
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
