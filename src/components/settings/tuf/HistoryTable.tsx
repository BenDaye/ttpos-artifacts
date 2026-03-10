import React, { useState } from 'react';
import { TufHistoryEntry } from './types';

interface HistoryProps {
  selectedApp: string | null;
  history: TufHistoryEntry[];
  onCheckTask: (taskId: string) => void;
  onClearHistory: () => void;
}

export const HistoryTable: React.FC<HistoryProps> = ({
  selectedApp,
  history,
  onCheckTask,
  onClearHistory,
}) => {
  const [showHistory, setShowHistory] = useState(false);

  // Auto-open history when app is selected
  React.useEffect(() => {
    if (selectedApp) {
      setShowHistory(true);
    }
  }, [selectedApp]);

  // Show history when no app is selected (full view)
  if (!selectedApp) {
    return (
      <div className="bg-card p-6 rounded-lg border border-border">
        <h2 className="text-lg font-bold font-roboto text-foreground mb-4">History</h2>
        {history.length === 0 ? (
          <p className="text-foreground opacity-70 text-center py-4">No history yet</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-foreground">Date</th>
                    <th className="text-left py-2 px-2 text-foreground">App</th>
                    <th className="text-left py-2 px-2 text-foreground">Operation</th>
                    <th className="text-left py-2 px-2 text-foreground">Status</th>
                    <th className="text-left py-2 px-2 text-foreground">Task ID</th>
                    <th className="text-left py-2 px-2 text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id} className="border-b border-border">
                      <td className="py-2 px-2 text-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 px-2 text-foreground">{entry.appName}</td>
                      <td className="py-2 px-2 text-foreground capitalize">
                        {entry.operation}
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={
                            entry.status === 'success'
                              ? 'text-green-500'
                              : entry.status === 'pending'
                              ? 'text-yellow-500'
                              : 'text-red-500'
                          }
                        >
                          {entry.status === 'success' ? (
                            <i className="fas fa-check-circle mr-1"></i>
                          ) : entry.status === 'pending' ? (
                            <i className="fas fa-clock mr-1"></i>
                          ) : (
                            <i className="fas fa-times-circle mr-1"></i>
                          )}
                          {entry.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-foreground font-mono text-xs">
                        {entry.taskId || '-'}
                      </td>
                      <td className="py-2 px-2">
                        {entry.taskId && (entry.operation === 'bootstrap' || entry.operation === 'publish' || entry.operation === 'update-config' || entry.operation === 'root-meta-update') ? (
                          <button
                            onClick={() => onCheckTask(entry.taskId!)}
                            className="text-foreground hover:text-primary text-sm transition-colors"
                            title="Check task status"
                          >
                            <i className="fas fa-sync mr-1"></i>
                            Check
                          </button>
                        ) : (
                          <span className="text-foreground opacity-50 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={onClearHistory}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                <i className="fas fa-trash mr-2"></i>
                Clear History
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Show collapsible history when app is selected
  return (
    <div className="bg-card p-6 rounded-lg border border-border">
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="flex items-center justify-between w-full text-foreground hover:text-primary"
      >
        <h2 className="text-lg font-bold font-roboto">History</h2>
        <i className={`fas fa-chevron-${showHistory ? 'up' : 'down'}`}></i>
      </button>

      {showHistory && (
        <div className="mt-4">
          {history.length === 0 ? (
            <p className="text-foreground opacity-70 text-center py-4">No history yet</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-foreground">Date</th>
                      <th className="text-left py-2 px-2 text-foreground">App</th>
                      <th className="text-left py-2 px-2 text-foreground">Operation</th>
                      <th className="text-left py-2 px-2 text-foreground">Status</th>
                      <th className="text-left py-2 px-2 text-foreground">Task ID</th>
                      <th className="text-left py-2 px-2 text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.id} className="border-b border-border">
                        <td className="py-2 px-2 text-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-foreground">{entry.appName}</td>
                        <td className="py-2 px-2 text-foreground capitalize">
                          {entry.operation}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={
                              entry.status === 'success'
                                ? 'text-green-500'
                                : entry.status === 'pending'
                                ? 'text-yellow-500'
                                : 'text-red-500'
                            }
                          >
                            {entry.status === 'success' ? (
                              <i className="fas fa-check-circle mr-1"></i>
                            ) : entry.status === 'pending' ? (
                              <i className="fas fa-clock mr-1"></i>
                            ) : (
                              <i className="fas fa-times-circle mr-1"></i>
                            )}
                            {entry.status}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-foreground font-mono text-xs">
                          {entry.taskId || '-'}
                        </td>
                        <td className="py-2 px-2">
                          {entry.taskId && (entry.operation === 'bootstrap' || entry.operation === 'publish' || entry.operation === 'update-config' || entry.operation === 'root-meta-update') ? (
                            <button
                              onClick={() => onCheckTask(entry.taskId!)}
                              className="text-foreground hover:text-primary text-sm transition-colors"
                              title="Check task status"
                            >
                              <i className="fas fa-sync mr-1"></i>
                              Check
                            </button>
                          ) : (
                            <span className="text-foreground opacity-50 text-sm">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={onClearHistory}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                >
                  <i className="fas fa-trash mr-2"></i>
                  Clear History
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
