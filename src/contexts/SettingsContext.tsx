import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Area, Table, RestaurantSettings } from '@/types';
import { mockUsers, mockAreas, mockTables, defaultSettings } from '@/data/mockData';
import { storage } from '@/lib/storage';
import { apiRequest } from '@/lib/api/client';
import { mapSettings, mapTable, mapUser } from '@/lib/api/mappers';

interface SettingsContextType {
  // Data
  users: User[];
  areas: Area[];
  tables: Table[];
  settings: RestaurantSettings;
  isLoading: boolean;

  // User management
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;

  // Area management
  addArea: (area: Omit<Area, 'id'>) => void;
  updateArea: (id: string, updates: Partial<Area>) => void;
  deleteArea: (id: string) => void;

  // Table management
  addTable: (table: Omit<Table, 'id'>) => void;
  updateTable: (id: string, updates: Partial<Table>) => void;
  deleteTable: (id: string) => void;

  // Settings
  updateSettings: (updates: Partial<RestaurantSettings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [areas, setAreas] = useState<Area[]>(mockAreas);
  const [tables, setTables] = useState<Table[]>(mockTables);
  const [settings, setSettings] = useState<RestaurantSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from storage on mount
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const [remoteUsers, remoteAreas, remoteTables, remoteSettings] = await Promise.all([
          apiRequest<Record<string, unknown>[]>('/api/users').catch(() => null),
          apiRequest<Record<string, unknown>[]>('/api/areas').catch(() => null),
          apiRequest<Record<string, unknown>[]>('/api/tables').catch(() => null),
          apiRequest<Record<string, unknown>>('/api/settings').catch(() => null),
        ]);

        if (remoteUsers) {
          setUsers(remoteUsers.map(mapUser));
        } else {
          const storedUsers = await storage.getUsers<User[]>();
          if (storedUsers && storedUsers.length > 0) {
            setUsers(storedUsers.map(user => ({ ...user, createdAt: new Date(user.createdAt) })));
          }
        }

        if (remoteAreas) {
          const mappedAreas: Area[] = remoteAreas.map((area) => ({
            id: String(area.id),
            name: String(area.name || ''),
          }));
          setAreas(mappedAreas);
        } else {
          const storedAreas = await storage.getAreas<Area[]>();
          if (storedAreas) {
            setAreas(storedAreas);
          }
        }

        if (remoteTables) {
          setTables(remoteTables.map(mapTable));
        } else {
          const storedTables = await storage.getTables<Table[]>();
          if (storedTables) {
            setTables(storedTables);
          }
        }

        if (remoteSettings) {
          setSettings(mapSettings(remoteSettings));
        } else {
          const storedSettings = await storage.getRestaurantSettings<RestaurantSettings>();
          if (storedSettings) {
            setSettings(storedSettings);
          }
        }
      } catch (error) {
        console.error('Error loading stored settings data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredData();
  }, []);

  // Persist on change
  useEffect(() => {
    if (!isLoading) {
      storage.saveUsers(users);
    }
  }, [users, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      storage.saveAreas(areas);
    }
  }, [areas, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      storage.saveTables(tables);
    }
  }, [tables, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      storage.saveRestaurantSettings(settings);
    }
  }, [settings, isLoading]);

  // User management
  const addUser = useCallback((user: Omit<User, 'id' | 'createdAt'>) => {
    (async () => {
      try {
        const created = await apiRequest<Record<string, unknown>>('/api/users', {
          method: 'POST',
          body: JSON.stringify(user),
        });
        setUsers(prev => [...prev, mapUser(created)]);
      } catch {
        const newUser: User = {
          ...user,
          id: crypto.randomUUID(),
          createdAt: new Date(),
        };
        setUsers(prev => [...prev, newUser]);
      }
    })();
  }, []);

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(user => user.id === id ? { ...user, ...updates } : user));
    apiRequest(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }).catch(() => {});
  }, []);

  const deleteUser = useCallback((id: string) => {
    setUsers(prev => prev.filter(user => user.id !== id));
    apiRequest(`/api/users/${id}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  // Area management
  const addArea = useCallback((area: Omit<Area, 'id'>) => {
    (async () => {
      try {
        const created = await apiRequest<Record<string, unknown>>('/api/areas', {
          method: 'POST',
          body: JSON.stringify(area),
        });
        setAreas(prev => [...prev, { id: String(created.id), name: String(created.name || '') }]);
      } catch {
        const newArea: Area = {
          ...area,
          id: crypto.randomUUID(),
        };
        setAreas(prev => [...prev, newArea]);
      }
    })();
  }, []);

  const updateArea = useCallback((id: string, updates: Partial<Area>) => {
    setAreas(prev => prev.map(area => area.id === id ? { ...area, ...updates } : area));
    apiRequest(`/api/areas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }).catch(() => {});
  }, []);

  const deleteArea = useCallback((id: string) => {
    setAreas(prev => prev.filter(area => area.id !== id));
    apiRequest(`/api/areas/${id}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  // Table management
  const addTable = useCallback((table: Omit<Table, 'id'>) => {
    (async () => {
      try {
        const created = await apiRequest<Record<string, unknown>>('/api/tables', {
          method: 'POST',
          body: JSON.stringify(table),
        });
        setTables(prev => [...prev, mapTable(created)]);
      } catch {
        const newTable: Table = {
          ...table,
          id: crypto.randomUUID(),
        };
        setTables(prev => [...prev, newTable]);
      }
    })();
  }, []);

  const updateTable = useCallback((id: string, updates: Partial<Table>) => {
    setTables(prev => prev.map(table => table.id === id ? { ...table, ...updates } : table));
    apiRequest(`/api/tables/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }).catch(() => {});
  }, []);

  const deleteTable = useCallback((id: string) => {
    setTables(prev => prev.filter(table => table.id !== id));
    apiRequest(`/api/tables/${id}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  // Settings
  const updateSettings = useCallback((updates: Partial<RestaurantSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
    apiRequest('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }).catch(() => {});
  }, []);

  return (
    <SettingsContext.Provider value={{
      users,
      areas,
      tables,
      settings,
      isLoading,
      addUser,
      updateUser,
      deleteUser,
      addArea,
      updateArea,
      deleteArea,
      addTable,
      updateTable,
      deleteTable,
      updateSettings,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
