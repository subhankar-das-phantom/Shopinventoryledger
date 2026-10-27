import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api, extractErrorMessage, createIdempotencyKey } from '../api/client.js';
import { Product, MovementType } from '../types/index.js';
import { X, AlertCircle, CheckCircle, ArrowDownLeft, ArrowUpRight, RotateCcw, SlidersHorizontal, Loader2 } from 'lucide-react';

interface RecordMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialProductId?: string;
  initialType?: MovementType;
}

export const RecordMovementModal: React.FC<RecordMovementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialProductId,
  initialType = 'SALE_OUT'
}) => {
  const { isOwner } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState(initialProductId || '');
  const [movementType, setMovementType] = useState<MovementType>(initialType);
  const [quantity, setQuantity] = useState<string>('1');
  const [reason, setReason] = useState<string>('');
  const [reference, setReference] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load products when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      if (initialProductId) setSelectedProductId(initialProductId);
      if (initialType) setMovementType(initialType);
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialProductId, initialType]);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await api.get('/products?status=active&limit=100');
      if (res.data.success) {
        setProducts(res.data.data);
        if (!selectedProductId && res.data.data.length > 0) {
          setSelectedProductId(res.data.data[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to load products for modal:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const selectedProduct = products.find((p) => p._id === selectedProductId);

  // Available movement types based on user role
  const availableTypes: { type: MovementType; label: string; icon: any; color: string }[] = [
    { type: 'SALE_OUT', label: 'Sale (OUT)', icon: ArrowUpRight, color: 'text-rose-400' },
    { type: 'RETURN_IN', label: 'Return (IN)', icon: RotateCcw, color: 'text-teal-400' },
    ...(isOwner
      ? [
          {
            type: 'PURCHASE_IN' as MovementType,
            label: 'Purchase (IN)',
            icon: ArrowDownLeft,
            color: 'text-emerald-400'
          },
          {
            type: 'ADJUSTMENT_IN' as MovementType,
            label: 'Adjustment (+IN)',
            icon: SlidersHorizontal,
            color: 'text-cyan-400'
          },
          {
            type: 'ADJUSTMENT_OUT' as MovementType,
            label: 'Adjustment (-OUT)',
            icon: SlidersHorizontal,
            color: 'text-amber-400'
          }
        ]
      : [])
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setError('Quantity must be a positive number greater than 0.');
      return;
    }

    if (!selectedProductId) {
      setError('Please select a product.');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for this stock movement.');
      return;
    }

    setSubmitting(true);

    try {
      const idempotencyKey = createIdempotencyKey('mov');
      let endpoint = '';
      let payload: any = {
        productId: selectedProductId,
        quantity: numQty,
        reason: reason.trim(),
        reference: reference.trim()
      };

      if (movementType === 'SALE_OUT') {
        endpoint = '/stock-movements/sale';
      } else if (movementType === 'RETURN_IN') {
        endpoint = '/stock-movements/return';
      } else if (movementType === 'PURCHASE_IN') {
        endpoint = '/stock-movements/purchase';
      } else if (movementType === 'ADJUSTMENT_IN' || movementType === 'ADJUSTMENT_OUT') {
        endpoint = '/stock-movements/adjustment';
        payload.type = movementType;
      }

      const res = await api.post(endpoint, payload, {
        headers: {
          'Idempotency-Key': idempotencyKey
        }
      });

      if (res.data.success) {
        setSuccessMessage(`Movement recorded! New stock: ${res.data.data.currentStock} ${selectedProduct?.unit || 'units'}`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-lg font-semibold text-white">Record Stock Movement</h2>
            <p className="text-xs text-slate-400">Ledger audit record with atomic concurrency protection</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            disabled={submitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg flex items-start gap-2.5 text-rose-200 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-lg flex items-start gap-2.5 text-emerald-200 text-sm">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Movement Type Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Operation Type <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableTypes.map((item) => {
                const Icon = item.icon;
                const isSelected = movementType === item.type;
                return (
                  <button
                    type="button"
                    key={item.type}
                    onClick={() => setMovementType(item.type)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition text-left ${
                      isSelected
                        ? 'bg-slate-800 border-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                        : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${item.color}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Product <span className="text-rose-400">*</span>
            </label>
            {loadingProducts ? (
              <div className="text-xs text-slate-400">Loading catalog...</div>
            ) : (
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    [{p.sku}] {p.name} — Current: {p.currentStock} {p.unit}
                  </option>
                ))}
              </select>
            )}

            {/* Product Stock Preview Pill */}
            {selectedProduct && (
              <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400 bg-slate-800/40 px-3 py-1.5 rounded-lg border border-slate-800">
                <span>Available Balance:</span>
                <span className="font-mono font-bold text-slate-200">
                  {selectedProduct.currentStock} {selectedProduct.unit}
                </span>
              </div>
            )}
          </div>

          {/* Quantity & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Quantity <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="0.001"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                placeholder="1"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Unit</label>
              <input
                type="text"
                disabled
                value={selectedProduct?.unit || 'units'}
                className="w-full bg-slate-800/50 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Reference Document */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Reference Document <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Invoice #1024, PO-2026-08, Receipt"
              maxLength={100}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Reason / Memo <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Counter retail sale, Supplier replenishment, Damaged goods"
              required
              maxLength={500}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition shadow-md shadow-indigo-600/30"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Committing Ledger...</span>
                </>
              ) : (
                <span>Confirm & Post</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
