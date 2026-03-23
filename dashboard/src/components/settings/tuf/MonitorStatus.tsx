import React from 'react';
import { StepStatus, TaskData } from './types';
import { getStatusColor, getStatusIcon, getTaskStateColor } from './utils';

interface MonitorStatusProps {
  selectedApp: string;
  step3Status: StepStatus;
  bootstrapStatus: TaskData | null;
  bootstrapTaskId: string;
  tufTasks: TaskData[];
  onCheckBootstrapStatus: () => void;
  onCheckTufTasks: () => void;
}

export const MonitorStatus: React.FC<MonitorStatusProps> = ({
  selectedApp,
  step3Status,
  bootstrapStatus,
  // bootstrapTaskId,
  tufTasks,
  onCheckBootstrapStatus,
  // onCheckTufTasks,
}) => {
  if (!selectedApp) {
    return null;
  }

  return (
    <div className="bg-card p-6 rounded-lg border border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground font-roboto">
          Monitor Status
        </h2>
        <div className={`flex items-center ${getStatusColor(step3Status)}`}>
          <i className={`fas ${getStatusIcon(step3Status)} mr-2`}></i>
          <span className="text-sm capitalize">{step3Status.replace('-', ' ')}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={onCheckBootstrapStatus}
            disabled={!selectedApp}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-roboto hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-sync mr-2"></i>
            Check Bootstrap Status
          </button>
          {/* <button
            onClick={onCheckTufTasks}
            disabled={!bootstrapTaskId && !bootstrapStatus?.task_id}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-roboto hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-tasks mr-2"></i>
            Check TUF Task
          </button> */}
        </div>

        {bootstrapStatus ? (
          <div className="p-4 bg-muted rounded-lg border border-border">
            <h3 className="text-foreground font-semibold mb-2">Bootstrap Status</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-foreground opacity-70">Task ID: </span>
                <span className="text-foreground font-mono">{bootstrapStatus.task_id}</span>
              </div>
              <div>
                <span className="text-foreground opacity-70">State: </span>
                <span className={getTaskStateColor(bootstrapStatus.state)}>
                  {bootstrapStatus.state}
                </span>
              </div>
              {bootstrapStatus.result && (
                <>
                  <div className="text-foreground">{bootstrapStatus.result.message}</div>
                  {bootstrapStatus.result.last_update && (
                    <div>
                      <span className="text-foreground opacity-70">Last Update: </span>
                      <span className="text-foreground">
                        {new Date(bootstrapStatus.result.last_update).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {bootstrapStatus.result.error && (
                    <div className="text-red-500">{bootstrapStatus.result.error}</div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-muted rounded-lg border border-border">
            <h3 className="text-foreground font-semibold mb-2">Bootstrap Status</h3>
            <div className="text-sm text-foreground opacity-70">
              <i className="fas fa-info-circle mr-2"></i>
              Bootstrap has not been started yet. System is available for bootstrap.
            </div>
          </div>
        )}

        {tufTasks.length > 0 && (
          <div className="p-4 bg-muted rounded-lg border border-border">
            <h3 className="text-foreground font-semibold mb-2">TUF Tasks</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-foreground">Task ID</th>
                    <th className="text-left py-2 px-2 text-foreground">State</th>
                    <th className="text-left py-2 px-2 text-foreground">Message</th>
                    <th className="text-left py-2 px-2 text-foreground">Last Update</th>
                  </tr>
                </thead>
                <tbody>
                  {tufTasks.map((task) => (
                    <tr key={task.task_id} className="border-b border-border">
                      <td className="py-2 px-2 text-foreground font-mono text-xs">
                        {task.task_id}
                      </td>
                      <td className="py-2 px-2">
                        <span className={getTaskStateColor(task.state)}>
                          {task.state}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-foreground">
                        {task.state === 'FAILURE' && task.result?.error
                          ? task.result.error
                          : task.result?.message || '-'}
                      </td>
                      <td className="py-2 px-2 text-foreground text-xs">
                        {task.result?.last_update
                          ? new Date(task.result.last_update).toLocaleString()
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
