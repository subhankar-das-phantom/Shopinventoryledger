import React, { createContext, useContext, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { api, fetcher, extractErrorMessage } from '../api/client.js';
import { User } from '../types/index.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isOwner: boolean;
  isStaff: boolean;
  mutateUser: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  // Use SWR to cache and automatically revalidate the authenticated session
  const { data, isLoading, mutate: mutateMe } = useSWR<{ success: boolean; data: { user: User } }>(
    token ? '/auth/me' : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      shouldRetryOnError: false,
      onError: (err: any) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          setToken(null);
        }
      }
    }
  );

  const user = data?.success ? data.data.user : null;

  const login = async (email: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        const { token: newToken, user: newUser } = res.data.data;
        localStorage.setItem('token', newToken);
        setToken(newToken);
        // Pre-seed SWR cache with user object without waiting for another network request
        await mutateMe({ success: true, data: { user: newUser } }, false);
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (err: any) {
      return { success: false, error: extractErrorMessage(err) };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      await mutateMe(undefined, false);
      // Invalidate all cached SWR keys across the application
      mutate(() => true, undefined, { revalidate: false });
    }
  };

  const isOwner = user?.role === 'OWNER';
  const isStaff = user?.role === 'STAFF';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading: token ? isLoading : false,
        login,
        logout,
        isOwner,
        isStaff,
        mutateUser: mutateMe
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
