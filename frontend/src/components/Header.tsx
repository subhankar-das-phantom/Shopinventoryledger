import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Plus,
  LogOut,
  Calendar,
  ChevronRight
} from 'lucide-react';

interface HeaderProps {
  currentTab?: string;
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
  onOpenMovementModal: () => void;
  onOpenProductModal?: () => void;
  selectedProductName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  isSidebarCollapsed,
  onOpenMovementModal,
  onOpenProductModal,
  selectedProductName
}) => {
  const { user, logout, isOwner } = useAuth();
  const location = useLocation();

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });

  const getBreadcrumbTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') {
      return 'Overview';
    }
    if (path.startsWith('/products/')) {
      return selectedProductName ? selectedProductName : 'Product Detail & History';
    }
    if (path === '/products') {
      return 'Product Catalog';
    }
    if (path === '/movements') {
      return 'Movement Ledger';
    }
    if (path === '/low-stock') {
      return 'Low Stock Attention';
    }
    if (path === '/staff') {
      return 'Staff Management';
    }
    return 'Inventory';
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <header className="h-16 shrink-0 bg-[#0c0d10]/80 backdrop-blur-xl border-b border-white/[0.06] sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
      {/* Left: Sidebar Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 active:bg-slate-800 transition-colors shrink-0"
          title={isSidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="w-5 h-5" />
          ) : (
            <PanelLeftClose className="w-5 h-5 hidden lg:block" />
          )}
          <Menu className="w-5 h-5 lg:hidden" />
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium overflow-hidden whitespace-nowrap">
          <Link to="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">Shop</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <span className="text-slate-200 font-semibold truncate text-sm">
            {getBreadcrumbTitle()}
          </span>
        </div>
      </div>

      {/* Right: Date, Quick Action, and User Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Date Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-white/[0.05] text-xs text-slate-400 font-mono">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>{formattedDate}</span>
        </div>

        {/* Owner Quick Action: Add Product */}
        {isOwner && onOpenProductModal && (
          <button
            onClick={onOpenProductModal}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 px-3 py-1.5 rounded-lg text-xs font-medium transition active:scale-95"
            title="Add New Product"
          >
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Add Product</span>
          </button>
        )}

        {/* Record Stock Button */}
        <button
          onClick={onOpenMovementModal}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 shadow-sm"
          title="Record Stock Movement"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Record Stock</span>
        </button>

        <div className="h-5 w-px bg-white/[0.08] mx-1 hidden sm:block" />

        {/* User Card */}
        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
            {userInitial}
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-200 leading-tight">
              {user?.name}
            </div>
            <div className="text-[10px] text-slate-500 font-mono leading-tight">
              {user?.role}
            </div>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={logout}
          title="Sign out"
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
