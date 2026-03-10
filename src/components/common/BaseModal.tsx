import React, { useState } from "react";

interface BaseModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  isLoading?: boolean;
  isSuccess?: boolean;
  successMessage?: string;
  error?: { error: string; details?: string } | null;
  setError?: (error: { error: string; details?: string } | null) => void;
  className?: string;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  title,
  onClose,
  children,
  isLoading = false,
  isSuccess = false,
  successMessage = "Operation completed successfully!",
  error = null,
  setError,
  className = "",
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  return (
    <>
      {isLoading && (
        <div className="fixed top-4 right-4 bg-primary text-primary-foreground px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-[10001]">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-foreground border-t-transparent" />
          <span>Processing...</span>
        </div>
      )}
      {isSuccess && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-[10001]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="fixed top-4 right-4 bg-destructive text-destructive-foreground px-6 py-3 rounded-lg shadow-lg z-[10001]">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Error: {error.error}</span>
            {error.details && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-destructive-foreground hover:opacity-80"
              >
                <svg
                  className={`w-4 h-4 transform transition-transform ${showDetails ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
            {setError && (
              <button onClick={() => setError(null)} className="text-destructive-foreground hover:opacity-80">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {showDetails && error.details && (
            <div className="mt-2 text-sm bg-destructive/20 p-2 rounded">{error.details}</div>
          )}
        </div>
      )}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center animate-fade-in modal-overlay-high p-4"
        onClick={handleBackdropClick}
      >
        <div
          className={`bg-card border border-border rounded-lg p-6 shadow-lg ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold leading-none tracking-tight text-card-foreground">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
};
