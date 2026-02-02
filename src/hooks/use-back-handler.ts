import { useEffect, useRef } from 'react';
import { useBackButton } from '@/contexts/BackButtonContext';

export function useBackHandler(
  id: string,
  isActive: boolean,
  handler: () => void,
  priority: number,
) {
  const { registerBackAction, unregisterBackAction } = useBackButton();
  const handlerRef = useRef(handler);

  // Keep handler ref current without re-registering
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (isActive) {
      registerBackAction(id, () => handlerRef.current(), priority);
    } else {
      unregisterBackAction(id);
    }
    return () => {
      unregisterBackAction(id);
    };
  }, [id, isActive, priority, registerBackAction, unregisterBackAction]);
}
