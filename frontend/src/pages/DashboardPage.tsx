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
  Layers,
  AlertOctagon,
  ChevronRight
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
      link.setAttribute(
        'download',
        `shop_inventory_report_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert(`Export failed: ${extractErrorMessage(err)}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Inventory Ledger Overview
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Live Ledger
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Accounting-grade physical stock balances computed in real-time from immutable movement records
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchDashboardData}
            title="Refresh Ledger"
            disabled={loading}
            className="p-2 rounded-xl bg-[#141519] border border-white/[0.08] hover:bg-slate-800 text-slate-300 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {isOwner && (
            <>
              <button
                onClick={onOpenProductModal}
                className="flex items-center gap-2 bg-[#17181e] hover:bg-slate-800 text-slate-200 border border-white/[0.08] px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-sm active:scale-95"
              >
                <Package className="w-3.5 h-3.5 text-blue-400" />
                <span>Add Product</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="flex items-center gap-2 bg-[#17181e] hover:bg-slate-800 text-slate-200 border border-white/[0.08] px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-sm active:scale-95"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Active Catalog */}
        <div className="glass-card rounded-2xl p-5 relative overflow-hidden transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Active Catalog
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mt-3 font-mono tracking-tight">
            {totalActiveSkus}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Unique active products</span>
          </div>
        </div>

        {/* Metric 2: Physical Balance */}
        <div className="glass-card rounded-2xl p-5 relative overflow-hidden transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Physical Stock
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mt-3 font-mono tracking-tight">
            {totalStockUnits.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            <span>Sum of all verified balances</span>
          </div>
        </div>

        {/* Metric 3: Low Stock Alerts */}
        <div
          onClick={() => onNavigate('low-stock')}
          className="glass-card rounded-2xl p-5 relative overflow-hidden cursor-pointer hover:border-amber-500/30 transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
              Low Stock Alerts
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-amber-300 mt-3 font-mono tracking-tight">
            {lowStockCount}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>At or below min threshold</span>
          </div>
        </div>

        {/* Metric 4: Out of Stock */}
        <div
          onClick={() => onNavigate('low-stock')}
          className="glass-card rounded-2xl p-5 relative overflow-hidden cursor-pointer hover:border-rose-500/30 transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
              Out of Stock
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-rose-300 mt-3 font-mono tracking-tight">
            {outOfStockCount}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            <span>Zero balance items</span>
          </div>
        </div>
      </div>

      {/* Quick Operation Cards */}
      <div className="bg-[#121316] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Quick Ledger Transactions
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            Direct state-changing operations
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onOpenMovementModal('SALE_OUT')}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-500/[0.04] border border-rose-500/15 hover:bg-rose-500/10 hover:border-rose-500/30 text-rose-300 transition-all active:scale-[0.98] text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center shrink-0 text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Record Sale</div>
              <div className="text-[11px] text-slate-400">Customer checkout (OUT)</div>
            </div>
          </button>

          <button
            onClick={() => onOpenMovementModal('RETURN_IN')}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-teal-500/[0.04] border border-teal-500/15 hover:bg-teal-500/10 hover:border-teal-500/30 text-teal-300 transition-all active:scale-[0.98] text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center shrink-0 text-teal-400">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Customer Return</div>
              <div className="text-[11px] text-slate-400">Re-enter to stock (IN)</div>
            </div>
          </button>

          {isOwner && (
            <>
              <button
                onClick={() => onOpenMovementModal('PURCHASE_IN')}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-emerald-300 transition-all active:scale-[0.98] text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0 text-emerald-400">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Receive Purchase</div>
                  <div className="text-[11px] text-slate-400">Supplier delivery (IN)</div>
                </div>
              </button>

              <button
                onClick={() => onOpenMovementModal('ADJUSTMENT_IN')}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-cyan-500/[0.04] border border-cyan-500/15 hover:bg-cyan-500/10 hover:border-cyan-500/30 text-cyan-300 transition-all active:scale-[0.98] text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center shrink-0 text-cyan-400">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Stock Adjustment</div>
                  <div className="text-[11px] text-slate-400">Audit correction (+/-)</div>
                </div>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Two-Column Layout: Low Stock Watchlist & Recent Audit Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Low Stock Critical Attention */}
        <div className="bg-[#121316] border border-white/[0.06] rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Low Stock Attention</h3>
                  <p className="text-[11px] text-slate-400">Items needing urgent purchase</p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('low-stock')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
              >
                <span>View all ({lowStockItems.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="py-14 text-center text-slate-400 text-xs flex flex-col items-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2 opacity-80" />
                <span className="font-medium text-slate-300">All products are healthy!</span>
                <span className="text-[11px] text-slate-500 mt-0.5">
                  No products are currently under threshold.
                </span>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04] mt-2">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div key={item._id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-200 text-sm">{item.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {item.sku} • Threshold: {item.lowStockThreshold} {item.unit}
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
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
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

        {/* Right Column: Recent Movement Audit Trail */}
        <div className="bg-[#121316] border border-white/[0.06] rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Recent Audit Ledger</h3>
                  <p className="text-[11px] text-slate-400">Latest immutable movements</p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('movements')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
              >
                <span>Full Ledger</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentMovements.length === 0 ? (
              <div className="py-14 text-center text-slate-400 text-xs">
                No stock movements logged yet.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04] mt-2">
                {recentMovements.map((mov) => (
                  <div key={mov._id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200 text-sm truncate">
                          {mov.product?.name || 'Product'}
                        </span>
                        {mov.reference && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono shrink-0 border border-white/[0.05]">
                            {mov.reference}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
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
    </div>
  );
};
