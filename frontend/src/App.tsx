import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Sidebar } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ProductsPage } from './pages/ProductsPage.js';
import { ProductDetailPage } from './pages/ProductDetailPage.js';
import { MovementsPage } from './pages/MovementsPage.js';
import { LowStockPage } from './pages/LowStockPage.js';
import { StaffPage } from './pages/StaffPage.js';
import { RecordMovementModal } from './components/RecordMovementModal.js';
import { ProductFormModal } from './components/ProductFormModal.js';
import { api } from './api/client.js';
import { Product, MovementType } from './types/index.js';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Desktop sidebar collapsed state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('shop-ledger-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Mobile drawer open state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  // Modals state
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementModalType, setMovementModalType] = useState<MovementType | undefined>(undefined);
  const [movementModalProductId, setMovementModalProductId] = useState<string | undefined>(undefined);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  // Low stock counter for header badge
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  const fetchLowStockCount = async () => {
    try {
      const res = await api.get('/stock/low-stock');
      if (res.data.success) {
        setLowStockCount(res.data.count || 0);
      }
    } catch {
      // Ignore background badge error
    }
  };

  useEffect(() => {
    if (user) {
      fetchLowStockCount();
    }
  }, [user, currentTab]);

  // Global Ctrl+B shortcut to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        if (window.innerWidth >= 1024) {
          e.preventDefault();
          setIsSidebarCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem('shop-ledger-sidebar-collapsed', String(next));
            return next;
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="text-sm font-medium">Loading Shop Inventory Ledger...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleOpenMovementModal = (type?: MovementType, productId?: string) => {
    setMovementModalType(type);
    setMovementModalProductId(productId);
    setMovementModalOpen(true);
  };

  const handleOpenProductModal = (product?: Product) => {
    setProductToEdit(product || null);
    setProductModalOpen(true);
  };

  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    setCurrentTab('product-detail');
  };

  const handleToggleSidebar = () => {
    if (window.innerWidth >= 1024) {
      setIsSidebarCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem('shop-ledger-sidebar-collapsed', String(next));
        return next;
      });
    } else {
      setMobileDrawerOpen((prev) => !prev);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-100 flex overflow-hidden">
      {/* Responsive Collapsible Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenMovementModal={() => handleOpenMovementModal()}
        lowStockCount={lowStockCount}
        isCollapsed={isSidebarCollapsed}
        mobileOpen={mobileDrawerOpen}
        onCloseMobile={() => setMobileDrawerOpen(false)}
      />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#09090b]">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          onToggleSidebar={handleToggleSidebar}
          isSidebarCollapsed={isSidebarCollapsed}
          onOpenMovementModal={() => handleOpenMovementModal()}
        />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {currentTab === 'dashboard' && (
              <DashboardPage
                onNavigate={(tab) => setCurrentTab(tab)}
                onOpenMovementModal={handleOpenMovementModal}
                onOpenProductModal={() => handleOpenProductModal()}
              />
            )}

            {currentTab === 'products' && (
              <ProductsPage
                onSelectProduct={handleSelectProduct}
                onOpenProductModal={handleOpenProductModal}
                onOpenMovementModal={handleOpenMovementModal}
              />
            )}

            {currentTab === 'product-detail' && selectedProductId && (
              <ProductDetailPage
                productId={selectedProductId}
                onBack={() => setCurrentTab('products')}
                onOpenMovementModal={handleOpenMovementModal}
              />
            )}

            {currentTab === 'movements' && <MovementsPage />}

            {currentTab === 'low-stock' && (
              <LowStockPage
                onOpenMovementModal={handleOpenMovementModal}
                onSelectProduct={handleSelectProduct}
              />
            )}

            {currentTab === 'staff' && <StaffPage />}
          </div>
        </main>
      </div>

      {/* Global Modals */}
      <RecordMovementModal
        isOpen={movementModalOpen}
        onClose={() => setMovementModalOpen(false)}
        onSuccess={() => {
          fetchLowStockCount();
        }}
        initialType={movementModalType}
        initialProductId={movementModalProductId}
      />

      <ProductFormModal
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        onSuccess={() => {
          fetchLowStockCount();
        }}
        productToEdit={productToEdit}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
