import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { StockMovement, MovementType } from '../models/StockMovement.js';
import { StockBalance } from '../models/StockBalance.js';
import { IdempotencyKey } from '../models/IdempotencyKey.js';
import { stockMovementService, hashPayload } from '../services/stockMovementService.js';
import { AppError } from '../middleware/errorHandler.js';

// Validation Schemas
export const baseMovementSchema = z.object({
  body: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format'),
    quantity: z.number().positive('Quantity must be strictly greater than zero'),
    reason: z.string().trim().min(2, 'Reason must be at least 2 characters').max(500),
    reference: z.string().trim().max(100).optional().default(''),
    movementDate: z.coerce.date().optional()
  })
});

export const adjustmentSchema = z.object({
  body: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format'),
    type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'], {
      errorMap: () => ({ message: "Type must be either 'ADJUSTMENT_IN' or 'ADJUSTMENT_OUT'" })
    }),
    quantity: z.number().positive('Quantity must be strictly greater than zero'),
    reason: z.string().trim().min(2, 'Reason must be at least 2 characters').max(500),
    reference: z.string().trim().max(100).optional().default(''),
    movementDate: z.coerce.date().optional()
  })
});

export const movementListQuerySchema = z.object({
  query: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format').optional(),
    type: z.enum(['PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT']).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  })
});

export const productMovementQuerySchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format')
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  })
});

/**
 * Helper to handle idempotency checking and recording
 */
async function executeWithIdempotency(
  req: Request,
  res: Response,
  endpoint: string,
  fn: (idempotencyKey?: string) => Promise<{ statusCode: number; data: any }>
): Promise<void> {
  const idempotencyKey =
    (req.headers['idempotency-key'] as string) || (req.body.idempotencyKey as string);

  if (!idempotencyKey) {
    const result = await fn();
    res.status(result.statusCode).json(result.data);
    return;
  }

  const userId = req.user!._id;
  const requestHash = hashPayload(req.body);

  // Check if idempotency key exists for this user and endpoint
  const existing = await IdempotencyKey.findOne({
    userId,
    key: idempotencyKey,
    endpoint
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new AppError(
        'Idempotency key reused with a different request payload. Use a new unique idempotency key for new operations.',
        409
      );
    }

    // Identical retry: return previously stored response
    res.setHeader('X-Idempotent-Replay', 'true');
    res.status(existing.statusCode).json(existing.responseBody);
    return;
  }

  // Execute the state change
  const result = await fn(idempotencyKey);

  // Store idempotency record for replay safety
  try {
    await IdempotencyKey.create({
      key: idempotencyKey,
      userId,
      endpoint,
      requestHash,
      statusCode: result.statusCode,
      responseBody: result.data
    });
  } catch (err) {
    console.warn('[Idempotency] Failed to record idempotency key (likely race condition):', err);
  }

  res.status(result.statusCode).json(result.data);
}

export const stockMovementController = {
  /**
   * Record SALE_OUT (Staff & Owner)
   */
  async recordSale(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await executeWithIdempotency(req, res, '/api/stock-movements/sale', async (idempotencyKey) => {
        const { productId, quantity, reason, reference, movementDate } = req.body;
        const actorId = req.user!._id;

        const result = await stockMovementService.recordStockMovement({
          productId,
          type: 'SALE_OUT',
          quantity,
          reason,
          actorId,
          reference,
          movementDate,
          idempotencyKey
        });

        return {
          statusCode: 201,
          data: {
            success: true,
            message: 'Sale recorded successfully',
            data: {
              movement: result.movement,
              currentStock: result.currentStock
            }
          }
        };
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Record RETURN_IN (Staff & Owner)
   */
  async recordReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await executeWithIdempotency(req, res, '/api/stock-movements/return', async (idempotencyKey) => {
        const { productId, quantity, reason, reference, movementDate } = req.body;
        const actorId = req.user!._id;

        const result = await stockMovementService.recordStockMovement({
          productId,
          type: 'RETURN_IN',
          quantity,
          reason,
          actorId,
          reference,
          movementDate,
          idempotencyKey
        });

        return {
          statusCode: 201,
          data: {
            success: true,
            message: 'Return recorded successfully',
            data: {
              movement: result.movement,
              currentStock: result.currentStock
            }
          }
        };
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Record PURCHASE_IN (Owner only)
   */
  async recordPurchase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await executeWithIdempotency(
        req,
        res,
        '/api/stock-movements/purchase',
        async (idempotencyKey) => {
          const { productId, quantity, reason, reference, movementDate } = req.body;
          const actorId = req.user!._id;

          const result = await stockMovementService.recordStockMovement({
            productId,
            type: 'PURCHASE_IN',
            quantity,
            reason,
            actorId,
            reference,
            movementDate,
            idempotencyKey
          });

          return {
            statusCode: 201,
            data: {
              success: true,
              message: 'Purchase recorded successfully',
              data: {
                movement: result.movement,
                currentStock: result.currentStock
              }
            }
          };
        }
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Record ADJUSTMENT_IN or ADJUSTMENT_OUT (Owner only)
   */
  async recordAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await executeWithIdempotency(
        req,
        res,
        '/api/stock-movements/adjustment',
        async (idempotencyKey) => {
          const { productId, type, quantity, reason, reference, movementDate } = req.body;
          const actorId = req.user!._id;

          const result = await stockMovementService.recordStockMovement({
            productId,
            type: type as MovementType,
            quantity,
            reason,
            actorId,
            reference,
            movementDate,
            idempotencyKey
          });

          return {
            statusCode: 201,
            data: {
              success: true,
              message: `Adjustment (${type === 'ADJUSTMENT_IN' ? 'Addition' : 'Removal'}) recorded successfully`,
              data: {
                movement: result.movement,
                currentStock: result.currentStock
              }
            }
          };
        }
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get bounded movement history for a specific product
   */
  async getProductMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query as any;

      const pId = new mongoose.Types.ObjectId(id);
      const skip = (Number(page) - 1) * Number(limit);

      const [movements, total] = await Promise.all([
        StockMovement.aggregate([
          { $match: { productId: pId } },
          { $sort: { movementDate: -1, _id: -1 } },
          { $skip: skip },
          { $limit: Number(limit) },
          {
            $lookup: {
              from: 'users',
              localField: 'actorId',
              foreignField: '_id',
              as: 'actor'
            }
          },
          {
            $project: {
              _id: 1,
              movementId: 1,
              productId: 1,
              type: 1,
              direction: 1,
              quantity: 1,
              reason: 1,
              reference: 1,
              movementDate: 1,
              createdAt: 1,
              actor: {
                $let: {
                  vars: { u: { $arrayElemAt: ['$actor', 0] } },
                  in: {
                    id: '$$u._id',
                    name: '$$u.name',
                    role: '$$u.role'
                  }
                }
              }
            }
          }
        ]),
        StockMovement.countDocuments({ productId: pId })
      ]);

      res.status(200).json({
        success: true,
        data: movements,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get bounded movements across all products with filtering
   */
  async getMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId, type, dateFrom, dateTo, page = 1, limit = 20 } = req.query as any;

      const match: any = {};
      if (productId) match.productId = new mongoose.Types.ObjectId(productId);
      if (type) match.type = type;

      if (dateFrom || dateTo) {
        match.movementDate = {};
        if (dateFrom) match.movementDate.$gte = new Date(dateFrom);
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          match.movementDate.$lte = toDate;
        }
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [movements, total] = await Promise.all([
        StockMovement.aggregate([
          { $match: match },
          { $sort: { movementDate: -1, _id: -1 } },
          { $skip: skip },
          { $limit: Number(limit) },
          {
            $lookup: {
              from: 'products',
              localField: 'productId',
              foreignField: '_id',
              as: 'product'
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'actorId',
              foreignField: '_id',
              as: 'actor'
            }
          },
          {
            $project: {
              _id: 1,
              movementId: 1,
              productId: 1,
              type: 1,
              direction: 1,
              quantity: 1,
              reason: 1,
              reference: 1,
              movementDate: 1,
              createdAt: 1,
              product: {
                $let: {
                  vars: { p: { $arrayElemAt: ['$product', 0] } },
                  in: {
                    id: '$$p._id',
                    name: '$$p.name',
                    sku: '$$p.sku',
                    unit: '$$p.unit'
                  }
                }
              },
              actor: {
                $let: {
                  vars: { u: { $arrayElemAt: ['$actor', 0] } },
                  in: {
                    id: '$$u._id',
                    name: '$$u.name',
                    role: '$$u.role'
                  }
                }
              }
            }
          }
        ]),
        StockMovement.countDocuments(match)
      ]);

      res.status(200).json({
        success: true,
        data: movements,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Dedicated low-stock view showing products where currentStock <= lowStockThreshold
   */
  async getLowStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lowStockProducts = await Product.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'stockbalances',
            localField: '_id',
            foreignField: 'productId',
            as: 'balance'
          }
        },
        {
          $addFields: {
            currentStock: {
              $ifNull: [{ $arrayElemAt: ['$balance.currentStock', 0] }, 0]
            }
          }
        },
        {
          $match: {
            $expr: {
              $lte: ['$currentStock', '$lowStockThreshold']
            }
          }
        },
        {
          $sort: { currentStock: 1, name: 1 }
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
            currentStock: 1,
            isZeroStock: { $eq: ['$currentStock', 0] }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        count: lowStockProducts.length,
        data: lowStockProducts
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Verify parity between ledger movements and StockBalance projection (Owner only)
   */
  async verifyParity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await stockMovementService.verifyStockParity(id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export stock report in CSV format (Owner only)
   * With formula injection protection (RFC 4180 escaping)
   */
  async exportCsvReport(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const products = await Product.aggregate([
        {
          $lookup: {
            from: 'stockbalances',
            localField: '_id',
            foreignField: 'productId',
            as: 'balance'
          }
        },
        {
          $project: {
            sku: 1,
            name: 1,
            category: 1,
            unit: 1,
            price: 1,
            lowStockThreshold: 1,
            isActive: 1,
            currentStock: {
              $ifNull: [{ $arrayElemAt: ['$balance.currentStock', 0] }, 0]
            }
          }
        },
        { $sort: { category: 1, name: 1 } }
      ]);

      // Helper to sanitize and escape CSV cell against formula injection
      const sanitizeCell = (val: any): string => {
        if (val === null || val === undefined) return '""';
        let str = String(val).trim();
        // Prevent formula injection: prefix leading =, +, -, @, \t, \r with single quote
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        // Escape quotes
        str = str.replace(/"/g, '""');
        return `"${str}"`;
      };

      const headers = [
        'SKU',
        'Product Name',
        'Category',
        'Unit',
        'Current Stock',
        'Low Stock Threshold',
        'Unit Price',
        'Low Stock Status',
        'Active Status'
      ];

      const rows = products.map((p) => {
        const isLow = p.currentStock <= p.lowStockThreshold;
        return [
          sanitizeCell(p.sku),
          sanitizeCell(p.name),
          sanitizeCell(p.category),
          sanitizeCell(p.unit),
          sanitizeCell(p.currentStock),
          sanitizeCell(p.lowStockThreshold),
          sanitizeCell(p.price.toFixed(2)),
          sanitizeCell(isLow ? 'LOW STOCK' : 'NORMAL'),
          sanitizeCell(p.isActive ? 'ACTIVE' : 'DEACTIVATED')
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\r\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="shop_stock_report_${new Date().toISOString().slice(0, 10)}.csv"`
      );

      res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Executive Analytics: Stock Velocity, Category Distribution, Valuation, Turnover
   */
  async getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = Number(req.query.days) || 14;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // 1. Fetch active products with derived balances
      const products = await Product.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'stockbalances',
            localField: '_id',
            foreignField: 'productId',
            as: 'balance'
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
            currentStock: {
              $ifNull: [{ $arrayElemAt: ['$balance.currentStock', 0] }, 0]
            }
          }
        }
      ]);

      let totalValuation = 0;
      let totalUnits = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;
      let optimalCount = 0;

      const categoryMap: Record<string, { skuCount: number; stockUnits: number; totalValue: number }> = {};

      for (const p of products) {
        const stock = p.currentStock || 0;
        const value = stock * (p.price || 0);
        totalValuation += value;
        totalUnits += stock;

        if (stock === 0) {
          outOfStockCount++;
        } else if (stock <= p.lowStockThreshold) {
          lowStockCount++;
        } else {
          optimalCount++;
        }

        const cat = p.category || 'General';
        if (!categoryMap[cat]) {
          categoryMap[cat] = { skuCount: 0, stockUnits: 0, totalValue: 0 };
        }
        categoryMap[cat].skuCount++;
        categoryMap[cat].stockUnits += stock;
        categoryMap[cat].totalValue += value;
      }

      const categoryDistribution = Object.entries(categoryMap).map(([name, data]) => ({
        name,
        skuCount: data.skuCount,
        stockUnits: data.stockUnits,
        totalValue: Math.round(data.totalValue),
        percentage: totalValuation > 0 ? Number(((data.totalValue / totalValuation) * 100).toFixed(1)) : 0
      })).sort((a, b) => b.totalValue - a.totalValue);

      // 2. Daily velocity aggregation over the last `days` days
      const movementsInPeriod = await StockMovement.aggregate([
        {
          $match: {
            movementDate: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$movementDate' } },
              direction: '$direction'
            },
            totalQuantity: { $sum: '$quantity' }
          }
        }
      ]);

      const dailyMap: Record<string, { date: string; label: string; inflow: number; outflow: number; net: number }> = {};
      const today = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const label = `${dd}/${mm}`;
        dailyMap[dateStr] = { date: dateStr, label, inflow: 0, outflow: 0, net: 0 };
      }

      let inflow30d = 0;
      let outflow30d = 0;

      for (const item of movementsInPeriod) {
        const dateStr = item._id.date;
        const qty = item.totalQuantity || 0;
        if (dailyMap[dateStr]) {
          if (item._id.direction === 'IN') {
            dailyMap[dateStr].inflow += qty;
          } else {
            dailyMap[dateStr].outflow += qty;
          }
          dailyMap[dateStr].net = dailyMap[dateStr].inflow - dailyMap[dateStr].outflow;
        }
        if (item._id.direction === 'IN') inflow30d += qty;
        else outflow30d += qty;
      }

      const velocity = Object.values(dailyMap);

      // 3. Top fast-moving products (Turnover by sales)
      const topSales = await StockMovement.aggregate([
        {
          $match: {
            type: 'SALE_OUT',
            movementDate: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$productId',
            unitsSold: { $sum: '$quantity' },
            transactionCount: { $sum: 1 }
          }
        },
        { $sort: { unitsSold: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        {
          $project: {
            productId: '$_id',
            unitsSold: 1,
            transactionCount: 1,
            name: { $ifNull: [{ $arrayElemAt: ['$product.name', 0] }, 'Unknown Product'] },
            sku: { $ifNull: [{ $arrayElemAt: ['$product.sku', 0] }, '—'] },
            category: { $ifNull: [{ $arrayElemAt: ['$product.category', 0] }, '—'] },
            unit: { $ifNull: [{ $arrayElemAt: ['$product.unit', 0] }, 'units'] },
            price: { $ifNull: [{ $arrayElemAt: ['$product.price', 0] }, 0] }
          }
        }
      ]);

      const topProducts = topSales.map((s) => ({
        ...s,
        revenue: Math.round(s.unitsSold * s.price)
      }));

      // 4. Sales performance by category over the selected period
      const categorySalesAgg = await StockMovement.aggregate([
        {
          $match: {
            type: 'SALE_OUT',
            movementDate: { $gte: startDate }
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $group: {
            _id: { $ifNull: ['$product.category', 'General'] },
            unitsSold: { $sum: '$quantity' },
            revenue: { $sum: { $multiply: ['$quantity', { $ifNull: ['$product.price', 0] }] } }
          }
        },
        { $sort: { revenue: -1 } }
      ]);

      const totalSalesRevenue = categorySalesAgg.reduce((acc, c) => acc + (c.revenue || 0), 0);
      const categorySales = categorySalesAgg.map((c) => ({
        name: c._id,
        unitsSold: c.unitsSold,
        totalValue: Math.round(c.revenue),
        percentage: totalSalesRevenue > 0 ? Number(((c.revenue / totalSalesRevenue) * 100).toFixed(1)) : 0
      }));

      res.status(200).json({
        success: true,
        data: {
          summary: {
            totalValuation: Math.round(totalValuation),
            totalUnits,
            activeSkus: products.length,
            lowStockCount,
            outOfStockCount,
            optimalCount,
            inflow30d,
            outflow30d,
            net30d: inflow30d - outflow30d
          },
          velocity,
          categoryDistribution,
          categorySales,
          topProducts
        }
      });
    } catch (error) {
      next(error);
    }
  }
};
