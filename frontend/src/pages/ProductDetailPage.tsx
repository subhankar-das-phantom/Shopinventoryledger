import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api, extractErrorMessage } from '../api/client.js';
import { Product, StockMovement } from '../types/index.js';
import { MovementTypeBadge, StockStatusBadge } from '../components/Badge.js';
import {
  ArrowLeft,
  RefreshCw,
  PlusCircle,
  ShieldCheck,
  User as UserIcon,
  Tag,
  Hash,
  AlertCircle
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

interface ProductDetailPageProps {
  productId?: string;
  onBack?: () => void;
  onOpenMovementModal: (type?: any, productId?: string) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  productId: propProductId,
  onBack: propOnBack,
  onOpenMovementModal
}) => {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const productId = propProductId || paramId || '';
  const onBack = propOnBack || (() => navigate('/products'));
  const { isOwner } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination for movements
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMovements, setTotalMovements] = useState(0);

  // Parity check state
  const [parityChecking, setParityChecking] = useState(false);
  const [parityResult, setParityResult] = useState<any | null>(null);

  const fetchProductAndMovements = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, movRes] = await Promise.all([
        api.get(`/products/${productId}`),
        api.get(`/products/${productId}/movements?page=${page}&limit=15`)
      ]);

      if (prodRes.data.success) {
        setProduct(prodRes.data.data);
      }
      if (movRes.data.success) {
        setMovements(movRes.data.data);
        setTotalPages(movRes.data.pagination.totalPages || 1);
        setTotalMovements(movRes.data.pagination.total || 0);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductAndMovements();
  }, [productId, page]);

  const handleVerifyParity = async () => {
    setParityChecking(true);
    setParityResult(null);
    try {
      const res = await api.get(`/stock/verify-parity/${productId}`);
      if (res.data.success) {
        setParityResult(res.data.data);
      }
    } catch (err: any) {
      alert(`Parity check failed: ${extractErrorMessage(err)}`);
    } finally {
      setParityChecking(false);
    }
  };

  if (loading && !product) {
    return (
      <div className="py-20 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
        <span>Loading product details and ledger...</span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <div className="flex items-center gap-2 text-rose-400 font-semibold">
          <AlertCircle className="w-5 h-5" />
          <span>Error Loading Product</span>
        </div>
        <p className="text-sm text-slate-300">{error || 'Product could not be found.'}</p>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Products</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Product List</span>
        </button>

        <div className="flex items-center gap-2.5">
          {isOwner && (
            <button
              onClick={handleVerifyParity}
              disabled={parityChecking}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition"
              title="Verify ledger summation against balance projection"
            >
              <ShieldCheck className={`w-3.5 h-3.5 text-blue-400 ${parityChecking ? 'animate-spin' : ''}`} />
              <span>Verify Ledger Parity</span>
            </button>
          )}

          {product.isActive && (
            <button
              onClick={() => onOpenMovementModal(undefined, product._id)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium transition shadow-md shadow-blue-500/20"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Record Stock</span>
            </button>
          )}
        </div>
      </div>

      {/* Parity Verification Banner (If Triggered) */}
      {parityResult && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-start justify-between gap-3 ${
            parityResult.parity
              ? 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/70 border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">
                {parityResult.parity
                  ? 'Ledger Parity Verified: 100% Agreement'
                  : 'Parity Discrepancy Detected!'}
              </div>
              <div className="text-xs mt-1 text-slate-300">
                Authoritative History ({parityResult.movementCount} movements):{' '}
                <strong className="font-mono">{parityResult.derivedStock} {product.unit}</strong> | Derived Projection:{' '}
                <strong className="font-mono">{parityResult.projectedStock} {product.unit}</strong> (Difference: {parityResult.difference})
              </div>
            </div>
          </div>
          <button
            onClick={() => setParityResult(null)}
            className="text-xs underline text-slate-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Product Metadata Summary Card */}
      <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">{product.name}</h2>
              {!product.isActive && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800">
                  Deactivated
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1 font-mono">
              <span className="flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                SKU: {product.sku}
              </span>
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                Category: {product.category}
              </span>
              <span>Unit: {product.unit}</span>
              <span>Price: ₹{product.price.toFixed(2)}</span>
            </div>
          </div>

          {/* Current Stock Display */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center gap-4 shrink-0">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                Current Stock Balance
              </div>
              <div className="text-3xl font-bold text-white font-mono mt-0.5">
                {product.currentStock}{' '}
                <span className="text-sm font-normal text-slate-400">{product.unit}</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Threshold: {product.lowStockThreshold} {product.unit}
              </div>
            </div>
            <StockStatusBadge
              currentStock={product.currentStock}
              threshold={product.lowStockThreshold}
              unit={product.unit}
            />
          </div>
        </div>
      </div>

      {/* Product Movement History Section */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white text-base">Movement Audit Trail</h3>
            <p className="text-xs text-slate-400">
              Showing bounded ledger history ({totalMovements} total recorded movements)
            </p>
          </div>
          <button
            onClick={fetchProductAndMovements}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {movements.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No stock movements have been recorded for this product yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Date & Time</th>
                  <th className="py-3 px-4 font-semibold">Operation Type</th>
                  <th className="py-3 px-4 font-semibold">Quantity</th>
                  <th className="py-3 px-4 font-semibold">Reason / Memo</th>
                  <th className="py-3 px-4 font-semibold">Reference</th>
                  <th className="py-3 px-4 font-semibold">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {movements.map((mov) => (
                  <tr key={mov._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-xs text-slate-300 font-mono">
                      {new Date(mov.movementDate || mov.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>

                    <td className="py-3 px-4">
                      <MovementTypeBadge type={mov.type} />
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold">
                      <span
                        className={
                          mov.direction === 'IN' ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
                        {mov.direction === 'IN' ? '+' : '-'}
                        {mov.quantity} {product.unit}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-300 text-xs max-w-xs truncate">
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

                    <td className="py-3 px-4 text-xs text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span>{mov.actor?.name || 'System User'}</span>
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
    </div>
  );
};
