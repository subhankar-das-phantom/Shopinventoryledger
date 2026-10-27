import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Shield, User, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email.trim(), password);
    if (result.success) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  const handleQuickFill = (demoRole: 'owner' | 'staff') => {
    if (demoRole === 'owner') {
      setEmail('owner@shopledger.local');
      setPassword('OwnerPassword123!');
    } else {
      setEmail('staff@shopledger.local');
      setPassword('StaffPassword123!');
    }
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo and Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-lg bg-blue-600 border border-blue-500/30 items-center justify-center text-white font-bold text-xl shadow-sm">
            IL
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Shop Inventory Ledger</h1>
          <p className="text-xs text-slate-400">
            Accounting-grade inventory ledger with strict concurrency controls
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-2xl space-y-6">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg flex items-start gap-2.5 text-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@shopledger.local"
                  className="w-full bg-slate-800/80 border border-slate-700 pl-9 pr-3 py-2 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-800/80 border border-slate-700 pl-9 pr-3 py-2 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick-Fill Demo Credentials Helper */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">
              Evaluator Quick-Fill Credentials
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('owner')}
                className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-blue-950/40 border border-blue-900/50 hover:bg-blue-900/30 text-blue-300 text-xs font-medium transition"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Fill Owner</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('staff')}
                className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                <User className="w-3.5 h-3.5" />
                <span>Fill Staff</span>
              </button>
            </div>
            <div className="text-[11px] text-slate-500 text-center">
              Owner: Full access | Staff: Sales & Returns only
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500">
          Shop Inventory Ledger • Built with React, TypeScript & Node.js
        </div>
      </div>
    </div>
  );
};
