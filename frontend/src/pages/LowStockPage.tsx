import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api, extractErrorMessage } from '../api/client.js';
import { LowStockProduct } from '../types/index.js';
import { StockStatusBadge } from '../components/Badge.js';
import {
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  PackageCheck,
  AlertOctagon
} from 'lucide-react';

interface LowStockPageProps {
  onOpenMovementModal: (type: any, productId: string) => void;
  onSelectProduct: (productId: string) => void;
}

export const LowStockPage: React.FC<LowStockPageProps> = ({
  onOpenMovementModal,
  onSelectProduct
}) => {
  const { isOwner } = useAuth();
  const [items, setItems] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLowStock = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/stock/low-stock');
      if (res.data.success) {
        setItems(res.data.data);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLowStock();
  }, []);

  const outOfStockItems = items.filter((i) => i.isZeroStock);
  const lowItems = items.filter((i) => !i.isZeroStock);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Low Stock Attention List</h1>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {items.length} critical items
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            Products where available derived stock is at or below configured minimum thresholds
          </p>
        </div>
        <button
          onClick={fetchLowStock}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-200 text-sm">
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm">Scanning stock levels...</div>
      ) : items.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-12 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 mb-3">
            <PackageCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">All Stock Levels Optimal</h3>
          <p className="text-sm text-slate-400 max-w-md mt-1">
            Zero products are currently under threshold or out of stock. The shop is well supplied.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Out of Stock Section (Zero Balance) */}
          {outOfStockItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-rose-400 text-sm font-semibold">
                <AlertOctagon className="w-4 h-4" />
                <span>Zero Balance — Immediate Restock Required ({outOfStockItems.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {outOfStockItems.map((item) => (
                  <div
                    key={item._id}
                    className="bg-rose-950/20 border border-rose-900/50 rounded-xl p-4 flex flex-col justify-between hover:border-rose-800 transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div
                            onClick={() => onSelectProduct(item._id)}
                            className="font-semibold text-slate-200 hover:text-rose-300 cursor-pointer transition text-base"
                          >
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            {item.sku} • {item.category}
                          </div>
                        </div>
                        <StockStatusBadge
                          currentStock={item.currentStock}
                          threshold={item.lowStockThreshold}
                          unit={item.unit}
                        />
                      </div>

                      <div className="mt-4 pt-3 border-t border-rose-900/30 flex items-center justify-between text-xs text-slate-400">
                        <span>Threshold Target:</span>
                        <span className="font-mono font-medium text-slate-200">
                          {item.lowStockThreshold} {item.unit}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-rose-900/30 flex items-center justify-end gap-2">
                      <button
                        onClick={() => onSelectProduct(item._id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs transition"
                      >
                        Ledger History
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => onOpenMovementModal('PURCHASE_IN', item._id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-sm"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Restock Now</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low Stock Section (Below Threshold) */}
          {lowItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                <AlertTriangle className="w-4 h-4" />
                <span>Low Inventory ({lowItems.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lowItems.map((item) => (
                  <div
                    key={item._id}
                    className="bg-slate-800/40 border border-slate-800 hover:border-amber-700/50 rounded-xl p-4 flex flex-col justify-between transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div
                            onClick={() => onSelectProduct(item._id)}
                            className="font-semibold text-slate-200 hover:text-amber-300 cursor-pointer transition text-base"
                          >
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            {item.sku} • {item.category}
                          </div>
                        </div>
                        <StockStatusBadge
                          currentStock={item.currentStock}
                          threshold={item.lowStockThreshold}
                          unit={item.unit}
                        />
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span>Available / Threshold:</span>
                        <span className="font-mono font-medium text-slate-200">
                          {item.currentStock} / {item.lowStockThreshold} {item.unit}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                      <button
                        onClick={() => onSelectProduct(item._id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs transition"
                      >
                        Ledger History
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => onOpenMovementModal('PURCHASE_IN', item._id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-sm"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Restock</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
