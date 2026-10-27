import React, { useState, useEffect, useRef } from 'react';
import { api, extractErrorMessage } from '../api/client.js';
import { Product } from '../types/index.js';
import {
  X,
  AlertCircle,
  Loader2,
  Package,
  Barcode,
  Tag,
  Ruler,
  IndianRupee,
  AlertTriangle
} from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  productToEdit?: Product | null;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  productToEdit
}) => {
  const isEditing = Boolean(productToEdit);
  const isSubmittingRef = useRef<boolean>(false);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [price, setPrice] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      isSubmittingRef.current = false;
      setSubmitting(false);
      setError(null);
      if (productToEdit) {
        setSku(productToEdit.sku);
        setName(productToEdit.name);
        setCategory(productToEdit.category);
        setUnit(productToEdit.unit);
        setPrice(String(productToEdit.price));
        setLowStockThreshold(String(productToEdit.lowStockThreshold));
      } else {
        setSku('');
        setName('');
        setCategory('');
        setUnit('pcs');
        setPrice('0');
        setLowStockThreshold('5');
      }

      // Fetch existing distinct categories to provide smart optional suggestions without restricting the user
      api.get('/products?limit=1')
        .then((res) => {
          const fetched = res.data.categories || [];
          setAvailableCategories(fetched);
        })
        .catch(() => {
          setAvailableCategories([]);
        });
    }
  }, [isOpen, productToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || submitting) return;

    setError(null);

    const numPrice = parseFloat(price);
    const numThreshold = parseFloat(lowStockThreshold);

    if (isNaN(numPrice) || numPrice < 0) {
      setError('Price must be a valid non-negative number.');
      return;
    }

    if (isNaN(numThreshold) || numThreshold < 0) {
      setError('Low stock threshold must be a non-negative number.');
      return;
    }

    if (!category.trim()) {
      setError('Category is required. You can enter any custom category.');
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      if (isEditing && productToEdit) {
        await api.patch(`/products/${productToEdit._id}`, {
          name: name.trim(),
          category: category.trim(),
          unit: unit.trim(),
          price: numPrice,
          lowStockThreshold: numThreshold
        });
      } else {
        await api.post('/products', {
          sku: sku.trim().toUpperCase(),
          name: name.trim(),
          category: category.trim(),
          unit: unit.trim(),
          price: numPrice,
          lowStockThreshold: numThreshold
        });
      }

      window.dispatchEvent(new CustomEvent('catalog-updated'));
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err));
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                {isEditing ? 'Edit Product Details' : 'Add New Product'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEditing
                  ? 'Update product catalog specifications and thresholds'
                  : 'Register a new product in the catalog. Initial stock is set to 0 until movements are recorded.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
            disabled={submitting}
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 sm:p-8 space-y-6">
            {error && (
              <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-lg flex items-start gap-3 text-rose-200 text-sm">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Section 1: Product Identification */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* SKU */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-1.5">
                  <Barcode className="w-4 h-4 text-slate-400" />
                  <span>Unique SKU</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  disabled={isEditing}
                  required
                  placeholder="e.g. MILK-1L, RICE-5KG"
                  maxLength={50}
                  className={`w-full border rounded-lg px-3.5 py-2.5 text-sm font-mono uppercase focus:outline-none transition ${
                    isEditing
                      ? 'bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30'
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  {isEditing ? 'SKU is an immutable ledger identifier.' : 'Stock Keeping Unit code for barcodes and inventory.'}
                </p>
              </div>

              {/* Product Name */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-1.5">
                  <Package className="w-4 h-4 text-slate-400" />
                  <span>Product Name</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Whole Wheat Bread 400g"
                  maxLength={150}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Descriptive display name shown across catalog and bills.
                </p>
              </div>
            </div>

            {/* Section 2: Category & Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Category (Freeform input with datalist auto-suggestions) */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-1.5">
                  <Tag className="w-4 h-4 text-slate-400" />
                  <span>Category</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  list="category-suggestions"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  placeholder="Type ANY category (e.g. Dairy, Spices, Snacks)"
                  maxLength={80}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                />
                <datalist id="category-suggestions">
                  {availableCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Freeform: Enter any category name or pick an existing one.
                </p>
              </div>

              {/* Unit of Measure */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-1.5">
                  <Ruler className="w-4 h-4 text-slate-400" />
                  <span>Unit of Measure</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  list="unit-suggestions"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  required
                  placeholder="e.g. pcs, kg, L, pack"
                  maxLength={20}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                />
                <datalist id="unit-suggestions">
                  {['pcs', 'kg', 'g', 'L', 'mL', 'pack', 'box', 'bottle', 'can', 'strip', 'meter'].map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Unit for counting stock quantities and calculating sales.
                </p>
              </div>
            </div>

            {/* Section 3: Pricing & Stock Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Price */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-1.5">
                  <IndianRupee className="w-4 h-4 text-slate-400" />
                  <span>Selling Price (₹)</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 font-mono transition"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Default unit selling price for customer billing.
                </p>
              </div>

              {/* Threshold */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Low Stock Alert Threshold</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  required
                  placeholder="5"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 font-mono transition"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Alerts trigger when available stock drops to or below this level.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 sm:px-8 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none border border-slate-700/60 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition shadow-sm select-none"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditing ? 'Save Changes' : 'Create Product'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
