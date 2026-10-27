import useSWR, { mutate } from 'swr';
import { fetcher } from '../api/client.js';
import {
  Product,
  StockMovement,
  AnalyticsData,
  LowStockProduct,
  Pagination
} from '../types/index.js';

export interface ProductDetailData {
  product: Product;
  movements: StockMovement[];
  totalMovements: number;
}

// Global cache mutator to revalidate all ledger & inventory queries across the app
export const invalidateInventoryCache = async () => {
  await Promise.all([
    mutate((key: any) => typeof key === 'string' && key.startsWith('/products')),
    mutate((key: any) => typeof key === 'string' && key.startsWith('/stock-movements')),
    mutate((key: any) => typeof key === 'string' && key.startsWith('/stock/analytics')),
    mutate('/stock/low-stock')
  ]);
};

// SWR Hook: Cached Product Catalog with search, filters, and pagination
export const useProducts = (params: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  stockFilter?: string;
  isActive?: boolean;
}) => {
  const query = new URLSearchParams();
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));
  if (params.search) query.append('search', params.search);
  if (params.category && params.category !== 'All Categories') query.append('category', params.category);
  if (params.stockFilter && params.stockFilter !== 'all') query.append('stockFilter', params.stockFilter);
  if (params.isActive !== undefined) query.append('isActive', String(params.isActive));

  const url = `/products?${query.toString()}`;

  const { data, error, isLoading, mutate: mutateProducts } = useSWR<{
    success: boolean;
    data: Product[];
    meta: Pagination;
    stats: {
      totalProducts: number;
      lowStockCount: number;
      outOfStockCount: number;
      totalValuation: number;
    };
  }>(url, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 3000
  });

  return {
    products: data?.data || [],
    meta: data?.meta,
    stats: data?.stats,
    isLoading,
    isError: error,
    mutate: mutateProducts
  };
};

// SWR Hook: Cached Stock Movement Ledger
export const useMovements = (params: {
  page?: number;
  limit?: number;
  productId?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const query = new URLSearchParams();
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));
  if (params.productId) query.append('productId', params.productId);
  if (params.type && params.type !== 'all') query.append('type', params.type);
  if (params.dateFrom) query.append('dateFrom', params.dateFrom);
  if (params.dateTo) query.append('dateTo', params.dateTo);

  const url = `/stock-movements?${query.toString()}`;

  const { data, error, isLoading, mutate: mutateMovements } = useSWR<{
    success: boolean;
    data: StockMovement[];
    meta: Pagination;
  }>(url, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 3000
  });

  return {
    movements: data?.data || [],
    meta: data?.meta,
    isLoading,
    isError: error,
    mutate: mutateMovements
  };
};

// SWR Hook: Cached Dashboard Analytics
export const useDashboardAnalytics = (days: number = 14) => {
  const { data: analyticsData, error: analyticsError, isLoading: analyticsLoading } = useSWR<{
    success: boolean;
    data: AnalyticsData;
  }>(`/stock/analytics?days=${days}`, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000
  });

  const { data: lowStockData, error: lowStockError, isLoading: lowStockLoading } = useSWR<{
    success: boolean;
    data: LowStockProduct[];
  }>('/stock/low-stock', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000
  });

  const { data: recentMovData, error: recentMovError, isLoading: recentMovLoading } = useSWR<{
    success: boolean;
    data: StockMovement[];
  }>('/stock-movements?limit=6', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000
  });

  return {
    analytics: analyticsData?.data || null,
    lowStockItems: lowStockData?.data || [],
    recentMovements: recentMovData?.data || [],
    isLoading: analyticsLoading || lowStockLoading || recentMovLoading,
    error: analyticsError || lowStockError || recentMovError,
    revalidate: () => {
      mutate(`/stock/analytics?days=${days}`);
      mutate('/stock/low-stock');
      mutate('/stock-movements?limit=6');
    }
  };
};

// SWR Hook: Cached Low Stock Critical Attention List
export const useLowStock = () => {
  const { data, error, isLoading, mutate: mutateLowStock } = useSWR<{
    success: boolean;
    data: LowStockProduct[];
  }>('/stock/low-stock', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000
  });

  return {
    items: data?.data || [],
    isLoading,
    isError: error,
    mutate: mutateLowStock
  };
};

// SWR Hook: Cached Product Detail & Movement Trail
export const useProductDetail = (productId: string | null) => {
  const { data, error, isLoading, mutate: mutateDetail } = useSWR<{
    success: boolean;
    data: ProductDetailData;
  }>(
    productId ? `/products/${productId}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 3000
    }
  );

  return {
    product: data?.data?.product || null,
    movements: data?.data?.movements || [],
    totalMovements: data?.data?.totalMovements || 0,
    isLoading,
    isError: error,
    mutate: mutateDetail
  };
};
