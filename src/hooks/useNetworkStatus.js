// src/hooks/useNetworkStatus.js

import { useState, useEffect, useCallback } from "react";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasGoodConnection, setHasGoodConnection] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  const checkConnection = useCallback(async () => {
    if (!navigator.onLine) {
      setHasGoodConnection(false);
      return;
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      await fetch("https://www.google.com/favicon.ico", {
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal
      });

      clearTimeout(timeout);
      const latency = Date.now() - start;
      setHasGoodConnection(latency < 3000);
    } catch {
      setHasGoodConnection(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Recheck connection quality when coming back online
      setTimeout(checkConnection, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setHasGoodConnection(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = setInterval(checkConnection, 15000);
    checkConnection();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [checkConnection]);

  const dismissOfflineWarning = useCallback(() => {
    setWasOffline(false);
  }, []);

  return {
    isOnline,
    hasGoodConnection,
    isBad: !isOnline || !hasGoodConnection,
    wasOffline,
    dismissOfflineWarning
  };
}