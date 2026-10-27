import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api, extractErrorMessage, downloadFile } from '../api/client.js';
import { Product } from '../types/index.js';
import { StockStatusBadge } from '../components/Badge.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { ExportModal, ExportFormat } from '../components/ExportModal.js';
import {
  Search,
  Plus,
  Edit2,
  Power,
  History,
  ArrowUpDown,
  RefreshCw,
  Package,
  X,
  AlertTriangle,
  AlertOctagon,
  IndianRupee,
  Download,
  Barcode,
  Filter
} from 'lucide-react';
import { useDebounce } from '../hooks/index.js';

interface ProductsPageProps {
  onSelectProduct: (productId: string) => void;
  onOpenProductModal: (product?: Product) => void;
  onOpenMovementModal: (type?: any, productId?: string) => void;
  refreshTrigger?: number;
}

interface CatalogStats {
  totalProducts: number;
  totalValuation: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({
  onSelectProduct,
  onOpenProductModal,
  onOpenMovementModal,
  refreshTrigger
}) => {
  const { isOwner } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState<CatalogStats>({
    totalProducts: 0,
    totalValuation: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Debounced Search
  const [search, setSearch] = useState('');
  const [debouncedSearch, flushSearch] = useDebounce(search, 300);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out' | 'deactivated'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Deactivation confirmation dialog state
  const [deactivatingProduct, setDeactivatingProduct] = useState<Product | null>(null);
  const [deactivatingLoading, setDeactivatingLoading] = useState(false);

  // Multi-format export modal state
  const [showExportModal, setShowExportModal] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = stockFilter === 'deactivated' ? 'inactive' : 'active';
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        status: statusParam,
        category: selectedCategory
      });
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());

      const res = await api.get(`/products?${params.toString()}`);
      if (res.data.success) {
        setProducts(res.data.data);
        setCategories(res.data.categories || []);
        setTotalPages(res.data.pagination.totalPages || 1);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, stockFilter, selectedCategory, debouncedSearch]);

  // Reactive auto-fetch when filters, debounced search, or refresh trigger change
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts, refreshTrigger]);

  // Cross-component event listener for instant zero-stale updates
  useEffect(() => {
    const handleCatalogUpdate = () => {
      fetchProducts();
    };
    window.addEventListener('catalog-updated', handleCatalogUpdate);
    return () => window.removeEventListener('catalog-updated', handleCatalogUpdate);
  }, [fetchProducts]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, stockFilter, selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    flushSearch();
  };

  const handleExportSubmit = async ({ format }: { format: ExportFormat }) => {
    try {
      const params: Record<string, any> = { format };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (stockFilter !== 'all') {
        const filterMap: Record<string, string> = {
          low: 'low_stock',
          out: 'out_of_stock',
          in: 'in_stock',
          deactivated: 'deactivated'
        };
        params.stockFilter = filterMap[stockFilter] || stockFilter;
      }

      await downloadFile(
        '/products/export',
        params,
        `products_export_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`
      );
    } catch (err: any) {
      alert(`Export failed: ${extractErrorMessage(err)}`);
      throw err;
    }
  };

  const handleConfirmDeactivation = async () => {
    if (!deactivatingProduct) return;
    setDeactivatingLoading(true);
    try {
      await api.post(`/products/${deactivatingProduct._id}/deactivate`);
      setDeactivatingProduct(null);
      // Trigger global and local refresh
      window.dispatchEvent(new CustomEvent('catalog-updated'));
      fetchProducts();
    } catch (err: any) {
      alert(`Operation failed: ${extractErrorMessage(err)}`);
    } finally {
      setDeactivatingLoading(false);
    }
  };

  // Client-side stock filtering when 'low', 'out', or 'in' is selected
  const displayedProducts = products.filter((p) => {
    if (stockFilter === 'out') return p.currentStock === 0;
    if (stockFilter === 'low') return p.currentStock > 0 && p.currentStock <= p.lowStockThreshold;
    if (stockFilter === 'in') return p.currentStock > p.lowStockThreshold;
    return true;
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Summary KPI Metric Cards (Bharat Enterprise Standard) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Products */}
        <div
          onClick={() => {
            setStockFilter('all');
            setSelectedCategory('all');
          }}
          className={`app-card p-4 flex flex-col justify-between cursor-pointer transition hover:border-slate-700 ${
            stockFilter === 'all' ? 'border-blue-500/50 bg-slate-900/90' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-slate-400">Total Products</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-100 font-mono tracking-tight">
              {stats.totalProducts}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Active catalog SKUs</p>
          </div>
        </div>

        {/* Low Stock Items */}
        <div
          onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
          className={`app-card p-4 flex flex-col justify-between cursor-pointer transition hover:border-slate-700 ${
            stockFilter === 'low' ? 'border-amber-500/60 bg-amber-950/20' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-slate-400">Low Stock Alert</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-amber-400 font-mono tracking-tight">
              {stats.lowStockCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">At or below reorder threshold</p>
          </div>
        </div>

        {/* Out of Stock */}
        <div
          onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')}
          className={`app-card p-4 flex flex-col justify-between cursor-pointer transition hover:border-slate-700 ${
            stockFilter === 'out' ? 'border-rose-500/60 bg-rose-950/20' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-slate-400">Out of Stock</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-rose-400 font-mono tracking-tight">
              {stats.outOfStockCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Zero physical units available</p>
          </div>
        </div>

        {/* Active Inventory Valuation */}
        <div className="app-card p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-slate-400">Inventory Valuation</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-emerald-400 font-mono tracking-tight">
              ₹{stats.totalValuation.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Current asset valuation (excl. tax)</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-200 text-sm">
          {error}
        </div>
      )}

      {/* 2. Main Content Card: Header & Search & Filters */}
      <div className="app-card p-4 sm:p-5 space-y-4">
        {/* Header with Title & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">All Products</h2>
              <p className="text-xs text-slate-400">
                Showing {displayedProducts.length} of {stats.totalProducts} catalog items
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {isOwner && (
              <>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 px-3.5 py-2 rounded-lg text-xs font-semibold transition active:scale-95 shadow-sm"
                  title="Export Catalog (Excel, CSV, JSON, PDF)"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export</span>
                </button>

                <button
                  onClick={() => onOpenProductModal()}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
                </button>
              </>
            )}

            <button
              onClick={fetchProducts}
              title="Refresh catalog data"
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search & Stock Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Unified Real-time Search */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name, SKU, or category..."
              className="w-full bg-slate-800/80 border border-slate-700/80 pl-9 pr-9 py-2 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  flushSearch();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-100 rounded"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Stock Level Segmented Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-lg text-xs">
            {[
              { id: 'all' as const, label: 'All', count: stats.totalProducts },
              { id: 'in' as const, label: 'In Stock', count: Math.max(0, stats.totalProducts - stats.lowStockCount - stats.outOfStockCount) },
              { id: 'low' as const, label: 'Low Stock', count: stats.lowStockCount, badgeColor: 'text-amber-400' },
              { id: 'out' as const, label: 'Out of Stock', count: stats.outOfStockCount, badgeColor: 'text-rose-400' },
              { id: 'deactivated' as const, label: 'Deactivated' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStockFilter(tab.id)}
                className={`flex-1 py-1 px-2 rounded-md font-medium transition text-center truncate ${
                  stockFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-850'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`ml-1 font-mono text-[10px] ${tab.badgeColor || 'text-slate-300'}`}>
                    ({tab.count})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Category Filter Bar (100% Dynamic from active catalog) */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60 overflow-x-auto pb-1 text-xs">
            <span className="shrink-0 text-slate-500 font-medium flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>Categories:</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setPage(1);
              }}
              className={`shrink-0 px-2.5 py-1 rounded-md font-medium transition ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              All Categories
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setSelectedCategory(selectedCategory === c ? 'all' : c);
                  setPage(1);
                }}
                className={`shrink-0 px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1.5 ${
                  selectedCategory === c
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                }`}
              >
                <span>{c}</span>
                {selectedCategory === c && <X className="w-3 h-3 ml-0.5" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Product Catalog Table / Card Container */}
      <div className="app-card overflow-hidden shadow-sm">
        {loading && products.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span>Loading product catalog...</span>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
              <Package className="w-7 h-7" />
            </div>
            <div className="font-semibold text-slate-200 text-base">No products match your criteria</div>
            <div className="text-xs text-slate-500 mt-1 max-w-sm">
              Adjust your search term, select another category, or add a new product to the catalog.
            </div>
            <div className="flex items-center gap-3 mt-4">
              {(search || selectedCategory !== 'all' || stockFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearch('');
                    flushSearch();
                    setSelectedCategory('all');
                    setStockFilter('all');
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                >
                  Clear Filters
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => onOpenProductModal()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Product</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-850 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Product Name & SKU</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Physical Stock</th>
                  <th className="py-3 px-4 font-semibold">Threshold</th>
                  <th className="py-3 px-4 font-semibold">Unit Price</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayedProducts.map((p) => {
                  const isOut = p.currentStock === 0;
                  const isLow = p.currentStock > 0 && p.currentStock <= p.lowStockThreshold;

                  return (
                    <tr
                      key={p._id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        !p.isActive ? 'opacity-60 bg-slate-950/20' : ''
                      }`}
                    >
                      {/* Product Name & SKU */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div
                              onClick={() => onSelectProduct(p._id)}
                              className="font-medium text-slate-100 hover:text-blue-400 cursor-pointer transition truncate"
                            >
                              {p.name}
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                              <Barcode className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{p.sku}</span>
                              {!p.isActive && (
                                <span className="text-rose-400 font-sans font-semibold text-[11px] ml-1">
                                  [Deactivated]
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-slate-300 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory(p.category);
                            setPage(1);
                          }}
                          title={`Filter by category: ${p.category}`}
                          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition cursor-pointer"
                        >
                          {p.category}
                        </button>
                      </td>

                      {/* Available Stock & Health Indicator */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <StockStatusBadge
                            currentStock={p.currentStock}
                            threshold={p.lowStockThreshold}
                            unit={p.unit}
                          />
                          {/* Visual Stock Health Bar */}
                          <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                isOut
                                  ? 'bg-rose-500 w-0'
                                  : isLow
                                  ? 'bg-amber-400 w-1/3'
                                  : 'bg-emerald-400 w-full'
                              }`}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Threshold */}
                      <td className="py-3 px-4 text-slate-400 font-mono text-xs">
                        {p.lowStockThreshold} {p.unit}
                      </td>

                      {/* Unit Price */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-100">
                        ₹{p.price.toFixed(2)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Ledger Movements */}
                          <button
                            onClick={() => onSelectProduct(p._id)}
                            title="View Ledger Audit History"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Quick Record Movement */}
                          {p.isActive && (
                            <button
                              onClick={() => onOpenMovementModal('SALE_OUT', p._id)}
                              title="Record Stock Movement"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition"
                            >
                              <ArrowUpDown className="w-4 h-4" />
                            </button>
                          )}

                          {/* Owner Edit */}
                          {isOwner && (
                            <button
                              onClick={() => onOpenProductModal(p)}
                              title="Edit Product Details"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Owner Deactivate Toggle */}
                          {isOwner && (
                            <button
                              onClick={() => setDeactivatingProduct(p)}
                              title={p.isActive ? 'Deactivate Product' : 'Reactivate Product'}
                              className={`p-1.5 rounded-lg transition ${
                                p.isActive
                                  ? 'text-slate-500 hover:text-rose-400 hover:bg-rose-950/30'
                                  : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-950/30'
                              }`}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-900/40">
            <span>
              Page {page} of {totalPages} • Total {stats.totalProducts} products
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition font-medium"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reusable Multi-Format Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Products Catalog"
        subtitle="Export product stock levels, valuation, and thresholds to Excel, CSV, or JSON"
        entityName="Products"
        stats={{
          total: displayedProducts.length,
          label: `${selectedCategory === 'all' ? 'All Categories' : selectedCategory} (${stockFilter.toUpperCase()})`
        }}
        defaultFormat="excel"
        onExport={handleExportSubmit}
      />

      {/* Confirmation Dialog for Deactivation */}
      <ConfirmDialog
        isOpen={Boolean(deactivatingProduct)}
        title={deactivatingProduct?.isActive ? 'Deactivate Product' : 'Reactivate Product'}
        message={
          deactivatingProduct?.isActive
            ? `Are you sure you want to deactivate "${deactivatingProduct.name}" (${deactivatingProduct.sku})? Deactivated products cannot be sold, but all historical movements are permanently preserved.`
            : `Reactivate "${deactivatingProduct?.name}" for sales and inventory operations?`
        }
        confirmLabel={deactivatingProduct?.isActive ? 'Deactivate' : 'Reactivate'}
        confirmVariant={deactivatingProduct?.isActive ? 'danger' : 'primary'}
        isLoading={deactivatingLoading}
        onConfirm={handleConfirmDeactivation}
        onCancel={() => setDeactivatingProduct(null)}
      />
    </div>
  );
};
