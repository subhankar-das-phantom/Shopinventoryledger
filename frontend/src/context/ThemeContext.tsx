import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.js';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // 1. Initial theme: check localStorage or default to dark
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('shop-ledger-theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    return 'dark';
  });

  // 2. Apply theme to document element
  const applyThemeToDOM = (mode: ThemeMode) => {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    if (mode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  };

  // 3. Keep DOM in sync with current theme
  useEffect(() => {
    applyThemeToDOM(theme);
    localStorage.setItem('shop-ledger-theme', theme);
  }, [theme]);

  // 4. Sync from user's backend profile when user is loaded
  useEffect(() => {
    if (user?.preferences?.theme) {
      const userTheme = user.preferences.theme as ThemeMode;
      if (userTheme === 'light' || userTheme === 'dark') {
        if (userTheme !== theme) {
          setThemeState(userTheme);
        }
      }
    }
  }, [user]);

  // 5. Update theme and persist in database if user is logged in
  const setTheme = useCallback(
    async (newTheme: ThemeMode) => {
      setThemeState(newTheme);
      applyThemeToDOM(newTheme);
      localStorage.setItem('shop-ledger-theme', newTheme);

      // Persist in User model if authenticated
      if (localStorage.getItem('token')) {
        try {
          await api.patch('/auth/preferences', { theme: newTheme });
        } catch {
          // Ignore network errors on background preference save
        }
      }
    },
    []
  );

  const toggleTheme = useCallback(() => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
