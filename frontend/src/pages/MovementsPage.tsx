import React, { useState, useEffect } from 'react';
import { api, extractErrorMessage } from '../api/client.js';
import { StockMovement } from '../types/index.js';
import { MovementTypeBadge } from '../components/Badge.js';
import {
  History,
  RefreshCw,
  User as UserIcon
} from 'lucide-react';

export const MovementsPage: React.FC = () => {
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

  const fetchMovements = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20'
      });
      if (selectedType !== 'all') params.append('type', selectedType);
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
  }, [page, selectedType, dateFrom, dateTo]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Stock Movement Audit Ledger</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Immutable, bounded chronological audit trail of all inventory transactions
          </p>
        </div>
        <button
          onClick={fetchMovements}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0"
          title="Refresh Ledger"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-200 text-sm">
          {error}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center gap-3">
        {/* Movement Type Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Type:</label>
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
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
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">From:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">To:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {(selectedType !== 'all' || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSelectedType('all');
              setDateFrom('');
              setDateTo('');
              setPage(1);
            }}
            className="text-xs text-slate-400 hover:text-white underline ml-auto"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Ledger Table */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {loading && movements.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading ledger history...</div>
        ) : movements.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center">
            <History className="w-10 h-10 text-slate-600 mb-3" />
            <div className="font-medium text-slate-300 text-base">No movement records found</div>
            <div className="text-xs text-slate-500 mt-1">
              No transactions match your selected filter criteria.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Date & Time</th>
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold">Movement Type</th>
                  <th className="py-3 px-4 font-semibold">Magnitude</th>
                  <th className="py-3 px-4 font-semibold">Reason</th>
                  <th className="py-3 px-4 font-semibold">Reference</th>
                  <th className="py-3 px-4 font-semibold">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {movements.map((mov) => (
                  <tr key={mov._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-xs text-slate-300 font-mono whitespace-nowrap">
                      {new Date(mov.movementDate || mov.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-200">
                        {mov.product?.name || 'Unknown Product'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {mov.product?.sku}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <MovementTypeBadge type={mov.type} />
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap">
                      <span
                        className={
                          mov.direction === 'IN' ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
                        {mov.direction === 'IN' ? '+' : '-'}
                        {mov.quantity} {mov.product?.unit || 'units'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-xs text-slate-300 max-w-xs truncate">
                      {mov.reason}
                    </td>

                    <td className="py-3 px-4 text-xs font-mono text-slate-400">
                      {mov.reference ? (
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/50">
                          {mov.reference}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-xs text-slate-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span>{mov.actor?.name || 'System'}</span>
                        <span className="text-[10px] text-slate-500">({mov.actor?.role})</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bounded Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-900/40">
            <span>
              Showing Page {page} of {totalPages} ({totalMovements} total ledger records)
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
    </div>
  );
};
