import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api, extractErrorMessage } from '../api/client.js';
import { Product, StockMovement, LowStockProduct } from '../types/index.js';
import { MovementTypeBadge, StockStatusBadge } from '../components/Badge.js';
import {
  Package,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  SlidersHorizontal,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  Clock,
  Layers
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  onOpenMovementModal: (type?: any, productId?: string) => void;
  onOpenProductModal: () => void;
}

export const DashboardPage: React.FC<DashboardProps> = ({
  onNavigate,
  onOpenMovementModal,
  onOpenProductModal
}) => {
  const { isOwner } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockProduct[]>([]);
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, lowRes, movRes] = await Promise.all([
        api.get('/products?limit=100'),
        api.get('/stock/low-stock'),
        api.get('/stock-movements?limit=6')
      ]);

      if (prodRes.data.success) setProducts(prodRes.data.data);
      if (lowRes.data.success) setLowStockItems(lowRes.data.data);
      if (movRes.data.success) setRecentMovements(movRes.data.data);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const totalActiveSkus = products.filter((p) => p.isActive).length;
  const totalStockUnits = products.reduce((sum, p) => sum + (p.currentStock || 0), 0);
  const outOfStockCount = lowStockItems.filter((p) => p.isZeroStock).length;
  const lowStockCount = lowStockItems.length;

  const handleExportCsv = async () => {
    try {
      const response = await api.get('/stock/report.csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `shop_inventory_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert(`Export failed: ${extractErrorMessage(err)}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Inventory Overview</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time stock calculated dynamically from the immutable movement ledger
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchDashboardData}
            title="Refresh Ledger"
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {isOwner && (
            <>
              <button
                onClick={onOpenProductModal}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition"
              >
                <Package className="w-4 h-4" />
                <span>Add Product</span>
              </button>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-lg text-sm font-medium transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export CSV</span>
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-200 text-sm">
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-slate-800/60 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Catalog</span>
            <Package className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white mt-2 font-mono">
            {totalActiveSkus}
          </div>
          <div className="text-xs text-slate-400 mt-1">Unique active SKUs</div>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-800/60 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Physical Balance</span>
            <Layers className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white mt-2 font-mono">
            {totalStockUnits.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1">Total combined stock units</div>
        </div>

        {/* Metric 3 */}
        <div
          onClick={() => onNavigate('low-stock')}
          className="bg-slate-800/60 border border-slate-800 hover:border-amber-700/50 p-4 rounded-xl relative overflow-hidden cursor-pointer transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">Low Stock</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-300 mt-2 font-mono">
            {lowStockCount}
          </div>
          <div className="text-xs text-slate-400 mt-1">Items at or below threshold</div>
        </div>

        {/* Metric 4 */}
        <div
          onClick={() => onNavigate('low-stock')}
          className="bg-slate-800/60 border border-slate-800 hover:border-rose-700/50 p-4 rounded-xl relative overflow-hidden cursor-pointer transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-400 uppercase tracking-wider">Out of Stock</span>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-rose-300 mt-2 font-mono">
            {outOfStockCount}
          </div>
          <div className="text-xs text-slate-400 mt-1">Zero balance items</div>
        </div>
      </div>

      {/* Quick Operational Shortcuts */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Quick Ledger Operations
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => onOpenMovementModal('SALE_OUT')}
            className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-950/40 border border-rose-900/40 hover:bg-rose-900/30 text-rose-300 transition text-sm font-medium"
          >
            <ArrowUpRight className="w-4 h-4 text-rose-400" />
            <span>Record Sale</span>
          </button>
          <button
            onClick={() => onOpenMovementModal('RETURN_IN')}
            className="flex items-center gap-2.5 p-3 rounded-lg bg-teal-950/40 border border-teal-900/40 hover:bg-teal-900/30 text-teal-300 transition text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4 text-teal-400" />
            <span>Customer Return</span>
          </button>
          {isOwner && (
            <>
              <button
                onClick={() => onOpenMovementModal('PURCHASE_IN')}
                className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-950/40 border border-emerald-900/40 hover:bg-emerald-900/30 text-emerald-300 transition text-sm font-medium"
              >
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                <span>Receive Purchase</span>
              </button>
              <button
                onClick={() => onOpenMovementModal('ADJUSTMENT_IN')}
                className="flex items-center gap-2.5 p-3 rounded-lg bg-cyan-950/40 border border-cyan-900/40 hover:bg-cyan-900/30 text-cyan-300 transition text-sm font-medium"
              >
                <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
                <span>Stock Adjustment</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Two Column Layout: Low Stock Alerts & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Low Stock Attention List */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-white text-sm">Critical Stock Attention</h3>
              </div>
              <button
                onClick={() => onNavigate('low-stock')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                View all ({lowStockItems.length}) →
              </button>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm flex flex-col items-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 opacity-80" />
                <span>All items are comfortably stocked above threshold!</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60 mt-2">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div key={item._id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-200 text-sm">{item.name}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        {item.sku} • Thresh: {item.lowStockThreshold} {item.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StockStatusBadge
                        currentStock={item.currentStock}
                        threshold={item.lowStockThreshold}
                        unit={item.unit}
                      />
                      {isOwner && (
                        <button
                          onClick={() => onOpenMovementModal('PURCHASE_IN', item._id)}
                          className="px-2 py-1 rounded text-xs bg-emerald-950 border border-emerald-800 text-emerald-300 hover:bg-emerald-900 transition"
                        >
                          Restock
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Movements Audit Trail */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <h3 className="font-semibold text-white text-sm">Latest Audit Ledger Entries</h3>
            </div>
            <button
              onClick={() => onNavigate('movements')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Full Ledger →
            </button>
          </div>

          {recentMovements.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No stock movements recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 mt-2">
              {recentMovements.map((mov) => (
                <div key={mov._id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200 text-sm truncate">
                        {mov.product?.name || 'Product'}
                      </span>
                      {mov.reference && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono shrink-0">
                          {mov.reference}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {mov.reason} • by {mov.actor?.name || 'User'}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <MovementTypeBadge
                      type={mov.type}
                      quantity={mov.quantity}
                      unit={mov.product?.unit}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
