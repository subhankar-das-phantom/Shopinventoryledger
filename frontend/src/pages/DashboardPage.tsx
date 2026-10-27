import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api, downloadFile, extractErrorMessage } from '../api/client.js';
import { StockMovement, LowStockProduct, AnalyticsData } from '../types/index.js';
import { MovementTypeBadge, StockStatusBadge } from '../components/Badge.js';
import { ExportModal, ExportFormat } from '../components/ExportModal.js';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Layers,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  SlidersHorizontal,
  FileSpreadsheet,
  RefreshCw,
  Plus,
  Clock,
  TrendingUp,
  PieChart as PieIcon,
  ChevronRight,
  IndianRupee,
  Activity,
  AlertOctagon,
  Flame,
  CheckCircle2
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  onOpenMovementModal: (type?: any, productId?: string) => void;
  onOpenProductModal: () => void;
}

// Clean custom tooltip for Area Chart (Taste-Skill / Bharat Enterprise spec)
const CustomVelocityTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const inflow = payload.find((p: any) => p.dataKey === 'inflow')?.value ?? 0;
    const outflow = payload.find((p: any) => p.dataKey === 'outflow')?.value ?? 0;
    const net = inflow - outflow;

    return (
      <div className="bg-slate-900 border border-slate-700/80 p-3 rounded-lg shadow-xl text-xs space-y-2 min-w-[170px]">
        <div className="font-semibold text-slate-200 border-b border-slate-800 pb-1 flex items-center justify-between">
          <span>Date: {label}</span>
          <span className={`font-mono font-bold ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {net >= 0 ? `+${net}` : net} net
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-cyan-400" />
              Inflow (Purchases/Returns):
            </span>
            <span className="font-mono font-bold text-slate-200">+{inflow}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-rose-400" />
              Outflow (Sales/Loss):
            </span>
            <span className="font-mono font-bold text-slate-200">-{outflow}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Clean custom tooltip for Donut Chart
const CustomDonutTooltip = ({ active, payload, isSalesMode }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700/80 p-3 rounded-lg shadow-xl text-xs space-y-1.5 min-w-[160px]">
        <div className="font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-1">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: data.color }} />
          <span>{data.name}</span>
        </div>
        <div className="flex items-center justify-between text-slate-400">
          <span>{isSalesMode ? 'Sales Revenue:' : 'Asset Value:'}</span>
          <span className="font-mono font-bold text-slate-100">
            ₹{data.totalValue?.toLocaleString('en-IN')}
          </span>
        </div>
        {isSalesMode && data.unitsSold !== undefined && (
          <div className="flex items-center justify-between text-slate-400">
            <span>Units Sold:</span>
            <span className="font-mono text-slate-200">{data.unitsSold}</span>
          </div>
        )}
        {!isSalesMode && data.stockUnits !== undefined && (
          <div className="flex items-center justify-between text-slate-400">
            <span>Physical Stock:</span>
            <span className="font-mono text-slate-200">{data.stockUnits} units</span>
          </div>
        )}
        <div className="flex items-center justify-between text-slate-400">
          <span>{isSalesMode ? 'Sales Share:' : 'Catalog Share:'}</span>
          <span className="font-mono text-blue-400 font-semibold">{data.percentage}%</span>
        </div>
      </div>
    );
  }
  return null;
};

// Curated enterprise palette for category donut chart
const CATEGORY_COLORS = [
  '#3b82f6', // Electric Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#64748b'  // Slate
];

export const DashboardPage: React.FC<DashboardProps> = ({
  onNavigate,
  onOpenMovementModal,
  onOpenProductModal
}) => {
  const { isOwner } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Time horizon: 14 or 30 days
  const [timeHorizon, setTimeHorizon] = useState<14 | 30>(14);

  // Datasets
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [lowStockItems, setLowStockItems] = useState<LowStockProduct[]>([]);
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, lowRes, movRes] = await Promise.all([
        api.get(`/stock/analytics?days=${timeHorizon}`),
        api.get('/stock/low-stock'),
        api.get('/stock-movements?limit=6')
      ]);

      if (analyticsRes.data.success) setAnalytics(analyticsRes.data.data);
      if (lowRes.data.success) setLowStockItems(lowRes.data.data);
      if (movRes.data.success) setRecentMovements(movRes.data.data);
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [timeHorizon]);

  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  const handleExportSubmit = async ({ format }: { format: ExportFormat }) => {
    try {
      await downloadFile(
        '/products/export',
        { format },
        `shop_inventory_ledger_${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : format}`
      );
    } catch (err: any) {
      alert(`Export failed: ${extractErrorMessage(err)}`);
      throw err;
    }
  };

  // Metric mode: Inventory Valuation vs Sales Revenue
  const [categoryMode, setCategoryMode] = useState<'valuation' | 'sales'>('valuation');

  // Prepare Donut Chart Data with assigned colors based on selected mode
  const donutData = useMemo(() => {
    const list = categoryMode === 'sales'
      ? analytics?.categorySales
      : analytics?.categoryDistribution;

    if (!list?.length) return [];
    return list.slice(0, 6).map((cat, idx) => ({
      ...cat,
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
    }));
  }, [analytics, categoryMode]);

  const summary = analytics?.summary;
  const velocity = analytics?.velocity || [];
  const topProducts = analytics?.topProducts || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Page Header (Taste-Skill App-Screen spec: Noun title, freshness stamp, no hero banners) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
              Inventory Ledger Overview
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Live Ledger
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Accounting-grade physical stock balances computed in real-time from immutable movement records
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Refresh Action */}
          <button
            onClick={fetchDashboardData}
            title="Refresh Ledger"
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {isOwner && (
            <>
              <button
                onClick={onOpenProductModal}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 px-3 py-1.5 rounded-lg text-xs font-medium transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                <span>Add Product</span>
              </button>

              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 px-3 py-1.5 rounded-lg text-xs font-medium transition active:scale-95"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export Ledger</span>
              </button>
            </>
          )}

          {/* Primary Quick Record Trigger */}
          <button
            onClick={() => onOpenMovementModal('SALE_OUT')}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3.5 py-1.5 rounded-lg text-xs transition shadow-sm active:scale-95"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Record Movement</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-200 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Executive KPI Grid (Bharat Enterprise Standard: Solid Slate-900, 1px Hairlines, Tabular Figures) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Inventory Valuation */}
        <div className="app-card p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-slate-400">Total Asset Valuation</span>
            <div className="p-1.5 rounded-md bg-slate-800 text-slate-400">
              <IndianRupee className="w-3.5 h-3.5 text-blue-400" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold text-slate-100 font-mono tracking-tight">
              ₹{(summary?.totalValuation ?? 0).toLocaleString('en-IN')}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>{summary?.activeSkus ?? 0} Catalog SKUs</span>
              <span className="text-blue-400 font-medium">Active Stock</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Physical Stock Units */}
        <div className="app-card p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-slate-400">Physical Warehouse Units</span>
            <div className="p-1.5 rounded-md bg-slate-800 text-slate-400">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold text-slate-100 font-mono tracking-tight">
              {(summary?.totalUnits ?? 0).toLocaleString()} <span className="text-xs font-sans text-slate-500 font-normal">units</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Across all categories</span>
              <span className="text-cyan-400 font-medium">Verified Balances</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Reorder Attention / Low Stock */}
        <div
          onClick={() => onNavigate('low-stock')}
          className="app-card p-4 flex flex-col justify-between cursor-pointer hover:border-amber-500/40 transition-colors"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-amber-400">Reorder Attention</span>
            <div className="p-1.5 rounded-md bg-slate-800 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold text-amber-400 font-mono tracking-tight">
              {summary?.lowStockCount ?? lowStockItems.length} <span className="text-xs font-sans text-amber-500 font-medium">items</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Below safe threshold</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Action Required
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Zero Stock / Stockouts */}
        <div
          onClick={() => onNavigate('low-stock')}
          className="app-card p-4 flex flex-col justify-between cursor-pointer hover:border-rose-500/40 transition-colors"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium text-rose-400">Zero Balance Stockouts</span>
            <div className="p-1.5 rounded-md bg-slate-800 text-rose-400">
              <AlertOctagon className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold text-rose-400 font-mono tracking-tight">
              {summary?.outOfStockCount ?? 0} <span className="text-xs font-sans text-rose-500 font-medium">SKUs</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Immediate restock</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                (summary?.outOfStockCount ?? 0) > 0
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {(summary?.outOfStockCount ?? 0) > 0 ? 'Out of Stock' : 'Clear'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Data Visualizations & Analytics Section (Area Chart Velocity & Category Share Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Chart (2 cols): Stock Velocity Velocity Area Chart */}
        <div className="lg:col-span-2 app-card p-5 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Stock Movement Velocity</h2>
                <p className="text-xs text-slate-400">Daily physical inflow vs outflow units recorded in ledger</p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <div className="hidden sm:flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-sm bg-cyan-400" />
                  Inflow (IN)
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-sm bg-rose-400" />
                  Outflow (OUT)
                </span>
              </div>

              {/* Time Horizon Segmented Control */}
              <div className="inline-flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-md text-xs">
                <button
                  onClick={() => setTimeHorizon(14)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    timeHorizon === 14 ? 'bg-slate-800 text-slate-100 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  14 Days
                </button>
                <button
                  onClick={() => setTimeHorizon(30)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    timeHorizon === 30 ? 'bg-slate-800 text-slate-100 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  30 Days
                </button>
              </div>
            </div>
          </div>

          {/* Area Chart Container */}
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={velocity} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#20222a" vertical={false} />

                <XAxis
                  dataKey="label"
                  stroke="#656a7d"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#656a7d"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}`}
                />

                <Tooltip content={<CustomVelocityTooltip />} />

                <Area
                  type="monotone"
                  dataKey="inflow"
                  name="Inflow (IN)"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fill="#06b6d4"
                  fillOpacity={0.12}
                />
                <Area
                  type="monotone"
                  dataKey="outflow"
                  name="Outflow (OUT)"
                  stroke="#fb7185"
                  strokeWidth={2}
                  fill="#fb7185"
                  fillOpacity={0.12}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Secondary Chart (1 col): Category Valuation & Share Donut */}
        <div className="app-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                <PieIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-100">Category Distribution</h2>
                <p className="text-xs text-slate-400 truncate">
                  {categoryMode === 'sales'
                    ? `Sales revenue by category (${timeHorizon}d)`
                    : 'Inventory valuation by category'}
                </p>
              </div>
            </div>

            {/* Mode Segmented Control */}
            <div className="inline-flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-md text-xs shrink-0">
              <button
                type="button"
                onClick={() => setCategoryMode('valuation')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  categoryMode === 'valuation'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
                title="View inventory valuation by category"
              >
                Stock Value
              </button>
              <button
                type="button"
                onClick={() => setCategoryMode('sales')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  categoryMode === 'sales'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
                title="View sales revenue generated by category"
              >
                Sales Revenue
              </button>
            </div>
          </div>

          {/* Donut Chart */}
          <div className="h-[160px] w-full flex items-center justify-center">
            {donutData.length === 0 ? (
              <div className="text-xs text-slate-500 text-center">
                {categoryMode === 'sales' ? 'No sales recorded in this period' : 'No active categories found'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomDonutTooltip isSalesMode={categoryMode === 'sales'} />} />
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="totalValue"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#121316" strokeWidth={2} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Category Share Legend Table */}
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 max-h-[110px] overflow-y-auto">
            {donutData.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-slate-300 truncate">{cat.name}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                  <span className="text-slate-400">₹{cat.totalValue.toLocaleString('en-IN')}</span>
                  <span className="text-slate-500 font-sans">({cat.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Operational Activity Hub: Top Turnover Ranking & Direct Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column (1 col): Top Fast-Moving Items Ranking */}
        <div className="app-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400">
                  <Flame className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Fast-Moving Items</h3>
                  <p className="text-[11px] text-slate-400">Highest sales turnover in {timeHorizon}d</p>
                </div>
              </div>
            </div>

            {topProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No outward sales recorded in this period yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 mt-1">
                {topProducts.map((p, idx) => (
                  <div key={p.productId} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs font-bold text-slate-500 w-4 text-center">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-100 truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {p.sku} • {p.category}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-xs font-bold text-slate-100">
                        {p.unitsSold} {p.unit}
                      </div>
                      <div className="text-[10px] text-emerald-400 font-mono">
                        ₹{p.revenue.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Columns (2 cols): Direct Quick Ledger Transactions */}
        <div className="lg:col-span-2 app-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-400">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Quick Ledger Operations</h3>
                  <p className="text-[11px] text-slate-400">Atomic ledger state transitions with idempotency protection</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
              <button
                onClick={() => onOpenMovementModal('SALE_OUT')}
                className="p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 transition-colors text-left flex flex-col justify-between group active:scale-98"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-100 group-hover:text-rose-400 transition-colors">
                    Customer Sale
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-[11px] text-slate-400 mt-2">
                  Deduct sold units from physical stock
                </div>
                <span className="mt-2 text-[10px] font-mono font-medium text-rose-400">
                  Type: SALE_OUT
                </span>
              </button>

              <button
                onClick={() => onOpenMovementModal('RETURN_IN')}
                className="p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 transition-colors text-left flex flex-col justify-between group active:scale-98"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-100 group-hover:text-teal-400 transition-colors">
                    Customer Return
                  </span>
                  <RotateCcw className="w-4 h-4 text-teal-400" />
                </div>
                <div className="text-[11px] text-slate-400 mt-2">
                  Re-enter returned units into stock
                </div>
                <span className="mt-2 text-[10px] font-mono font-medium text-teal-400">
                  Type: RETURN_IN
                </span>
              </button>

              {isOwner ? (
                <>
                  <button
                    onClick={() => onOpenMovementModal('PURCHASE_IN')}
                    className="p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 transition-colors text-left flex flex-col justify-between group active:scale-98"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors">
                        Receive Purchase
                      </span>
                      <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-2">
                      Inbound shipment from supplier
                    </div>
                    <span className="mt-2 text-[10px] font-mono font-medium text-emerald-400">
                      Type: PURCHASE_IN
                    </span>
                  </button>

                  <button
                    onClick={() => onOpenMovementModal('ADJUSTMENT_IN')}
                    className="p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 transition-colors text-left flex flex-col justify-between group active:scale-98"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-100 group-hover:text-cyan-400 transition-colors">
                        Stock Adjustment
                      </span>
                      <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-2">
                      Audit correction (+IN or -OUT)
                    </div>
                    <span className="mt-2 text-[10px] font-mono font-medium text-cyan-400">
                      Type: ADJUSTMENT
                    </span>
                  </button>
                </>
              ) : (
                <div className="col-span-2 p-3 rounded-lg bg-slate-800/30 border border-slate-800 text-xs text-slate-400 flex items-center justify-center text-center">
                  Purchase receipt and stock adjustments are reserved for shop owners.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Two-Column Live Ledger Feeds: Low Stock Watchlist & Recent Immutable Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Low Stock Critical Attention */}
        <div className="app-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Low Stock Attention List</h3>
                  <p className="text-[11px] text-slate-400">Items below configured minimum safety threshold</p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('low-stock')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
              >
                <span>View all ({lowStockItems.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 mb-1.5 opacity-80" />
                <span className="font-semibold text-slate-200">Stock Levels Optimal</span>
                <span className="text-[11px] text-slate-500 mt-0.5">
                  No products are currently under threshold.
                </span>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 mt-1">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div key={item._id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-100 text-xs truncate">{item.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {item.sku} • Min: {item.lowStockThreshold} {item.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <StockStatusBadge
                        currentStock={item.currentStock}
                        threshold={item.lowStockThreshold}
                        unit={item.unit}
                      />
                      {isOwner && (
                        <button
                          onClick={() => onOpenMovementModal('PURCHASE_IN', item._id)}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        >
                          Restock
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Ledger Audit Trail */}
        <div className="app-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-400">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Recent Audit Ledger</h3>
                  <p className="text-[11px] text-slate-400">Immutable ledger transactions</p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('movements')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
              >
                <span>Full Ledger</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentMovements.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No stock movements logged yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 mt-1">
                {recentMovements.map((mov) => (
                  <div key={mov._id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200 text-xs truncate">
                          {mov.product?.name || 'Product'}
                        </span>
                        {mov.reference && (
                          <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono shrink-0 border border-slate-700">
                            {mov.reference}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {mov.reason} • by {mov.actor?.name || 'User'}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <MovementTypeBadge
                        type={mov.type}
                        quantity={mov.quantity}
                        unit={mov.product?.unit}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Inventory Ledger"
        subtitle="Export full catalog inventory valuation, current stock levels, and KPI balances"
        entityName="All Products"
        stats={{
          total: summary?.activeSkus ?? 0,
          label: 'Master Catalog Ledger'
        }}
        onExport={handleExportSubmit}
      />
    </div>
  );
};
