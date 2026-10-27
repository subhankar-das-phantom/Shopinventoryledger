import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api, extractErrorMessage } from '../api/client.js';
import { Product } from '../types/index.js';
import { StockStatusBadge } from '../components/Badge.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import {
  Search,
  Plus,
  Edit2,
  Power,
  History,
  ArrowUpDown,
  RefreshCw,
  Package
} from 'lucide-react';

interface ProductsPageProps {
  onSelectProduct: (productId: string) => void;
  onOpenProductModal: (product?: Product) => void;
  onOpenMovementModal: (type?: any, productId?: string) => void;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({
  onSelectProduct,
  onOpenProductModal,
  onOpenMovementModal
}) => {
  const { isOwner } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Deactivation confirmation dialog state
  const [deactivatingProduct, setDeactivatingProduct] = useState<Product | null>(null);
  const [deactivatingLoading, setDeactivatingLoading] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        status: selectedStatus,
        category: selectedCategory
      });
      if (search.trim()) params.append('search', search.trim());

      const res = await api.get(`/products?${params.toString()}`);
      if (res.data.success) {
        setProducts(res.data.data);
        setCategories(res.data.categories || []);
        setTotalPages(res.data.pagination.totalPages || 1);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, selectedStatus, selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const handleConfirmDeactivation = async () => {
    if (!deactivatingProduct) return;
    setDeactivatingLoading(true);
    try {
      await api.post(`/products/${deactivatingProduct._id}/deactivate`);
      setDeactivatingProduct(null);
      fetchProducts();
    } catch (err: any) {
      alert(`Operation failed: ${extractErrorMessage(err)}`);
    } finally {
      setDeactivatingLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Product Catalog</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage product metadata, stock thresholds, and track inventory movements
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => onOpenProductModal()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-200 text-sm">
          {error}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name or SKU..."
            className="w-full bg-slate-800 border border-slate-700 pl-9 pr-3 py-2 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          >
            <option value="active">Active Products</option>
            <option value="inactive">Deactivated</option>
            <option value="all">All Statuses</option>
          </select>

          <button
            onClick={fetchProducts}
            title="Refresh"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Product List Table / Cards */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {loading && products.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading catalog...</div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center">
            <Package className="w-10 h-10 text-slate-600 mb-3" />
            <div className="font-medium text-slate-300 text-base">No products found</div>
            <div className="text-xs text-slate-500 mt-1 max-w-sm">
              No products match your current search and filters. Try adjusting your filter terms or add a new product.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-semibold">Product</th>
                  <th className="py-3.5 px-4 font-semibold">Category</th>
                  <th className="py-3.5 px-4 font-semibold">Available Stock</th>
                  <th className="py-3.5 px-4 font-semibold">Threshold</th>
                  <th className="py-3.5 px-4 font-semibold">Price</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products.map((p) => (
                  <tr
                    key={p._id}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      !p.isActive ? 'opacity-60 bg-slate-950/20' : ''
                    }`}
                  >
                    {/* Name & SKU */}
                    <td className="py-3 px-4">
                      <div
                        onClick={() => onSelectProduct(p._id)}
                        className="font-medium text-slate-200 hover:text-blue-400 cursor-pointer transition"
                      >
                        {p.name}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {p.sku} {!p.isActive && <span className="text-rose-400 font-sans font-semibold ml-1">[Deactivated]</span>}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 text-slate-300 text-xs">
                      <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700/50">
                        {p.category}
                      </span>
                    </td>

                    {/* Current Stock Badge */}
                    <td className="py-3 px-4">
                      <StockStatusBadge
                        currentStock={p.currentStock}
                        threshold={p.lowStockThreshold}
                        unit={p.unit}
                      />
                    </td>

                    {/* Low Stock Threshold */}
                    <td className="py-3 px-4 text-slate-400 font-mono text-xs">
                      {p.lowStockThreshold} {p.unit}
                    </td>

                    {/* Unit Price */}
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">
                      ₹{p.price.toFixed(2)}
                    </td>

                    {/* Row Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Details / Movements */}
                        <button
                          onClick={() => onSelectProduct(p._id)}
                          title="View Ledger History"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition"
                        >
                          <History className="w-4 h-4" />
                        </button>

                        {/* Quick Record Movement */}
                        {p.isActive && (
                          <button
                            onClick={() => onOpenMovementModal('SALE_OUT', p._id)}
                            title="Record Movement"
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
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
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
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-900/40">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

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
