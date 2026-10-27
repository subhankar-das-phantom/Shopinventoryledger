import React, { useState, useEffect } from 'react';
import { api, extractErrorMessage } from '../api/client.js';
import { Product } from '../types/index.js';
import { X, AlertCircle, Loader2 } from 'lucide-react';

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

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [price, setPrice] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
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
    }
  }, [isOpen, productToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {isEditing ? 'Edit Product Metadata' : 'Add New Product'}
            </h2>
            <p className="text-xs text-slate-400">
              {isEditing
                ? 'Update catalog specifications'
                : 'Create catalog record (stock is initialized to 0)'}
            </p>
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

          {/* SKU */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Unique SKU <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              disabled={isEditing}
              required
              placeholder="e.g. MILK-1L, BREAD-WHT"
              maxLength={50}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none ${
                isEditing
                  ? 'bg-slate-800/50 border-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-800 border-slate-700 text-slate-200 focus:border-indigo-500'
              }`}
            />
            {isEditing && (
              <p className="text-[11px] text-slate-500 mt-1">SKU is immutable once created.</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Product Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Whole Wheat Bread 400g"
              maxLength={150}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Category <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                placeholder="e.g. Dairy, Bakery"
                maxLength={80}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Unit of Measure <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                placeholder="e.g. pcs, pack, kg"
                maxLength={20}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Price & Threshold */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Unit Price (₹ / $) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Low Stock Threshold <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Footer Actions */}
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
