import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { Network } from '@capacitor/network';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    // Check initial status
    const checkStatus = async () => {
      try {
        const status = await Network.getStatus();
        setIsOnline(status.connected);
        // Show indicator briefly when coming online
        if (status.connected) {
          setShowIndicator(true);
          setTimeout(() => setShowIndicator(false), 3000);
        }
      } catch (e) {
        // Fallback for web browser
        setIsOnline(navigator.onLine);
      }
    };

    checkStatus();

    // Listen for changes
    const listener = Network.addListener('networkStatusChange', (status) => {
      setIsOnline(status.connected);
      setShowIndicator(true);

      // Hide "online" indicator after 3 seconds
      if (status.connected) {
        setTimeout(() => setShowIndicator(false), 3000);
      }
    });

    // Web fallback listeners
    const handleOnline = () => {
      setIsOnline(true);
      setShowIndicator(true);
      setTimeout(() => setShowIndicator(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      listener.then(l => l.remove());
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Always show when offline, briefly show when online
  if (isOnline && !showIndicator) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-all duration-300 ${
        isOnline
          ? 'bg-success text-success-foreground'
          : 'bg-destructive text-destructive-foreground'
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4" />
          <span>Back online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 animate-pulse" />
          <span>No internet - Data will sync when connected</span>
        </>
      )}
    </div>
  );
}
