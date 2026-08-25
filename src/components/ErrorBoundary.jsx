import { Component } from "react";
import { useErrorContext } from "../context/ErrorContext";

class ErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    this.props.onError?.(error, errorInfo);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function AppErrorBoundary({ children }) {
  const { reportError } = useErrorContext();
  return <ErrorBoundary onError={reportError}>{children}</ErrorBoundary>;
}