export type UserRole = 'OWNER' | 'STAFF';

export interface UserPreferences {
  theme?: 'dark' | 'light' | 'system';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  preferences?: UserPreferences;
  createdAt?: string;
}

export interface Product {
  _id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  lowStockThreshold: number;
  isActive: boolean;
  currentStock: number;
  createdAt: string;
  updatedAt: string;
}

export type MovementType =
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'RETURN_IN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT';

export type MovementDirection = 'IN' | 'OUT';

export interface StockMovement {
  _id: string;
  movementId: string;
  productId: string;
  type: MovementType;
  direction: MovementDirection;
  quantity: number;
  reason: string;
  reference?: string;
  movementDate: string;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
  actor?: {
    id: string;
    name: string;
    role: UserRole;
  };
}

export interface LowStockProduct {
  _id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  lowStockThreshold: number;
  currentStock: number;
  isZeroStock: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
}

export interface VelocityPoint {
  date: string;
  label: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface CategoryDistribution {
  name: string;
  skuCount?: number;
  stockUnits?: number;
  unitsSold?: number;
  totalValue: number;
  percentage: number;
}

export interface TopProductItem {
  productId: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  price: number;
  unitsSold: number;
  transactionCount: number;
  revenue: number;
}

export interface AnalyticsSummary {
  totalValuation: number;
  totalUnits: number;
  activeSkus: number;
  lowStockCount: number;
  outOfStockCount: number;
  optimalCount: number;
  inflow30d: number;
  outflow30d: number;
  net30d: number;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  velocity: VelocityPoint[];
  categoryDistribution: CategoryDistribution[];
  categorySales?: CategoryDistribution[];
  topProducts: TopProductItem[];
}
