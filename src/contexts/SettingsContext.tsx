import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Area, Table, RestaurantSettings } from '@/types';
import { mockUsers, mockAreas, mockTables, defaultSettings } from '@/data/mockData';
import { storage } from '@/lib/storage';

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
        const [
          storedUsers,
          storedAreas,
          storedTables,
          storedSettings,
        ] = await Promise.all([
          storage.getUsers<User[]>(),
          storage.getAreas<Area[]>(),
          storage.getTables<Table[]>(),
          storage.getRestaurantSettings<RestaurantSettings>(),
        ]);

        if (storedUsers && storedUsers.length > 0) {
          const usersWithDates = storedUsers.map(user => ({
            ...user,
            createdAt: new Date(user.createdAt),
          }));
          setUsers(usersWithDates);
        }
        if (storedAreas) {
          setAreas(storedAreas);
        }
        if (storedTables) {
          setTables(storedTables);
        }
        if (storedSettings) {
          setSettings(storedSettings);
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
    const newUser: User = {
      ...user,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    setUsers(prev => [...prev, newUser]);
  }, []);

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(user =>
      user.id === id ? { ...user, ...updates } : user
    ));
  }, []);

  const deleteUser = useCallback((id: string) => {
    setUsers(prev => prev.filter(user => user.id !== id));
  }, []);

  // Area management
  const addArea = useCallback((area: Omit<Area, 'id'>) => {
    const newArea: Area = {
      ...area,
      id: crypto.randomUUID(),
    };
    setAreas(prev => [...prev, newArea]);
  }, []);

  const updateArea = useCallback((id: string, updates: Partial<Area>) => {
    setAreas(prev => prev.map(area =>
      area.id === id ? { ...area, ...updates } : area
    ));
  }, []);

  const deleteArea = useCallback((id: string) => {
    setAreas(prev => prev.filter(area => area.id !== id));
  }, []);

  // Table management
  const addTable = useCallback((table: Omit<Table, 'id'>) => {
    const newTable: Table = {
      ...table,
      id: crypto.randomUUID(),
    };
    setTables(prev => [...prev, newTable]);
  }, []);

  const updateTable = useCallback((id: string, updates: Partial<Table>) => {
    setTables(prev => prev.map(table =>
      table.id === id ? { ...table, ...updates } : table
    ));
  }, []);

  const deleteTable = useCallback((id: string) => {
    setTables(prev => prev.filter(table => table.id !== id));
  }, []);

  // Settings
  const updateSettings = useCallback((updates: Partial<RestaurantSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
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
