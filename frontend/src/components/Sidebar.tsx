import React from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  X
} from 'lucide-react';

interface SidebarProps {
  currentTab?: string;
  setCurrentTab?: (tab: string) => void;
  onOpenMovementModal: () => void;
  lowStockCount?: number;
  isCollapsed: boolean;
  onCloseMobile: () => void;
  mobileOpen: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenMovementModal,
  lowStockCount = 0,
  isCollapsed,
  onCloseMobile,
  mobileOpen
}) => {
  const { user, logout, isOwner } = useAuth();
  const location = useLocation();

  const navSections = [
    {
      title: 'INVENTORY & CATALOG',
      items: [
        { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'products', path: '/products', label: 'Products', icon: Package },
        {
          id: 'low-stock',
          path: '/low-stock',
          label: 'Low Stock',
          icon: AlertTriangle,
          badge: lowStockCount > 0 ? String(lowStockCount) : undefined
        }
      ]
    },
    {
      title: 'AUDIT & HISTORY',
      items: [{ id: 'movements', path: '/movements', label: 'Movement Ledger', icon: History }]
    },
    ...(isOwner
      ? [
          {
            title: 'ADMINISTRATION',
            items: [{ id: 'staff', path: '/staff', label: 'Staff Accounts', icon: Users }]
          }
        ]
      : [])
  ];

  const isItemActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md lg:hidden animate-in fade-in duration-200"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-[#0e0f12] border-r border-white/[0.06] flex flex-col justify-between transition-all duration-300 ease-in-out lg:static lg:h-screen lg:shrink-0 ${
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-[72px]' : 'lg:w-64'}`}
      >
        {/* Top: Brand Header */}
        <div className={`border-b border-white/[0.06] flex items-center ${isCollapsed ? 'p-3.5 justify-center' : 'p-4 justify-between'}`}>
          <Link
            to="/dashboard"
            onClick={onCloseMobile}
            className="flex items-center gap-3 cursor-pointer group select-none min-w-0"
          >
            {/* Logo Icon with subtle gradient glow */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-blue-500/25 shrink-0 group-hover:scale-105 transition-transform">
              IL
            </div>

            {/* Brand Text (hidden if collapsed) */}
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="font-bold text-slate-100 text-sm tracking-tight leading-tight group-hover:text-blue-400 transition-colors truncate">
                  Shop Inventory
                </div>
                <div className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
                  Accounting Ledger
                </div>
              </div>
            )}
          </Link>

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action: Record Stock */}
        <div className={`p-3 ${isCollapsed ? 'flex justify-center' : ''}`}>
          <button
            onClick={() => {
              onOpenMovementModal();
              onCloseMobile();
            }}
            title="Record Stock Movement"
            className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-500/25 active:scale-95 ${
              isCollapsed ? 'w-10 h-10 p-0' : 'w-full py-2.5 px-3'
            }`}
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Record Movement</span>}
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-4">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {!isCollapsed && (
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1">
                  {section.title}
                </div>
              )}

              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = isItemActive(item.path);
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={onCloseMobile}
                    title={isCollapsed ? item.label : undefined}
                    className={`group relative w-full flex items-center rounded-xl transition-all ${
                      isCollapsed
                        ? 'justify-center p-2.5 my-1'
                        : 'justify-between px-3 py-2 my-0.5 text-sm'
                    } ${
                      isActive
                        ? 'bg-blue-500/15 border border-blue-500/25 text-blue-400 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    {/* Active Accent Left Bar */}
                    {isActive && (
                      <span className="absolute left-0 w-1 h-5 bg-blue-500 rounded-r-full" />
                    )}

                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-blue-400'
                            : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      {!isCollapsed && (
                        <span className="truncate text-xs font-medium">
                          {item.label}
                        </span>
                      )}
                    </div>

                    {!isCollapsed && item.badge && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {item.badge}
                      </span>
                    )}

                    {/* Collapsed Badge Dot Indicator */}
                    {isCollapsed && item.badge && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#0e0f12]" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom User Card */}
        <div className="p-3 border-t border-white/[0.06] bg-[#0b0c0e]">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-900/60 to-slate-800 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-300">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/60 border border-white/[0.05]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-200 text-xs truncate">
                    {user?.name}
                  </span>
                  <RoleBadge role={user?.role || 'STAFF'} />
                </div>
                <div className="text-[10px] text-slate-400 truncate font-mono mt-0.5">
                  {user?.email}
                </div>
              </div>

              <button
                onClick={logout}
                title="Sign out"
                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
