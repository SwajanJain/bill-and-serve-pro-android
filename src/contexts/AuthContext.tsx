import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { User, UserRole } from '@/types';
import { storage } from '@/lib/storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  pinLogin: (pin: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Role-based permissions
const rolePermissions: Record<string, string[]> = {
  owner: ['*'],
  manager: [
    'pos.create', 'pos.discount', 'pos.cancel', 'pos.void', 'pos.refund',
    'reports.view', 'reports.export',
    'menu.view', 'menu.edit', 'menu.manage',
    'tables.view', 'tables.edit',
    'users.view', 'users.edit',
    'settings.view', 'settings.edit', 'settings.manage',
    'audit.view',
  ],
  cashier: [
    'pos.create', 'pos.discount.limited', 'pos.payment',
    'tables.view',
    'menu.view',
  ],
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const autoLogoutRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved user session on mount
  useEffect(() => {
    const loadSavedUser = async () => {
      try {
        const savedUser = await storage.getCurrentUser<User>();
        if (savedUser) {
          const userWithDate = {
            ...savedUser,
            createdAt: new Date(savedUser.createdAt),
          };
          setUser(userWithDate);
        }
      } catch (error) {
        console.error('Error loading saved user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedUser();
  }, []);

  // Save user to storage whenever it changes
  useEffect(() => {
    if (!isLoading) {
      storage.saveCurrentUser(user);
    }
  }, [user, isLoading]);

  // Phase 2.3: End-of-day auto-logout
  useEffect(() => {
    if (!user) {
      if (autoLogoutRef.current) {
        clearInterval(autoLogoutRef.current);
        autoLogoutRef.current = null;
      }
      return;
    }

    const checkClosingTime = async () => {
      try {
        const settings = await storage.getRestaurantSettings<{ closingTime?: string }>();
        const closingTime = settings?.closingTime || '23:00';
        const [hours, minutes] = closingTime.split(':').map(Number);
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const closingMinutes = hours * 60 + minutes;

        if (currentMinutes >= closingMinutes) {
          setUser(null);
        }
      } catch {
        // ignore
      }
    };

    autoLogoutRef.current = setInterval(checkClosingTime, 60_000);
    return () => {
      if (autoLogoutRef.current) {
        clearInterval(autoLogoutRef.current);
      }
    };
  }, [user]);

  // Phase 2.1: Load users from storage, check isActive
  const pinLogin = useCallback(async (pin: string): Promise<boolean> => {
    const storedUsers = await storage.getUsers<User[]>();
    const users = storedUsers || [];
    const foundUser = users.find(u => u.pin === pin);

    if (foundUser && foundUser.isActive) {
      const userWithDate = {
        ...foundUser,
        createdAt: new Date(foundUser.createdAt),
      };
      setUser(userWithDate);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  // Phase 2.5: Safe hasPermission for unknown roles
  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    const permissions = rolePermissions[user.role];
    if (!permissions) return false;
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, pinLogin, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
