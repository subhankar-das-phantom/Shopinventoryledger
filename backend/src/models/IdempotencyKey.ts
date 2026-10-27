import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IIdempotencyKey extends Document {
  key: string;
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  requestHash: string;
  statusCode: number;
  responseBody: any;
  createdAt: Date;
}

const idempotencyKeySchema = new Schema<IIdempotencyKey>(
  {
    key: {
      type: String,
      required: true,
      trim: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    endpoint: {
      type: String,
      required: true
    },
    requestHash: {
      type: String,
      required: true
    },
    statusCode: {
      type: Number,
      required: true
    },
    responseBody: {
      type: Schema.Types.Mixed,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400 // TTL: Automatically remove keys after 24 hours (86400 seconds)
    }
  },
  {
    timestamps: false
  }
);

// Compound unique index ensuring key is unique per user and endpoint scope
idempotencyKeySchema.index({ userId: 1, key: 1, endpoint: 1 }, { unique: true });

export const IdempotencyKey: Model<IIdempotencyKey> = mongoose.model<IIdempotencyKey>(
  'IdempotencyKey',
  idempotencyKeySchema
);
