import React from 'react';
import { ChangelogEntry } from '../hooks/use-query/useAppsQuery';
import ReactMarkdown from 'react-markdown';

interface ChangelogModalProps {
  appName: string;
  version: string;
  changelog: ChangelogEntry[];
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({
  appName,
  version,
  changelog,
  onClose,
}) => {
  const currentVersionChangelog = changelog.find(entry => entry.Version === version);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-[11000] p-4 overflow-y-auto"
    onClick={onClose}
    >
      <div className="bg-card border border-border rounded-lg p-4 sm:p-8 w-full max-w-[800px] max-h-[calc(100vh-2rem)] flex flex-col my-auto"
      onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-4">
          Changelog for {appName} v{version}
        </h2>
        <div className="mb-4 overflow-y-auto min-h-0">
          {currentVersionChangelog ? (
            <>
              <p className="text-muted-foreground mb-2">
                Date: {new Date(currentVersionChangelog.Date).toLocaleDateString()}
              </p>
              <div className="prose prose-sm max-w-none bg-muted text-foreground rounded-lg p-4 dark:prose-invert">
                <ReactMarkdown>{currentVersionChangelog.Changes || 'No changes description'}</ReactMarkdown>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">No changelog information available for this version</p>
          )}
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="bg-secondary text-foreground px-4 py-2 rounded-lg mr-2 hover:bg-accent transition-all duration-150 border border-border"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}; 