import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { App } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { L } from '@/lib/labels';

interface BackAction {
  handler: () => void;
  priority: number;
}

interface BackButtonContextType {
  registerBackAction: (id: string, handler: () => void, priority: number) => void;
  unregisterBackAction: (id: string) => void;
}

const BackButtonContext = createContext<BackButtonContextType | null>(null);

export function BackButtonProvider({ children }: { children: React.ReactNode }) {
  const actionsRef = useRef(new Map<string, BackAction>());
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const lastBackPressRef = useRef(0);

  const registerBackAction = useCallback((id: string, handler: () => void, priority: number) => {
    actionsRef.current.set(id, { handler, priority });
  }, []);

  const unregisterBackAction = useCallback((id: string) => {
    actionsRef.current.delete(id);
  }, []);

  useEffect(() => {
    const listener = App.addListener('backButton', () => {
      const actions = actionsRef.current;

      // Find highest-priority action
      let highest: BackAction | null = null;
      for (const action of actions.values()) {
        if (!highest || action.priority > highest.priority) {
          highest = action;
        }
      }

      if (highest) {
        highest.handler();
        return;
      }

      // Fallback: no actions registered
      if (location.pathname !== '/pos') {
        navigate('/pos');
      } else {
        // Double-back-to-exit
        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          App.exitApp();
        } else {
          lastBackPressRef.current = now;
          toast({ title: L.backExitHint });
        }
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [navigate, location.pathname, toast]);

  return (
    <BackButtonContext.Provider value={{ registerBackAction, unregisterBackAction }}>
      {children}
    </BackButtonContext.Provider>
  );
}

export function useBackButton() {
  const ctx = useContext(BackButtonContext);
  if (!ctx) throw new Error('useBackButton must be used within BackButtonProvider');
  return ctx;
}
