import mongoose, { Document, Schema, Model } from 'mongoose';
import crypto from 'crypto';

export type MovementType =
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'RETURN_IN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT';

export type MovementDirection = 'IN' | 'OUT';

export interface IStockMovement extends Document {
  _id: mongoose.Types.ObjectId;
  movementId: string;
  productId: mongoose.Types.ObjectId;
  type: MovementType;
  direction: MovementDirection;
  quantity: number;
  reason: string;
  movementDate: Date;
  actorId: mongoose.Types.ObjectId;
  reference?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export const getMovementDirection = (type: MovementType): MovementDirection => {
  switch (type) {
    case 'PURCHASE_IN':
    case 'RETURN_IN':
    case 'ADJUSTMENT_IN':
      return 'IN';
    case 'SALE_OUT':
    case 'ADJUSTMENT_OUT':
      return 'OUT';
    default:
      throw new Error(`Unknown movement type: ${type}`);
  }
};

const stockMovementSchema = new Schema<IStockMovement>(
  {
    movementId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `mov_${crypto.randomBytes(12).toString('hex')}`
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true
    },
    type: {
      type: String,
      enum: ['PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'],
      required: [true, 'Movement type is required'],
      index: true
    },
    direction: {
      type: String,
      enum: ['IN', 'OUT'],
      required: [true, 'Direction is required']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.0001, 'Quantity must be strictly positive']
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
      minlength: 2,
      maxlength: 500
    },
    movementDate: {
      type: Date,
      required: [true, 'Movement date is required'],
      default: Date.now,
      index: true
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor ID is required'],
      index: true
    },
    reference: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ''
    },
    idempotencyKey: {
      type: String,
      trim: true,
      index: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false } // Movements are append-only audit records!
  }
);

// Compound indexes for bounded movement history queries
stockMovementSchema.index({ productId: 1, movementDate: -1, _id: -1 });
stockMovementSchema.index({ productId: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1, movementDate: -1 });
stockMovementSchema.index({ actorId: 1, movementDate: -1 });

export const StockMovement: Model<IStockMovement> = mongoose.model<IStockMovement>(
  'StockMovement',
  stockMovementSchema
);
