import { useErrorContext } from "../context/ErrorContext";

export function ErrorModal() {
  const { currentError, isOpen, dismissError } = useErrorContext();
  if (!isOpen || !currentError) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
        </div>
        <p className="mb-6 text-gray-600">{currentError.message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={dismissError} className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
            Dismiss
          </button>
          <button onClick={() => window.location.reload()} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}