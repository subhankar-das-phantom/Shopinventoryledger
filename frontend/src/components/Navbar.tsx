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
  Menu,
  X,
  PlusCircle
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenMovementModal: () => void;
  lowStockCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenMovementModal,
  lowStockCount = 0
}) => {
  const { user, logout, isOwner } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const handleTabClick = (tabId: string) => {
    setCurrentTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Desktop Navigation */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleTabClick('dashboard')}>
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
                IL
              </div>
              <div>
                <span className="font-bold text-slate-100 tracking-tight text-base sm:text-lg block leading-none">
                  Shop Inventory Ledger
                </span>
                <span className="text-[11px] text-slate-400 font-mono">Immutable Accounting Ledger</span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 ml-1">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Header Actions */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={onOpenMovementModal}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition shadow-sm shadow-indigo-600/30"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Stock</span>
            </button>

            <div className="h-6 w-px bg-slate-800 mx-1" />

            {/* User Profile Info */}
            <div className="flex items-center gap-2.5 pl-1">
              <div className="text-right">
                <div className="text-sm font-medium text-slate-200">{user?.name}</div>
                <div className="text-xs text-slate-400">{user?.email}</div>
              </div>
              <RoleBadge role={user?.role || 'STAFF'} />
            </div>

            <button
              onClick={logout}
              title="Sign out"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={onOpenMovementModal}
              className="p-2 bg-indigo-600 text-white rounded-lg text-xs"
              title="Record Movement"
            >
              <PlusCircle className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900/95 px-4 pt-3 pb-4 space-y-2">
          <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-200">{user?.name}</div>
              <div className="text-xs text-slate-400">{user?.email}</div>
            </div>
            <RoleBadge role={user?.role || 'STAFF'} />
          </div>

          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-400 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-950/30 rounded-lg"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
