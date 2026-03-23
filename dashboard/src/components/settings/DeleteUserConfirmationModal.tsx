import React, { useState } from 'react';

interface DeleteUserConfirmationModalProps {
  userId: string;
  username: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const DeleteUserConfirmationModal: React.FC<DeleteUserConfirmationModalProps> = ({
  username,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  const handleConfirm = async () => {
    if (confirmationText !== username) return;
    
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {error && (
        <div className="fixed top-4 right-4 bg-red-500 text-foreground px-6 py-3 rounded-lg shadow-lg z-[60] animate-fade-in">
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-roboto">Error: {error}</span>
            {error && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="ml-2 text-foreground"
              >
                <svg
                  className={`w-4 h-4 transform transition-transform ${showDetails ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
          {showDetails && error && (
            <div className="mt-2 text-sm bg-red-600 p-2 rounded">
              {error}
            </div>
          )}
        </div>
      )}
      <div 
        className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center animate-fade-in modal-overlay-high z-[10000] overflow-y-auto min-h-screen p-4'
        onClick={handleBackdropClick}
      >
        <div className='bg-card border border-border p-8 rounded-lg w-full max-w-md max-h-[90vh]'>
          <h2 className='text-2xl font-bold mb-4 text-foreground font-roboto'>
            Delete User Confirmation
          </h2>
          <p className='text-foreground mb-4 font-semibold'>
            To delete user "{username}" please enter their username:
          </p>
          <div className='mb-4'>
            <input
              type='text'
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              className='w-full px-4 py-2 rounded-lg font-roboto bg-muted text-foreground border border-border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground shadow-sm'
              placeholder='Enter username'
            />
          </div>
          <div className='flex justify-end'>
            <button
              type='button'
              onClick={onClose}
              className='bg-secondary text-foreground px-4 py-2 rounded-lg font-roboto hover:bg-accent transition-all duration-150 mr-2 border border-border shadow-sm'>
              Cancel
            </button>
            <button
              type='button'
              onClick={handleConfirm}
              disabled={confirmationText !== username || isDeleting}
              className='bg-red-600 text-foreground px-4 py-2 rounded-lg font-roboto hover:bg-red-700 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ml-2 shadow-sm'>
              {isDeleting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}; 