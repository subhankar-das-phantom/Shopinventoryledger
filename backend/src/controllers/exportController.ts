import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { generateExport, ExportColumn, ExportDefinition } from '../utils/export/index.js';

interface ProductExportRow {
  sku: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
  unitPrice: number;
  purchaseCost: number;
  inventoryValuation: number;
  stockHealth: string;
  status: string;
}

interface MovementExportRow {
  movementId: string;
  date: Date;
  productSku: string;
  productName: string;
  type: string;
  direction: string;
  quantity: number;
  unit: string;
  reference: string;
  reason: string;
}

export const exportController = {
  /**
   * Export Products Catalog with current stock and valuation metrics
   * Supports: format=excel | csv | json
   */
  async exportProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const format = (req.query.format as string) || 'excel';
      const search = (req.query.search as string) || '';
      const category = (req.query.category as string) || 'all';
      const stockFilter = (req.query.stockFilter as string) || 'all';

      // 1. Build Query
      const matchConditions: any = {};

      if (category !== 'all') {
        matchConditions.category = category;
      }

      if (search) {
        matchConditions.$or = [
          { name: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
          { barcode: { $regex: search, $options: 'i' } }
        ];
      }

      if (stockFilter === 'deactivated') {
        matchConditions.isActive = false;
      } else {
        matchConditions.isActive = true;
      }

      // 2. Fetch with Stock Balance lookup
      const pipeline: any[] = [
        { $match: matchConditions },
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
            costPrice: 1,
            lowStockThreshold: 1,
            isActive: 1,
            currentStock: {
              $ifNull: [{ $arrayElemAt: ['$balance.currentStock', 0] }, 0]
            }
          }
        }
      ];

      // Stock status filter
      if (stockFilter === 'in_stock') {
        pipeline.push({ $match: { currentStock: { $gt: 0 } } });
      } else if (stockFilter === 'low_stock') {
        pipeline.push({
          $match: {
            $expr: {
              $and: [
                { $gt: ['$currentStock', 0] },
                { $lte: ['$currentStock', '$lowStockThreshold'] }
              ]
            }
          }
        });
      } else if (stockFilter === 'out_of_stock') {
        pipeline.push({ $match: { currentStock: { $lte: 0 } } });
      }

      pipeline.push({ $sort: { category: 1, name: 1 } });

      const products = await Product.aggregate(pipeline);

      if (products.length === 0) {
        res.status(404).json({
          success: false,
          message: 'No products match the selected export criteria.'
        });
        return;
      }

      // 3. Map to Export Rows
      let totalStockUnits = 0;
      let totalValuation = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;
      const categoriesSet = new Set<string>();

      const dataRows: ProductExportRow[] = products.map((p) => {
        const cost = p.costPrice || p.price;
        const lineValuation = p.currentStock * cost;
        totalStockUnits += p.currentStock;
        totalValuation += lineValuation;
        if (p.category) categoriesSet.add(p.category);

        let stockHealth = 'HEALTHY';
        if (p.currentStock <= 0) {
          stockHealth = 'OUT_OF_STOCK';
          outOfStockCount++;
        } else if (p.currentStock <= p.lowStockThreshold) {
          stockHealth = 'LOW_STOCK';
          lowStockCount++;
        }

        return {
          sku: p.sku,
          name: p.name,
          category: p.category,
          unit: p.unit || 'pcs',
          currentStock: p.currentStock,
          lowStockThreshold: p.lowStockThreshold,
          unitPrice: p.price,
          purchaseCost: cost,
          inventoryValuation: lineValuation,
          stockHealth,
          status: p.isActive ? 'Active' : 'Deactivated'
        };
      });

      // 4. Define Columns
      const columns: ExportColumn<ProductExportRow>[] = [
        { key: 'sku', header: 'SKU Code', width: 16 },
        { key: 'name', header: 'Product Name', width: 32 },
        { key: 'category', header: 'Category', width: 22 },
        { key: 'unit', header: 'Unit', width: 12, align: 'center' },
        { key: 'currentStock', header: 'Current Stock', width: 16, align: 'right', format: 'number' },
        { key: 'lowStockThreshold', header: 'Threshold', width: 14, align: 'right', format: 'integer' },
        { key: 'purchaseCost', header: 'Purchase Cost', width: 16, align: 'right', format: 'currency' },
        { key: 'unitPrice', header: 'Selling Price', width: 16, align: 'right', format: 'currency' },
        { key: 'inventoryValuation', header: 'Valuation', width: 18, align: 'right', format: 'currency' },
        { key: 'stockHealth', header: 'Health Status', width: 16, align: 'center' },
        { key: 'status', header: 'Catalog Status', width: 14, align: 'center' }
      ];

      // 5. Build Definition
      const todayStr = new Date().toISOString().split('T')[0];
      const appliedFilters: Record<string, string> = {};
      if (category !== 'all') appliedFilters['Category'] = category;
      if (stockFilter !== 'all') appliedFilters['Stock Filter'] = stockFilter.toUpperCase();
      if (search) appliedFilters['Search Query'] = search;

      const definition: ExportDefinition<ProductExportRow> = {
        title: 'Inventory & Stock Valuation Report',
        filename: `products_export_${todayStr}`,
        columns,
        dataRows,
        metadata: {
          shopName: 'Shop Inventory Ledger',
          generatedBy: req.user?.name || 'Administrator',
          generatedAt: new Date(),
          filters: appliedFilters
        },
        summary: [
          { label: 'Total Products in Report', value: dataRows.length, format: 'integer' },
          { label: 'Total Stock Units', value: totalStockUnits, format: 'number' },
          { label: 'Total Inventory Valuation', value: totalValuation, format: 'currency' },
          { label: 'Low Stock Alert Items', value: lowStockCount, format: 'integer' },
          { label: 'Out of Stock Items', value: outOfStockCount, format: 'integer' },
          { label: 'Unique Categories', value: categoriesSet.size, format: 'integer' }
        ]
      };

      // 6. Generate and Send
      const result = await generateExport(definition, format);
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export Stock Ledger Movement History
   * Supports: format=excel | csv | json
   */
  async exportMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const format = (req.query.format as string) || 'excel';
      const type = req.query.type as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const productId = req.query.productId as string;

      const query: any = {};
      if (type) query.type = type;
      if (productId) query.productId = productId;

      if (startDate || endDate) {
        query.movementDate = {};
        if (startDate) query.movementDate.$gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          query.movementDate.$lte = end;
        }
      }

      const movements = await StockMovement.find(query)
        .populate('productId', 'sku name unit')
        .sort({ movementDate: -1, _id: -1 })
        .limit(10000)
        .lean();

      if (movements.length === 0) {
        res.status(404).json({
          success: false,
          message: 'No stock movements match the specified date range or filters.'
        });
        return;
      }

      let totalIn = 0;
      let totalOut = 0;

      const dataRows: MovementExportRow[] = movements.map((m: any) => {
        if (m.direction === 'IN') totalIn += m.quantity;
        else if (m.direction === 'OUT') totalOut += m.quantity;

        return {
          movementId: m.movementId,
          date: m.movementDate,
          productSku: m.productId?.sku || 'N/A',
          productName: m.productId?.name || 'Deleted Product',
          type: m.type,
          direction: m.direction,
          quantity: m.quantity,
          unit: m.productId?.unit || 'pcs',
          reference: m.reference || '-',
          reason: m.reason || '-'
        };
      });

      const columns: ExportColumn<MovementExportRow>[] = [
        { key: 'movementId', header: 'Movement Ref ID', width: 20 },
        { key: 'date', header: 'Timestamp', width: 22, format: 'datetime' },
        { key: 'productSku', header: 'SKU', width: 16 },
        { key: 'productName', header: 'Product Name', width: 30 },
        { key: 'type', header: 'Movement Type', width: 18, align: 'center' },
        { key: 'direction', header: 'Flow', width: 10, align: 'center' },
        { key: 'quantity', header: 'Quantity', width: 14, align: 'right', format: 'number' },
        { key: 'unit', header: 'Unit', width: 10, align: 'center' },
        { key: 'reference', header: 'Order / PO Ref', width: 18 },
        { key: 'reason', header: 'Audit Reason', width: 28 }
      ];

      const todayStr = new Date().toISOString().split('T')[0];
      const appliedFilters: Record<string, string> = {};
      if (type) appliedFilters['Movement Type'] = type;
      if (startDate) appliedFilters['Start Date'] = startDate;
      if (endDate) appliedFilters['End Date'] = endDate;

      const definition: ExportDefinition<MovementExportRow> = {
        title: 'Authoritative Stock Movement Ledger',
        filename: `stock_movements_export_${todayStr}`,
        columns,
        dataRows,
        metadata: {
          shopName: 'Shop Inventory Ledger',
          generatedBy: req.user?.name || 'Administrator',
          generatedAt: new Date(),
          filters: appliedFilters
        },
        summary: [
          { label: 'Total Recorded Movements', value: dataRows.length, format: 'integer' },
          { label: 'Total Inventory Inflows (IN)', value: totalIn, format: 'number' },
          { label: 'Total Inventory Outflows (OUT)', value: totalOut, format: 'number' },
          { label: 'Net Stock Inflow Delta', value: totalIn - totalOut, format: 'number' }
        ]
      };

      const result = await generateExport(definition, format);
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
    } catch (error) {
      next(error);
    }
  }
};
