import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api, extractErrorMessage, createIdempotencyKey } from '../api/client.js';
import { Product, MovementType } from '../types/index.js';
import { useDebounce } from '../hooks/index.js';
import {
  X,
  AlertCircle,
  CheckCircle,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  SlidersHorizontal,
  Loader2,
  Search,
  Check,
  Package
} from 'lucide-react';

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

  // Selected product & movement form states
  const [selectedProductId, setSelectedProductId] = useState(initialProductId || '');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [movementType, setMovementType] = useState<MovementType>(initialType);
  const [quantity, setQuantity] = useState<string>('1');
  const [reason, setReason] = useState<string>('');
  const [reference, setReference] = useState<string>('');

  // Search-based product selection combobox states
  const [productSearchText, setProductSearchText] = useState<string>('');
  const [debouncedProductSearch] = useDebounce(productSearchText, 300);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const latestSearchRequestId = useRef<number>(0);
  const isSubmittingRef = useRef<boolean>(false);
  const idempotencyKeyRef = useRef<string>(createIdempotencyKey('mov'));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Modal open initialization
  useEffect(() => {
    if (isOpen) {
      isSubmittingRef.current = false;
      idempotencyKeyRef.current = createIdempotencyKey('mov');
      setSubmitting(false);
      setError(null);
      setSuccessMessage(null);
      setProductSearchText('');
      setQuantity('1');
      setReason('');
      setReference('');
      if (initialType) setMovementType(initialType);

      if (initialProductId) {
        setSelectedProductId(initialProductId);
        // Load details of the pre-selected product
        api.get(`/products/${initialProductId}`)
          .then((res) => {
            if (res.data.success) {
              setSelectedProduct(res.data.data);
              setIsDropdownOpen(false);
            }
          })
          .catch((err) => {
            console.error('Failed to load initial product:', err);
          });
      } else {
        setSelectedProductId('');
        setSelectedProduct(null);
        setIsDropdownOpen(true);
      }
    }
  }, [isOpen, initialProductId, initialType]);

  // Debounced product search query
  useEffect(() => {
    if (!isOpen) return;

    const query = debouncedProductSearch.trim();
    const requestId = ++latestSearchRequestId.current;
    setIsSearching(true);

    const params = new URLSearchParams({
      status: 'active',
      limit: '8'
    });
    if (query) {
      params.append('search', query);
    }

    api.get(`/products?${params.toString()}`)
      .then((res) => {
        if (latestSearchRequestId.current !== requestId) return;
        if (res.data.success) {
          setSearchResults(res.data.data || []);
        }
      })
      .catch((err) => {
        if (latestSearchRequestId.current !== requestId) return;
        console.error('Product search error:', err);
        setSearchResults([]);
      })
      .finally(() => {
        if (latestSearchRequestId.current === requestId) {
          setIsSearching(false);
        }
      });
  }, [debouncedProductSearch, isOpen]);

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
    // Guard against multiple synchronous or asynchronous invocations
    if (isSubmittingRef.current || submitting || successMessage) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    if (!selectedProductId || !selectedProduct) {
      setError('Please search and select a product.');
      return;
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setError('Quantity must be a positive number greater than 0.');
      return;
    }

    // Guard against overt overselling attempts on outward transactions
    if ((movementType === 'SALE_OUT' || movementType === 'ADJUSTMENT_OUT') && selectedProduct) {
      if (numQty > selectedProduct.currentStock) {
        setError(
          `Insufficient stock: ${numQty} ${selectedProduct.unit} requested, but only ${selectedProduct.currentStock} ${selectedProduct.unit} available in physical stock.`
        );
        return;
      }
    }

    if (!reason.trim()) {
      setError('Please provide a reason for this stock movement.');
      return;
    }

    // Synchronously lock immediately before entering async execution
    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
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
          'Idempotency-Key': idempotencyKeyRef.current
        }
      });

      if (res.data.success) {
        setSuccessMessage(`Movement recorded! New stock: ${res.data.data.currentStock} ${selectedProduct?.unit || 'units'}`);
        // Remain permanently locked while displaying success message
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 850);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err));
      // Refresh idempotency key for retry if user fixes the form inputs
      idempotencyKeyRef.current = createIdempotencyKey('mov');
      isSubmittingRef.current = false;
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
            className="text-slate-400 hover:text-white p-1 rounded-lg transition disabled:opacity-40 disabled:pointer-events-none"
            disabled={submitting || Boolean(successMessage)}
            title="Close"
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
                        ? 'bg-slate-800 border-blue-500 text-white shadow-sm shadow-blue-500/20'
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

          {/* Product Selection: Debounced Search Combobox */}
          <div ref={searchContainerRef} className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Product <span className="text-rose-400">*</span>
              </label>
              {selectedProduct && !isDropdownOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(true);
                    setProductSearchText('');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                >
                  <Search className="w-3 h-3" />
                  <span>Change Product</span>
                </button>
              )}
            </div>

            {/* Selected Product Card (When chosen and dropdown is closed) */}
            {selectedProduct && !isDropdownOpen ? (
              <div
                onClick={() => setIsDropdownOpen(true)}
                className="p-3 rounded-xl bg-slate-800/80 border border-blue-500/40 hover:border-blue-500/60 transition cursor-pointer flex items-center justify-between group shadow-sm shadow-blue-500/10"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-100 text-sm truncate group-hover:text-blue-300 transition-colors">
                      {selectedProduct.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <span className="font-mono bg-slate-900/60 px-1.5 py-0.2 rounded border border-slate-700/60 text-slate-300">
                        {selectedProduct.sku}
                      </span>
                      <span>•</span>
                      <span>{selectedProduct.category}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Stock Balance</div>
                    <div className={`font-mono font-bold text-sm ${
                      selectedProduct.currentStock <= selectedProduct.lowStockThreshold
                        ? selectedProduct.currentStock === 0
                          ? 'text-rose-400'
                          : 'text-amber-400'
                        : 'text-emerald-400'
                    }`}>
                      {selectedProduct.currentStock} {selectedProduct.unit}
                    </div>
                  </div>
                  <div className="p-1 rounded text-slate-500 group-hover:text-slate-300 transition">
                    <Check className="w-4 h-4 text-blue-400" />
                  </div>
                </div>
              </div>
            ) : (
              /* Search Input with Autocomplete Dropdown */
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  autoFocus={!selectedProduct}
                  value={productSearchText}
                  onChange={(e) => {
                    setProductSearchText(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Type product name or SKU to search..."
                  className="w-full bg-slate-800 border border-slate-700 pl-9 pr-9 py-2 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                />

                {productSearchText && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearchText('');
                    }}
                    className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-white rounded"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Floating Autocomplete Dropdown */}
                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 z-50 mt-1.5 bg-[#121316] border border-slate-700/80 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-800/80">
                    {isSearching ? (
                      <div className="px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        <span>Searching catalog...</span>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-4 py-4 text-xs text-slate-400 text-center">
                        No active products found matching &ldquo;{productSearchText}&rdquo;
                      </div>
                    ) : (
                      searchResults.map((p) => {
                        const isChosen = selectedProductId === p._id;
                        return (
                          <div
                            key={p._id}
                            onClick={() => {
                              setSelectedProductId(p._id);
                              setSelectedProduct(p);
                              setIsDropdownOpen(false);
                              setProductSearchText('');
                            }}
                            className={`p-2.5 flex items-center justify-between cursor-pointer transition hover:bg-slate-800/80 ${
                              isChosen ? 'bg-blue-500/10' : ''
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-200 text-xs truncate">
                                  {p.name}
                                </span>
                                {isChosen && (
                                  <span className="text-[10px] px-1 rounded bg-blue-500/20 text-blue-300 font-semibold">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-mono">
                                <span className="text-slate-300">{p.sku}</span>
                                <span>•</span>
                                <span className="font-sans text-slate-500">{p.category}</span>
                              </div>
                            </div>

                            <div className="ml-3 shrink-0 text-right">
                              <span className={`inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded-md border ${
                                p.currentStock <= p.lowStockThreshold
                                  ? p.currentStock === 0
                                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              }`}>
                                {p.currentStock} {p.unit}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 font-mono"
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
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
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
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || Boolean(successMessage)}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || Boolean(successMessage) || !selectedProductId}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none text-white px-5 py-2 rounded-lg text-sm font-semibold transition shadow-sm select-none"
            >
              {successMessage ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-300" />
                  <span>Posted Successfully</span>
                </>
              ) : submitting ? (
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
