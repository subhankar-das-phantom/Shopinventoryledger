import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  sku: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 50,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: 2,
      maxlength: 150,
      index: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      maxlength: 80,
      index: true
    },
    unit: {
      type: String,
      required: [true, 'Unit is required'],
      trim: true,
      default: 'pcs',
      maxlength: 20
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be greater than or equal to 0']
    },
    lowStockThreshold: {
      type: Number,
      required: [true, 'Low stock threshold is required'],
      min: [0, 'Low stock threshold cannot be negative'],
      default: 5
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for searching and filtering active products
productSchema.index({ isActive: 1, category: 1, name: 1 });
productSchema.index({ name: 'text', sku: 'text', category: 'text' });

export const Product: Model<IProduct> = mongoose.model<IProduct>('Product', productSchema);
