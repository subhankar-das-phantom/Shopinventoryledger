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

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
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

      // Fetch distinct categories from catalog to populate smart suggestions
      api.get('/products?limit=1')
        .then((res) => {
          const fetched = res.data.categories || [];
          const defaults = [
            'Grains & Cereals',
            'Cooking Oils & Ghee',
            'Pulses & Lentils',
            'Spices & Masalas',
            'Dairy & Refrigerated',
            'Beverages & Tea',
            'Packaged Snacks',
            'Household Essentials'
          ];
          const combined = Array.from(new Set([...fetched, ...defaults]));
          setAvailableCategories(combined);
        })
        .catch(() => {
          setAvailableCategories([
            'Grains & Cereals',
            'Cooking Oils & Ghee',
            'Pulses & Lentils',
            'Spices & Masalas',
            'Dairy & Refrigerated',
            'Beverages & Tea'
          ]);
        });
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
                  : 'bg-slate-800 border-slate-700 text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30'
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
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
            />
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Category <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] text-slate-500">Pick or type custom</span>
              </div>
              <input
                type="text"
                list="category-suggestions"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                placeholder="e.g. Dairy, Spices, Grains"
                maxLength={80}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
              />
              <datalist id="category-suggestions">
                {availableCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>

              {/* Quick Category Chips */}
              <div className="flex flex-wrap gap-1 mt-1.5 max-h-16 overflow-y-auto">
                {availableCategories.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-colors border ${
                      category.toLowerCase() === c.toLowerCase()
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 font-semibold'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Unit of Measure <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] text-slate-500">Pick or type custom</span>
              </div>
              <input
                type="text"
                list="unit-suggestions"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                placeholder="e.g. kg, L, pcs, pack"
                maxLength={20}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
              />
              <datalist id="unit-suggestions">
                {['kg', 'g', 'L', 'mL', 'pcs', 'pack', 'box', 'bottle'].map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>

              {/* Quick Unit Chips */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {['kg', 'L', 'pcs', 'pack', 'g', 'box'].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-colors border ${
                      unit.toLowerCase() === u.toLowerCase()
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 font-mono"
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 font-mono"
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
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition shadow-md shadow-blue-500/20"
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
