import React, { useState } from 'react';
import axiosInstance from '../config/axios';
import { AxiosError } from 'axios';
import { BaseModal } from './common/BaseModal';

interface EditAppModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  appData: {
    id: string;
    app: string;
    description: string;
    logo?: string;
    tuf?: boolean;
  };
}

interface ErrorResponse {
  error: string;
  details?: string;
}

export const EditAppModal: React.FC<EditAppModalProps> = ({ onClose, onSuccess, appData }) => {
  const [formData, setFormData] = useState({
    app: appData.app,
    description: appData.description,
    file: null as File | null,
    tuf: appData.tuf || false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<{ error: string; details?: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        file,
      }));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formDataToSend = new FormData();
      const data = {
        id: appData.id,
        app: formData.app,
        description: formData.description,
        tuf: formData.tuf ? "true" : "false",
      };
      
      formDataToSend.append('data', JSON.stringify(data));
      
      if (formData.file) {
        formDataToSend.append('file', formData.file);
      }

      await axiosInstance.post('/app/update', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setIsSuccess(true);
      if (onSuccess) {
        onSuccess();
      }
      onClose();

    } catch (err) {
      const axiosError = err as AxiosError<ErrorResponse>;
      if (axiosError.response?.data) {
        setError({
          error: axiosError.response.data.error || 'Failed to update application',
          details: axiosError.response.data.details
        });
      } else {
        setError({
          error: 'Failed to update application',
          details: axiosError.message
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <BaseModal
      title="Edit Application"
      onClose={onClose}
      isLoading={isLoading}
      isSuccess={isSuccess}
      successMessage="Application updated successfully!"
      error={error}
      setError={setError}
      className="w-[500px] max-h-[80vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-foreground mb-2 font-roboto font-semibold">App Name</label>
          <input
            type="text"
            value={formData.app}
            onChange={(e) => setFormData(prev => ({ ...prev, app: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg font-roboto bg-muted text-foreground border border-border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground shadow-sm"
            required
            placeholder="Enter app name"
          />
        </div>

        <div>
          <label className="block text-foreground mb-2 font-roboto font-semibold">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg font-roboto bg-muted text-foreground border border-border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground shadow-sm"
            rows={4}
            placeholder="Enter app description"
          />
        </div>

        <div className="mb-6 flex items-start">
          <input
            type="checkbox"
            id="tuf"
            checked={formData.tuf}
            onChange={(e) => setFormData(prev => ({ ...prev, tuf: e.target.checked }))}
            className="mt-1 mr-3 accent-primary w-5 h-5 border border-border rounded transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring bg-muted shadow-sm"
          />
          <label htmlFor="tuf" className="text-foreground font-roboto cursor-pointer select-none">
            <div className="font-semibold">Enable tuf</div>
            <div className="text-sm text-muted-foreground">Enable TUF (The Update Framework) for this application</div>
          </label>
        </div>

        <div>
          <label className="block text-foreground mb-2 font-roboto font-semibold">Logo</label>
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
              accept="image/*"
            />
            <label
              htmlFor="file-upload"
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg cursor-pointer hover:bg-muted transition-colors duration-200 flex items-center justify-center font-roboto"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Choose Logo
            </label>
          </div>
          {formData.file && (
            <div className="mt-4 flex items-center justify-between bg-muted bg-opacity-50 p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <div className="text-foreground font-roboto">{formData.file.name}</div>
                  <div className="text-muted-foreground text-sm font-roboto">{formatFileSize(formData.file.size)}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, file: null }))}
                className="text-foreground hover:text-red-300 transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="bg-secondary text-foreground px-4 py-2 rounded-lg font-roboto hover:bg-accent transition-all duration-150 border border-border shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-roboto hover:bg-primary/90 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-foreground mr-2"></div>
                Updating...
              </>
            ) : (
              'Update'
            )}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}; 