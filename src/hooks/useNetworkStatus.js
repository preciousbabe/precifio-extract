import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasGoodConnection, setHasGoodConnection] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setHasGoodConnection(false);
    };

    // Check connection quality by pinging a small resource
    const checkConnection = async () => {
      if (!navigator.onLine) {
        setHasGoodConnection(false);
        return;
      }

      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        await fetch('https://www.google.com/favicon.ico', {
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal
        });

        clearTimeout(timeout);
        const latency = Date.now() - start;

        // If latency > 3s or fetch fails, mark as bad
        setHasGoodConnection(latency < 3000);
      } catch {
        setHasGoodConnection(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check every 15 seconds
    const interval = setInterval(checkConnection, 15000);
    checkConnection(); // Initial check

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return { isOnline, hasGoodConnection, isBad: !isOnline || !hasGoodConnection };
}