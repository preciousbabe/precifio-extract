import { useErrorContext } from "../context/ErrorContext";

export function useError() {
  const { reportError, dismissError } = useErrorContext();
  return { reportError, dismissError };
}