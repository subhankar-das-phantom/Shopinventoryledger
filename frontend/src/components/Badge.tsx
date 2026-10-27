import React from 'react';
import { MovementType, MovementDirection } from '../types/index.js';
import {
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  User as UserIcon
} from 'lucide-react';

interface MovementBadgeProps {
  type: MovementType;
  direction?: MovementDirection;
  quantity?: number;
  unit?: string;
}

export const MovementTypeBadge: React.FC<MovementBadgeProps> = ({
  type,
  quantity,
  unit = ''
}) => {
  switch (type) {
    case 'PURCHASE_IN':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
          <span>Purchase (IN)</span>
          {quantity !== undefined && (
            <span className="font-mono text-emerald-200">+{quantity} {unit}</span>
          )}
        </span>
      );
    case 'RETURN_IN':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-950 text-teal-300 border border-teal-800/60">
          <RotateCcw className="w-3.5 h-3.5 text-teal-400" />
          <span>Return (IN)</span>
          {quantity !== undefined && (
            <span className="font-mono text-teal-200">+{quantity} {unit}</span>
          )}
        </span>
      );
    case 'ADJUSTMENT_IN':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60">
          <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
          <span>Adjustment (IN)</span>
          {quantity !== undefined && (
            <span className="font-mono text-cyan-200">+{quantity} {unit}</span>
          )}
        </span>
      );
    case 'SALE_OUT':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800/60">
          <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
          <span>Sale (OUT)</span>
          {quantity !== undefined && (
            <span className="font-mono text-rose-200">-{quantity} {unit}</span>
          )}
        </span>
      );
    case 'ADJUSTMENT_OUT':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800/60">
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
          <span>Adjustment (OUT)</span>
          {quantity !== undefined && (
            <span className="font-mono text-amber-200">-{quantity} {unit}</span>
          )}
        </span>
      );
    default:
      return null;
  }
};

interface StockStatusBadgeProps {
  currentStock: number;
  threshold: number;
  unit?: string;
}

export const StockStatusBadge: React.FC<StockStatusBadgeProps> = ({
  currentStock,
  threshold,
  unit = ''
}) => {
  if (currentStock === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-950/80 text-red-300 border border-red-800/50">
        <XCircle className="w-3 h-3 text-red-400" />
        <span>Out of Stock</span>
      </span>
    );
  }

  if (currentStock <= threshold) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-800/50">
        <AlertTriangle className="w-3 h-3 text-amber-400" />
        <span>Low ({currentStock} {unit})</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
      <CheckCircle className="w-3 h-3 text-emerald-400" />
      <span>{currentStock} {unit}</span>
    </span>
  );
};

export const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  if (role === 'OWNER') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
        <Shield className="w-3 h-3" />
        <span>OWNER</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
      <UserIcon className="w-3 h-3" />
      <span>STAFF</span>
    </span>
  );
};
