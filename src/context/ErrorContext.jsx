import { createContext, useContext, useState, useCallback, useEffect } from "react";

const ErrorContext = createContext(null);

function sanitizeError(error) {
  return {
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    type: error?.name || "Error",
    message: error?.message || "Something went wrong",
    timestamp: new Date().toISOString(),
  };
}

export function ErrorProvider({ children }) {
  const [currentError, setCurrentError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const reportError = useCallback((error, _errorInfo) => {
    const safe = sanitizeError(error);
    setCurrentError(safe);
    setIsOpen(true);
  }, []);

  const dismissError = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => setCurrentError(null), 300);
  }, []);

  useEffect(() => {
    const onError = (event) => {
      event.preventDefault();
      reportError(event.error || new Error(event.message));
      return true;
    };
    const onRejection = (event) => {
      event.preventDefault();
      const err = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      reportError(err);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [reportError]);

  return (
    <ErrorContext.Provider value={{ currentError, isOpen, reportError, dismissError }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useErrorContext() {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error("useErrorContext must be used inside ErrorProvider");
  return ctx;
}