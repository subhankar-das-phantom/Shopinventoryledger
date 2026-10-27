import mongoose, { ClientSession } from 'mongoose';
import crypto from 'crypto';
import { Product } from '../models/Product.js';
import {
  StockMovement,
  IStockMovement,
  MovementType,
  getMovementDirection
} from '../models/StockMovement.js';
import { StockBalance, IStockBalance } from '../models/StockBalance.js';
import { IdempotencyKey } from '../models/IdempotencyKey.js';
import { AppError } from '../middleware/errorHandler.js';
import { hasReplicaSetSupport } from '../config/db.js';

export interface RecordMovementParams {
  productId: string | mongoose.Types.ObjectId;
  type: MovementType;
  quantity: number;
  reason: string;
  actorId: string | mongoose.Types.ObjectId;
  movementDate?: Date;
  reference?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  session?: ClientSession;
}

export interface StockParityResult {
  productId: string;
  parity: boolean;
  derivedStock: number;
  projectedStock: number;
  movementCount: number;
  difference: number;
}

/**
 * Hash canonical payload for idempotency checking
 */
export const hashPayload = (payload: any): string => {
  const canonicalString = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(canonicalString).digest('hex');
};

export const stockMovementService = {
  /**
   * Reconstruct stock balance from the authoritative immutable movement ledger:
   * currentStock = sum(inflows) - sum(outflows)
   */
  async reconstructStock(productId: string | mongoose.Types.ObjectId): Promise<{
    currentStock: number;
    totalIn: number;
    totalOut: number;
    movementCount: number;
  }> {
    const pId = new mongoose.Types.ObjectId(productId.toString());

    const result = await StockMovement.aggregate([
      { $match: { productId: pId } },
      {
        $group: {
          _id: '$productId',
          totalIn: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'IN'] }, '$quantity', 0]
            }
          },
          totalOut: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'OUT'] }, '$quantity', 0]
            }
          },
          movementCount: { $sum: 1 }
        }
      }
    ]);

    if (!result || result.length === 0) {
      return { currentStock: 0, totalIn: 0, totalOut: 0, movementCount: 0 };
    }

    const totalIn = Math.round((result[0].totalIn + Number.EPSILON) * 1000) / 1000;
    const totalOut = Math.round((result[0].totalOut + Number.EPSILON) * 1000) / 1000;
    const currentStock = Math.round((totalIn - totalOut + Number.EPSILON) * 1000) / 1000;

    return {
      currentStock,
      totalIn,
      totalOut,
      movementCount: result[0].movementCount
    };
  },

  /**
   * Ensure a StockBalance projection document exists for a product
   */
  async ensureBalanceProjection(
    productId: string | mongoose.Types.ObjectId,
    session?: ClientSession
  ): Promise<IStockBalance> {
    const pId = new mongoose.Types.ObjectId(productId.toString());
    let balance = await StockBalance.findOne({ productId: pId }).session(session || null);

    if (!balance) {
      // Calculate initial stock from movement history if any
      const { currentStock } = await this.reconstructStock(pId);
      balance = new StockBalance({
        productId: pId,
        currentStock,
        version: 0
      });
      await balance.save({ session });
    }

    return balance;
  },

  /**
   * Verify parity between authoritative movement history and the derived StockBalance projection
   */
  async verifyStockParity(productId: string | mongoose.Types.ObjectId): Promise<StockParityResult> {
    const pId = new mongoose.Types.ObjectId(productId.toString());
    const [reconstructed, projection] = await Promise.all([
      this.reconstructStock(pId),
      StockBalance.findOne({ productId: pId })
    ]);

    const projectedStock = projection ? projection.currentStock : 0;
    const derivedStock = reconstructed.currentStock;
    const difference = Math.abs(derivedStock - projectedStock);
    const parity = difference < 0.0001;

    return {
      productId: pId.toString(),
      parity,
      derivedStock,
      projectedStock,
      movementCount: reconstructed.movementCount,
      difference
    };
  },

  /**
   * Record a stock movement with concurrency protection and strict invariant enforcement:
   * 1. Quantity must be strictly positive (> 0) and finite.
   * 2. Product must exist (and for sales, must be active).
   * 3. For outflows (SALE_OUT, ADJUSTMENT_OUT):
   *    Conditional atomic decrement: stock >= requested quantity.
   *    If insufficient stock: aborts immediately, zero movements inserted.
   * 4. For inflows (PURCHASE_IN, RETURN_IN, ADJUSTMENT_IN):
   *    Atomic increment on StockBalance.
   * 5. Creates immutable StockMovement record.
   * 6. Both operations committed atomically.
   */
  async recordStockMovement(params: RecordMovementParams): Promise<{
    movement: IStockMovement;
    currentStock: number;
  }> {
    const {
      productId,
      type,
      quantity,
      reason,
      actorId,
      movementDate = new Date(),
      reference = '',
      idempotencyKey,
      metadata = {}
    } = params;

    // 1. Validate quantity strictly
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new AppError('Quantity must be a positive number greater than zero', 400);
    }

    // 2. Validate product existence and status
    const pId = new mongoose.Types.ObjectId(productId.toString());
    const product = await Product.findById(pId);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    if (type === 'SALE_OUT' && !product.isActive) {
      throw new AppError('Cannot record a sale for a deactivated product', 400);
    }

    const direction = getMovementDirection(type);

    // 3. Ensure balance projection document is initialized
    await this.ensureBalanceProjection(pId);

    // Check if MongoDB replica set is available for multi-document ACID transactions
    const useMultiDocTransaction = hasReplicaSetSupport();

    if (useMultiDocTransaction) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        let updatedBalance: IStockBalance | null = null;

        if (direction === 'OUT') {
          // Guarded atomic decrement: guarantees currentStock >= quantity
          updatedBalance = await StockBalance.findOneAndUpdate(
            {
              productId: pId,
              currentStock: { $gte: quantity }
            },
            {
              $inc: { currentStock: -quantity, version: 1 }
            },
            { new: true, session }
          );

          if (!updatedBalance) {
            // Read current available stock for helpful error message
            const currentDoc = await StockBalance.findOne({ productId: pId }).session(session);
            const available = currentDoc ? currentDoc.currentStock : 0;
            throw new AppError(
              `Insufficient stock available for '${product.name}' (${product.sku}). Requested: ${quantity} ${product.unit}, Available: ${available} ${product.unit}.`,
              409
            );
          }
        } else {
          // Atomic increment for inflows
          updatedBalance = await StockBalance.findOneAndUpdate(
            { productId: pId },
            {
              $inc: { currentStock: quantity, version: 1 }
            },
            { new: true, session }
          );
        }

        // Insert movement record in the same transaction
        const movement = new StockMovement({
          productId: pId,
          type,
          direction,
          quantity,
          reason,
          movementDate,
          actorId: new mongoose.Types.ObjectId(actorId.toString()),
          reference,
          idempotencyKey,
          metadata
        });

        await movement.save({ session });

        // Update lastMovementId on balance projection
        if (updatedBalance) {
          updatedBalance.lastMovementId = movement._id;
          await updatedBalance.save({ session });
        }

        await session.commitTransaction();

        return {
          movement,
          currentStock: updatedBalance!.currentStock
        };
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } else {
      // Standalone mode: Conditional atomic update with compensating rollback
      let updatedBalance: IStockBalance | null = null;

      if (direction === 'OUT') {
        updatedBalance = await StockBalance.findOneAndUpdate(
          {
            productId: pId,
            currentStock: { $gte: quantity }
          },
          {
            $inc: { currentStock: -quantity, version: 1 }
          },
          { new: true }
        );

        if (!updatedBalance) {
          const currentDoc = await StockBalance.findOne({ productId: pId });
          const available = currentDoc ? currentDoc.currentStock : 0;
          throw new AppError(
            `Insufficient stock available for '${product.name}' (${product.sku}). Requested: ${quantity} ${product.unit}, Available: ${available} ${product.unit}.`,
            409
          );
        }
      } else {
        updatedBalance = await StockBalance.findOneAndUpdate(
          { productId: pId },
          {
            $inc: { currentStock: quantity, version: 1 }
          },
          { new: true }
        );
      }

      try {
        const movement = new StockMovement({
          productId: pId,
          type,
          direction,
          quantity,
          reason,
          movementDate,
          actorId: new mongoose.Types.ObjectId(actorId.toString()),
          reference,
          idempotencyKey,
          metadata
        });

        await movement.save();

        if (updatedBalance) {
          await StockBalance.updateOne(
            { productId: pId },
            { lastMovementId: movement._id }
          );
        }

        return {
          movement,
          currentStock: updatedBalance!.currentStock
        };
      } catch (movementError) {
        // Compensating rollback on balance projection if movement insert fails
        console.error('[StockMovementService] Movement insert failed, executing compensating balance rollback:', movementError);
        const compensationDelta = direction === 'OUT' ? quantity : -quantity;
        await StockBalance.updateOne(
          { productId: pId },
          { $inc: { currentStock: compensationDelta, version: 1 } }
        );
        throw movementError;
      }
    }
  },

  /**
   * Rebuild stock balance projection from the immutable movement ledger
   */
  async rebuildBalance(productId: string | mongoose.Types.ObjectId): Promise<IStockBalance> {
    const pId = new mongoose.Types.ObjectId(productId.toString());
    const { currentStock } = await this.reconstructStock(pId);

    const latestMovement = await StockMovement.findOne({ productId: pId })
      .sort({ createdAt: -1 })
      .select('_id');

    const updated = await StockBalance.findOneAndUpdate(
      { productId: pId },
      {
        currentStock,
        version: 0,
        lastMovementId: latestMovement?._id
      },
      { upsert: true, new: true }
    );

    return updated;
  }
};
