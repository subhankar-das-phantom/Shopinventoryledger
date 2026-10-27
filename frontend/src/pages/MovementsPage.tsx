import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api, extractErrorMessage, downloadFile } from '../api/client.js';
import { StockMovement, Product } from '../types/index.js';
import { MovementTypeBadge } from '../components/Badge.js';
import { useDebounce } from '../hooks/index.js';
import { ExportModal, ExportFormat } from '../components/ExportModal.js';
import {
  RefreshCw,
  User as UserIcon,
  Search,
  X,
  Loader2,
  Download
} from 'lucide-react';

export const MovementsPage: React.FC = () => {
  const { isOwner } = useAuth();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMovements, setTotalMovements] = useState(0);

  // Debounced Product Filter
  const [productSearchText, setProductSearchText] = useState<string>('');
  const [debouncedProductSearch] = useDebounce(productSearchText, 300);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedProductName, setSelectedProductName] = useState<string>('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [isSearchingProduct, setIsSearchingProduct] = useState<boolean>(false);
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);
  const productSearchContainerRef = useRef<HTMLDivElement>(null);

  // Close product search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        productSearchContainerRef.current &&
        !productSearchContainerRef.current.contains(e.target as Node)
      ) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch product search results for filter dropdown
  useEffect(() => {
    const query = debouncedProductSearch.trim();
    if (!query) {
      setProductResults([]);
      setIsSearchingProduct(false);
      return;
    }

    setIsSearchingProduct(true);
    api.get(`/products?status=active&search=${encodeURIComponent(query)}&limit=6`)
      .then((res) => {
        if (res.data.success) {
          setProductResults(res.data.data || []);
        }
      })
      .catch((err) => {
        console.error('Failed to search products in movements:', err);
        setProductResults([]);
      })
      .finally(() => {
        setIsSearchingProduct(false);
      });
  }, [debouncedProductSearch]);

  const fetchMovements = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20'
      });
      if (selectedType !== 'all') params.append('type', selectedType);
      if (selectedProductId) params.append('productId', selectedProductId);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const res = await api.get(`/stock-movements?${params.toString()}`);
      if (res.data.success) {
        setMovements(res.data.data);
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalMovements(res.data.pagination.total || 0);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [page, selectedType, selectedProductId, dateFrom, dateTo]);

  const handleResetFilters = () => {
    setSelectedType('all');
    setSelectedProductId('');
    setSelectedProductName('');
    setProductSearchText('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  const handleExportSubmit = async ({ format, dateRange }: { format: ExportFormat; dateRange?: any }) => {
    try {
      const params: Record<string, any> = { format };
      if (selectedType !== 'all') params.type = selectedType;
      if (selectedProductId) params.productId = selectedProductId;
      if (dateRange?.startDate) params.startDate = dateRange.startDate;
      else if (dateFrom) params.startDate = dateFrom;
      if (dateRange?.endDate) params.endDate = dateRange.endDate;
      else if (dateTo) params.endDate = dateTo;

      await downloadFile(
        '/stock-movements/export',
        params,
        `stock_movements_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`
      );
    } catch (err: any) {
      alert(`Export failed: ${extractErrorMessage(err)}`);
      throw err;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Stock Movement Audit Ledger</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Immutable, bounded chronological audit trail of all inventory transactions
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOwner && (
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 px-3.5 py-2 rounded-lg text-xs font-semibold transition active:scale-95 shadow-sm"
              title="Export Ledger History (Excel, CSV, JSON, PDF)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export</span>
            </button>
          )}
          <button
            onClick={fetchMovements}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-200 text-sm">
          {error}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center gap-3">
        {/* Debounced Product Search Filter */}
        <div ref={productSearchContainerRef} className="relative w-full sm:w-64">
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filter by Product:</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={selectedProductName || productSearchText}
              onChange={(e) => {
                setSelectedProductName('');
                setSelectedProductId('');
                setProductSearchText(e.target.value);
                setShowProductDropdown(true);
                setPage(1);
              }}
              onFocus={() => setShowProductDropdown(true)}
              placeholder="Search product / SKU..."
              className="w-full bg-slate-800 border border-slate-700 pl-8 pr-8 py-1.5 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
            />
            {(productSearchText || selectedProductId) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedProductId('');
                  setSelectedProductName('');
                  setProductSearchText('');
                  setShowProductDropdown(false);
                  setPage(1);
                }}
                className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Dropdown list */}
            {showProductDropdown && (productSearchText.trim().length > 0 || isSearchingProduct) && (
              <div className="absolute left-0 right-0 z-50 mt-1 bg-slate-900 border border-slate-700/80 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-800 text-xs">
                {isSearchingProduct ? (
                  <div className="p-3 text-slate-400 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                    <span>Searching catalog...</span>
                  </div>
                ) : productResults.length === 0 ? (
                  <div className="p-3 text-slate-500 text-center">
                    No products found
                  </div>
                ) : (
                  productResults.map((p) => (
                    <div
                      key={p._id}
                      onClick={() => {
                        setSelectedProductId(p._id);
                        setSelectedProductName(p.name);
                        setProductSearchText('');
                        setShowProductDropdown(false);
                        setPage(1);
                      }}
                      className="p-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between"
                    >
                      <div className="truncate mr-2">
                        <span className="font-semibold text-slate-200">{p.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono ml-1.5">[{p.sku}]</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {p.currentStock} {p.unit}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Movement Type Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Type:</label>
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          >
            <option value="all">All Movements</option>
            <option value="PURCHASE_IN">Purchases (IN)</option>
            <option value="SALE_OUT">Sales (OUT)</option>
            <option value="RETURN_IN">Returns (IN)</option>
            <option value="ADJUSTMENT_IN">Adjustments (+IN)</option>
            <option value="ADJUSTMENT_OUT">Adjustments (-OUT)</option>
          </select>
        </div>

        {/* Date Filters */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">From:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">To:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          />
        </div>

        {(selectedType !== 'all' || selectedProductId || dateFrom || dateTo) && (
          <button
            onClick={handleResetFilters}
            className="text-xs text-rose-400 hover:text-rose-500 font-medium underline sm:self-end sm:mb-1.5 ml-auto"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Movements Table */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {loading && movements.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading audit ledger...</div>
        ) : movements.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No movements found matching the active filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-850 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold">Movement Type</th>
                  <th className="py-3 px-4 font-semibold">Quantity</th>
                  <th className="py-3 px-4 font-semibold">Reason</th>
                  <th className="py-3 px-4 font-semibold">Reference</th>
                  <th className="py-3 px-4 font-semibold">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {movements.map((m) => {
                  const prod = m.product;
                  const actor = m.actor;
                  const dateStr = new Date(m.movementDate).toLocaleString('en-IN', {
                    dateStyle: 'short',
                    timeStyle: 'medium'
                  });

                  return (
                    <tr key={m._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-xs font-mono text-slate-400 whitespace-nowrap">
                        {dateStr}
                      </td>

                      <td className="py-3 px-4">
                        {prod ? (
                          <div>
                            <span className="font-medium text-slate-200">{prod.name}</span>
                            <span className="text-xs text-slate-500 font-mono ml-1.5">[{prod.sku}]</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 font-mono">
                            {String(m.productId)}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <MovementTypeBadge type={m.type} direction={m.direction} />
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                        <span className={m.direction === 'IN' ? 'text-emerald-400' : 'text-rose-400'}>
                          {m.direction === 'IN' ? '+' : '-'}{m.quantity} {prod?.unit || ''}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-300 text-xs max-w-xs truncate" title={m.reason}>
                        {m.reason}
                      </td>

                      <td className="py-3 px-4 text-slate-400 text-xs font-mono">
                        {m.reference ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/50">
                            {m.reference}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-400 text-xs">
                        <div className="flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                          <span>{actor?.name || 'System'}</span>
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-900/40 text-xs text-slate-400">
            <div>
              Showing page <span className="font-semibold text-slate-200">{page}</span> of{' '}
              <span className="font-semibold text-slate-200">{totalPages}</span> ({totalMovements} records)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reusable Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Stock Movements Ledger"
        subtitle="Export immutable transaction history to Excel, CSV, or JSON"
        entityName="Stock Movements"
        stats={{
          total: totalMovements,
          label: selectedProductId ? `Product: ${selectedProductName}` : 'All Products'
        }}
        showDateRange={true}
        defaultFormat="excel"
        onExport={handleExportSubmit}
      />
    </div>
  );
};

