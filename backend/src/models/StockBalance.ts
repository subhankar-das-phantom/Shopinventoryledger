import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * StockBalance is a DERIVED PROJECTION designed for high-performance reads
 * and conditional atomic updates ($gte guard to prevent overselling).
 * 
 * IMPORTANT: The immutable StockMovement collection is the single authoritative source of truth.
 * StockBalance can be wiped and completely reconstructed from StockMovements at any time.
 */
export interface IStockBalance extends Document {
  _id: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  currentStock: number;
  version: number;
  lastMovementId?: mongoose.Types.ObjectId;
  updatedAt: Date;
}

const stockBalanceSchema = new Schema<IStockBalance>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
      index: true
    },
    currentStock: {
      type: Number,
      required: true,
      min: [0, 'Derived stock projection cannot be negative'],
      default: 0
    },
    version: {
      type: Number,
      required: true,
      default: 0
    },
    lastMovementId: {
      type: Schema.Types.ObjectId,
      ref: 'StockMovement'
    }
  },
  {
    timestamps: { createdAt: false, updatedAt: true }
  }
);

stockBalanceSchema.index({ currentStock: 1 });

export const StockBalance: Model<IStockBalance> = mongoose.model<IStockBalance>(
  'StockBalance',
  stockBalanceSchema
);
