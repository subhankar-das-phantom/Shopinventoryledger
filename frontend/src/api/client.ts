import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach Authorization header if token exists in localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Format API error messages cleanly
export const extractErrorMessage = (error: any): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
    return error.response.data.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ');
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
};

// Generate unique idempotency key for state changes
export const createIdempotencyKey = (prefix: string = 'req'): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// SWR Fetcher with configured Axios instance
export const fetcher = async <T = any>(url: string): Promise<T> => {
  const res = await api.get(url);
  return res.data;
};

// Reusable file download helper for Excel/CSV/JSON exports
export const downloadFile = async (
  endpoint: string,
  params: Record<string, any> = {},
  fallbackFilename: string = 'export'
): Promise<void> => {
  try {
    const response = await api.get(endpoint, {
      params,
      responseType: 'blob'
    });

    let filename = fallbackFilename;
    const disposition = response.headers['content-disposition']
      ? String(response.headers['content-disposition'])
      : '';
    if (disposition) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const contentType = response.headers['content-type']
      ? String(response.headers['content-type'])
      : 'application/octet-stream';

    const blob = new Blob([response.data], {
      type: contentType
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    if (error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        const json = JSON.parse(text);
        if (json.message) {
          error.message = json.message;
        }
      } catch {
        // Fallback to error.message
      }
    }
    throw error;
  }
};

