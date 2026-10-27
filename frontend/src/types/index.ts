export type UserRole = 'OWNER' | 'STAFF';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
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
