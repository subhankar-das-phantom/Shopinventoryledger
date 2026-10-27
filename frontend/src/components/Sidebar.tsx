import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { RoleBadge } from './Badge.js';
import {
  LayoutDashboard,
  Package,
  AlertTriangle,
  History,
  Users,
  LogOut,
  PlusCircle,
  Menu,
  X
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenMovementModal: () => void;
  lowStockCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenMovementModal,
  lowStockCount = 0
}) => {
  const { user, logout, isOwner } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    {
      id: 'low-stock',
      label: 'Low Stock',
      icon: AlertTriangle,
      badge: lowStockCount > 0 ? lowStockCount : undefined
    },
    { id: 'movements', label: 'Ledger History', icon: History },
    ...(isOwner ? [{ id: 'staff', label: 'Staff Accounts', icon: Users }] : [])
  ];

  const handleSelectTab = (id: string) => {
    setCurrentTab(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => handleSelectTab('dashboard')}
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/30">
            IL
          </div>
          <div>
            <span className="font-bold text-slate-100 text-sm block leading-none">
              Shop Inventory
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Ledger</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenMovementModal}
            className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm"
            title="Record Stock"
          >
            <PlusCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden animate-in fade-in duration-150"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Sidebar Drawer / Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:h-screen lg:shrink-0`}
      >
        {/* Top: Brand Header */}
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => handleSelectTab('dashboard')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-600/25 shrink-0 group-hover:scale-105 transition-transform">
                IL
              </div>
              <div>
                <h1 className="font-bold text-white text-base tracking-tight leading-tight group-hover:text-indigo-400 transition-colors">
                  Shop Inventory
                </h1>
                <p className="text-[11px] text-slate-400 font-mono tracking-wide">
                  Accounting Ledger
                </p>
              </div>
            </div>

            {/* Mobile close button inside drawer */}
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Record Action Button */}
          <div className="mt-5">
            <button
              onClick={() => {
                onOpenMovementModal();
                setMobileOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 px-3 rounded-xl text-sm font-semibold transition shadow-md shadow-indigo-600/30"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Stock</span>
            </button>
          </div>
        </div>

        {/* Middle: Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Navigation
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-indigo-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom: Authenticated User Card & Sign Out */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-800/50 border border-slate-800">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-medium text-slate-200 text-sm truncate block">
                  {user?.name}
                </span>
                <RoleBadge role={user?.role || 'STAFF'} />
              </div>
              <div className="text-xs text-slate-400 truncate font-mono">
                {user?.email}
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign out"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
