import React from 'react';
import { MovementType, MovementDirection } from '../types/index.js';
import {
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  SlidersHorizontal,
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-950/40">
          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
          <span>Purchase (IN)</span>
          {quantity !== undefined && (
            <span className="font-mono text-emerald-300 font-bold ml-0.5">+{quantity} {unit}</span>
          )}
        </span>
      );
    case 'RETURN_IN':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-sm shadow-teal-950/40">
          <RotateCcw className="w-3.5 h-3.5 text-teal-400" />
          <span>Return (IN)</span>
          {quantity !== undefined && (
            <span className="font-mono text-teal-300 font-bold ml-0.5">+{quantity} {unit}</span>
          )}
        </span>
      );
    case 'ADJUSTMENT_IN':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm shadow-cyan-950/40">
          <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
          <span>Adjustment (IN)</span>
          {quantity !== undefined && (
            <span className="font-mono text-cyan-300 font-bold ml-0.5">+{quantity} {unit}</span>
          )}
        </span>
      );
    case 'SALE_OUT':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-sm shadow-rose-950/40">
          <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
          <span>Sale (OUT)</span>
          {quantity !== undefined && (
            <span className="font-mono text-rose-300 font-bold ml-0.5">-{quantity} {unit}</span>
          )}
        </span>
      );
    case 'ADJUSTMENT_OUT':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm shadow-amber-950/40">
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
          <span>Adjustment (OUT)</span>
          {quantity !== undefined && (
            <span className="font-mono text-amber-300 font-bold ml-0.5">-{quantity} {unit}</span>
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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
        <span>Out of Stock</span>
      </span>
    );
  }

  if (currentStock <= threshold) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span>Low ({currentStock} {unit})</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      <span className="font-mono">{currentStock} {unit}</span>
    </span>
  );
};

export const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  if (role === 'OWNER') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30">
        <Shield className="w-3 h-3 text-blue-400" />
        <span>OWNER</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
      <UserIcon className="w-3 h-3 text-slate-400" />
      <span>STAFF</span>
    </span>
  );
};
