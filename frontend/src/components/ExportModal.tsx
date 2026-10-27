import React, { useState } from 'react';
import {
  Download,
  X,
  FileSpreadsheet,
  FileText,
  FileCode,
  CheckCircle2,
  Loader2,
  Calendar,
  Layers
} from 'lucide-react';

export type ExportFormat = 'excel' | 'csv' | 'json';

export interface ExportDateRange {
  startDate: string;
  endDate: string;
  preset: string;
}

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  entityName?: string;
  stats?: {
    total?: number;
    label?: string;
  };
  showDateRange?: boolean;
  defaultFormat?: ExportFormat;
  onExport: (options: { format: ExportFormat; dateRange?: ExportDateRange }) => Promise<void>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  title = 'Export Data',
  subtitle = 'Choose your preferred export format and filters',
  entityName = 'Records',
  stats,
  showDateRange = false,
  defaultFormat = 'excel',
  onExport
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(defaultFormat);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<ExportDateRange>({
    startDate: '',
    endDate: '',
    preset: 'all'
  });

  if (!isOpen) return null;

  const getPresetDates = (preset: string): ExportDateRange => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const getShiftedDate = (daysBack: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysBack);
      return d.toISOString().split('T')[0];
    };

    switch (preset) {
      case 'today':
        return { startDate: todayStr, endDate: todayStr, preset: 'today' };
      case 'yesterday': {
        const yStr = getShiftedDate(1);
        return { startDate: yStr, endDate: yStr, preset: 'yesterday' };
      }
      case 'last7Days':
        return { startDate: getShiftedDate(6), endDate: todayStr, preset: 'last7Days' };
      case 'thisMonth': {
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        return { startDate: `${y}-${m}-01`, endDate: todayStr, preset: 'thisMonth' };
      }
      case 'lastMonth': {
        const d = new Date(today.getFullYear(), today.getMonth(), 0);
        const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const y = prevMonthDate.getFullYear();
        const m = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
        const endDay = String(d.getDate()).padStart(2, '0');
        return { startDate: `${y}-${m}-01`, endDate: `${y}-${m}-${endDay}`, preset: 'lastMonth' };
      }
      case 'last30Days':
        return { startDate: getShiftedDate(29), endDate: todayStr, preset: 'last30Days' };
      case 'thisYear': {
        const y = today.getFullYear();
        return { startDate: `${y}-01-01`, endDate: todayStr, preset: 'thisYear' };
      }
      case 'all':
      default:
        return { startDate: '', endDate: '', preset: 'all' };
    }
  };

  const handlePresetSelect = (preset: string) => {
    setDateRange(getPresetDates(preset));
  };

  const handleExportClick = async () => {
    if (isExporting) return;
    try {
      setIsExporting(true);
      await onExport({
        format: selectedFormat,
        dateRange: showDateRange ? dateRange : undefined
      });
      onClose();
    } catch {
      // Error handled by parent toast/notification
    } finally {
      setIsExporting(false);
    }
  };

  const formatOptions = [
    {
      id: 'excel' as ExportFormat,
      name: 'Excel Workbook (.xlsx)',
      badge: 'Recommended',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      description: 'Styled spreadsheet with auto-filters, formatted currency, and executive summary KPI sheet.',
      icon: FileSpreadsheet,
      accentColor: 'text-emerald-400',
      activeBorder: 'border-emerald-500/60 bg-emerald-500/5'
    },
    {
      id: 'csv' as ExportFormat,
      name: 'CSV Document (.csv)',
      badge: 'Standard',
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      description: 'Lightweight tabular data with formula injection mitigation. Compatible with Google Sheets and Excel.',
      icon: FileText,
      accentColor: 'text-blue-400',
      activeBorder: 'border-blue-500/60 bg-blue-500/5'
    },
    {
      id: 'json' as ExportFormat,
      name: 'JSON File (.json)',
      badge: 'Structured',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      description: 'Raw structured JSON records with full metadata. Ideal for automated backups and API integrations.',
      icon: FileCode,
      accentColor: 'text-amber-400',
      activeBorder: 'border-amber-500/60 bg-amber-500/5'
    }
  ];

  const presets = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'last7Days', label: 'Last 7 Days' },
    { id: 'thisMonth', label: 'This Month' },
    { id: 'lastMonth', label: 'Last Month' },
    { id: 'last30Days', label: 'Last 30 Days' },
    { id: 'thisYear', label: 'This Year' }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => {
        if (!isExporting) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl bg-[#0e0e11] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80 bg-[#121216]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                {title}
              </h2>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Summary Banner if stats provided */}
          {stats && (
            <div className="flex items-center justify-between px-4 py-3 bg-[#18181b]/70 border border-slate-800/80 rounded-xl text-xs">
              <span className="text-slate-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                Target Dataset: <strong className="text-slate-200">{stats.label || entityName}</strong>
              </span>
              <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg font-semibold font-mono">
                {stats.total ?? 0} items matching current view
              </span>
            </div>
          )}

          {/* Format Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              1. Select File Format
            </label>
            <div className="grid grid-cols-1 gap-3">
              {formatOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedFormat === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedFormat(opt.id)}
                    className={`relative w-full text-left p-4 rounded-xl border transition-all flex items-start gap-4 ${
                      isSelected
                        ? opt.activeBorder
                        : 'border-slate-800 bg-[#121216]/60 hover:border-slate-700 hover:bg-[#16161c]'
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl border ${
                        isSelected
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          : 'bg-slate-800/50 border-slate-700/50 text-slate-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className="text-sm font-semibold text-slate-100">{opt.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${opt.badgeColor}`}>
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{opt.description}</p>
                    </div>

                    {isSelected && (
                      <div className="absolute top-4 right-4 text-blue-400">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Date Range Selection */}
          {showDateRange && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                2. Filter by Date Range (Optional)
              </label>

              {/* Presets */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetSelect(p.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      dateRange.preset === p.id
                        ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                        : 'bg-[#121216] text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Inputs */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Start Date</label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) =>
                        setDateRange({ ...dateRange, startDate: e.target.value, preset: 'custom' })
                      }
                      className="w-full bg-[#121216] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">End Date</label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) =>
                        setDateRange({ ...dateRange, endDate: e.target.value, preset: 'custom' })
                      }
                      className="w-full bg-[#121216] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/80 bg-[#121216]">
          <span className="text-xs text-slate-400">
            Selected Format:{' '}
            <strong className="text-slate-200 uppercase font-mono">{selectedFormat}</strong>
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-800/60 rounded-xl border border-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExportClick}
              disabled={isExporting}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Generating {selectedFormat.toUpperCase()}...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download {selectedFormat.toUpperCase()}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
