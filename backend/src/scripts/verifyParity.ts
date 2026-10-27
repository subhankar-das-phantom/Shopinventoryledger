import { connectDB, disconnectDB } from '../config/db.js';
import { Product } from '../models/Product.js';
import { stockMovementService } from '../services/stockMovementService.js';

export const runParityAudit = async (): Promise<boolean> => {
  console.log('--- Starting System-Wide Stock Ledger Parity Audit ---');
  const products = await Product.find().sort({ sku: 1 });

  let allValid = true;
  let totalMovements = 0;

  for (const product of products) {
    const result = await stockMovementService.verifyStockParity(product._id);
    totalMovements += result.movementCount;

    const statusBadge = result.parity ? '✅ VALID' : '❌ DISCREPANCY DETECTED';
    console.log(
      `[${product.sku}] ${product.name.padEnd(35)} | Movements: ${String(result.movementCount).padStart(3)} | Derived: ${String(result.derivedStock).padStart(4)} ${product.unit} | Projected: ${String(result.projectedStock).padStart(4)} ${product.unit} | ${statusBadge}`
    );

    if (!result.parity) {
      allValid = false;
      console.error(
        `  -> ALERT: Difference of ${result.difference} units detected for product ${product.sku}!`
      );
    }
  }

  console.log('------------------------------------------------------');
  console.log(`Audited ${products.length} products across ${totalMovements} historical movements.`);

  if (allValid) {
    console.log('✅ AUDIT PASSED: 100% agreement between immutable movement ledger and projected balances.');
  } else {
    console.error('❌ AUDIT FAILED: Discrepancies detected between ledger and projections.');
  }

  return allValid;
};

if (process.argv[1] && process.argv[1].includes('verifyParity')) {
  (async () => {
    try {
      await connectDB();
      const success = await runParityAudit();
      await disconnectDB();
      process.exit(success ? 0 : 1);
    } catch (err) {
      console.error('Parity verification failed:', err);
      process.exit(1);
    }
  })();
}
