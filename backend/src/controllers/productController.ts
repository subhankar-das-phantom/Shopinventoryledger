import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'express';
import mongooseLib from 'mongoose';
import { Product } from '../models/Product.js';
import { StockBalance } from '../models/StockBalance.js';
import { stockMovementService } from '../services/stockMovementService.js';
import { AppError } from '../middleware/errorHandler.js';

export const createProductSchema = z.object({
  body: z.object({
    sku: z
      .string()
      .trim()
      .min(2, 'SKU must be at least 2 characters')
      .max(50, 'SKU cannot exceed 50 characters')
      .regex(/^[A-Za-z0-9_-]+$/, 'SKU may only contain letters, numbers, hyphens, and underscores'),
    name: z
      .string()
      .trim()
      .min(2, 'Product name must be at least 2 characters')
      .max(150, 'Product name cannot exceed 150 characters'),
    category: z
      .string()
      .trim()
      .min(2, 'Category must be at least 2 characters')
      .max(80, 'Category cannot exceed 80 characters'),
    unit: z.string().trim().min(1, 'Unit is required').max(20).default('pcs'),
    price: z.number().min(0, 'Price must be non-negative'),
    lowStockThreshold: z.number().min(0, 'Threshold must be non-negative').default(5)
  })
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format')
  }),
  body: z.object({
    name: z.string().trim().min(2).max(150).optional(),
    category: z.string().trim().min(2).max(80).optional(),
    unit: z.string().trim().min(1).max(20).optional(),
    price: z.number().min(0).optional(),
    lowStockThreshold: z.number().min(0).optional(),
    isActive: z.boolean().optional()
  })
});

export const productIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format')
  })
});

export const productListQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    category: z.string().trim().optional(),
    status: z.enum(['active', 'inactive', 'all']).default('all'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  })
});

export const productController = {
  /**
   * Get paginated products with joined derived stock balance
   */
  async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, category, status = 'all', page = 1, limit = 20 } = req.query as any;

      const matchStage: any = {};

      if (status === 'active') {
        matchStage.isActive = true;
      } else if (status === 'inactive') {
        matchStage.isActive = false;
      }

      if (category && category !== 'all') {
        const safeCat = String(category).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        matchStage.category = { $regex: new RegExp(`^${safeCat}$`, 'i') };
      }

      if (search) {
        const safeRegex = String(search).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        matchStage.$or = [
          { name: { $regex: safeRegex, $options: 'i' } },
          { sku: { $regex: safeRegex, $options: 'i' } },
          { category: { $regex: safeRegex, $options: 'i' } }
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [products, totalCount, categories] = await Promise.all([
        Product.aggregate([
          { $match: matchStage },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: Number(limit) },
          {
            $lookup: {
              from: 'stockbalances',
              localField: '_id',
              foreignField: 'productId',
              as: 'balanceDoc'
            }
          },
          {
            $project: {
              _id: 1,
              sku: 1,
              name: 1,
              category: 1,
              unit: 1,
              price: 1,
              lowStockThreshold: 1,
              isActive: 1,
              createdAt: 1,
              updatedAt: 1,
              currentStock: {
                $ifNull: [{ $arrayElemAt: ['$balanceDoc.currentStock', 0] }, 0]
              }
            }
          }
        ]),
        Product.countDocuments(matchStage),
        Product.distinct('category')
      ]);

      res.status(200).json({
        success: true,
        data: products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / Number(limit))
        },
        categories
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get single product with stock details
   */
  async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const product = await Product.findById(id);
      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const balance = await StockBalance.findOne({ productId: product._id });
      const currentStock = balance ? balance.currentStock : 0;

      res.status(200).json({
        success: true,
        data: {
          ...product.toObject(),
          currentStock,
          isLowStock: currentStock <= product.lowStockThreshold
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create new product (Owner only)
   */
  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sku, name, category, unit, price, lowStockThreshold } = req.body;

      // Check for SKU uniqueness
      const existingSku = await Product.findOne({ sku: sku.toUpperCase() });
      if (existingSku) {
        throw new AppError(`Product with SKU '${sku.toUpperCase()}' already exists.`, 409);
      }

      const product = new Product({
        sku: sku.toUpperCase(),
        name,
        category,
        unit,
        price,
        lowStockThreshold,
        isActive: true
      });

      await product.save();

      // Initialize derived StockBalance projection at 0
      await stockMovementService.ensureBalanceProjection(product._id);

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: {
          ...product.toObject(),
          currentStock: 0
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update product metadata (Owner only)
   */
  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const product = await Product.findById(id);
      if (!product) {
        throw new AppError('Product not found', 404);
      }

      // Apply allowable updates
      if (updates.name !== undefined) product.name = updates.name;
      if (updates.category !== undefined) product.category = updates.category;
      if (updates.unit !== undefined) product.unit = updates.unit;
      if (updates.price !== undefined) product.price = updates.price;
      if (updates.lowStockThreshold !== undefined)
        product.lowStockThreshold = updates.lowStockThreshold;
      if (updates.isActive !== undefined) product.isActive = updates.isActive;

      await product.save();

      const balance = await StockBalance.findOne({ productId: product._id });
      const currentStock = balance ? balance.currentStock : 0;

      res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        data: {
          ...product.toObject(),
          currentStock
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Deactivate product (Owner only)
   */
  async deactivateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const product = await Product.findById(id);
      if (!product) {
        throw new AppError('Product not found', 404);
      }

      // Toggle or deactivate
      product.isActive = !product.isActive;
      await product.save();

      res.status(200).json({
        success: true,
        message: `Product ${product.isActive ? 'activated' : 'deactivated'} successfully`,
        data: product
      });
    } catch (error) {
      next(error);
    }
  }
};
