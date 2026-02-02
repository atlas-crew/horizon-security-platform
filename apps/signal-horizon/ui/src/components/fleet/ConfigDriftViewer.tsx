import { useState } from 'react';
import { AlertTriangle, CheckCircle, ArrowRight, GitCommit } from 'lucide-react';
import { clsx } from 'clsx';
import { CodeEditor } from '../ctrlx/CodeEditor';

interface ConfigDriftViewerProps {
  expectedConfig: string;
  actualConfig: string;
  lastSync?: string;
  driftDetected?: boolean;
}

export function ConfigDriftViewer({ 
  expectedConfig, 
  actualConfig, 
  lastSync,
  driftDetected = true 
}: ConfigDriftViewerProps) {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');

  return (
    <div className="space-y-4">
      {/* Drift Status Banner */}
      <div className={clsx(
        "p-4 border rounded-sm flex items-center justify-between",
        driftDetected 
          ? "bg-ac-orange/10 border-ac-orange/30 text-ac-orange" 
          : "bg-ac-green/10 border-ac-green/30 text-ac-green"
      )}>
        <div className="flex items-center gap-3">
          {driftDetected ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <div>
            <h3 className="font-medium text-sm">
              {driftDetected ? "Configuration Drift Detected" : "Configuration Synced"}
            </h3>
            {lastSync && (
              <p className="text-xs opacity-80 mt-0.5">Last check: {lastSync}</p>
            )}
          </div>
        </div>
        
        {driftDetected && (
          <button className="px-3 py-1.5 bg-surface-base border border-ac-orange/30 text-ink-primary text-xs font-medium rounded-sm hover:bg-surface-subtle transition-colors">
            Force Sync
          </button>
        )}
      </div>

      {/* Editor Controls */}
      <div className="flex justify-end">
        <div className="flex bg-surface-subtle p-1 rounded-sm border border-border-subtle">
          <button
            onClick={() => setViewMode('split')}
            className={clsx(
              "px-3 py-1 text-xs font-medium rounded-sm transition-colors",
              viewMode === 'split' ? "bg-surface-base shadow-sm text-ink-primary" : "text-ink-secondary hover:text-ink-primary"
            )}
          >
            Split View
          </button>
          <button
            onClick={() => setViewMode('unified')}
            className={clsx(
              "px-3 py-1 text-xs font-medium rounded-sm transition-colors",
              viewMode === 'unified' ? "bg-surface-base shadow-sm text-ink-primary" : "text-ink-secondary hover:text-ink-primary"
            )}
          >
            Unified
          </button>
        </div>
      </div>

      {/* Diff View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[500px]">
        {/* Expected Config */}
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-semibold text-ink-secondary uppercase tracking-wider flex items-center gap-2">
              <GitCommit className="w-3 h-3" />
              Expected (Template)
            </span>
          </div>
          <div className="flex-1 border border-border-subtle rounded-sm overflow-hidden">
            <CodeEditor
              value={expectedConfig}
              onChange={() => {}}
              language="json"
              readOnly={true}
              height="100%"
              className="h-full border-0"
            />
          </div>
        </div>

        {/* Actual Config */}
        {viewMode === 'split' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-ink-secondary uppercase tracking-wider flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-ac-orange" />
                Actual (Sensor)
              </span>
            </div>
            <div className={clsx(
              "flex-1 border rounded-sm overflow-hidden",
              driftDetected ? "border-ac-orange/50" : "border-border-subtle"
            )}>
              <CodeEditor
                value={actualConfig}
                onChange={() => {}}
                language="json"
                readOnly={true}
                height="100%"
                className="h-full border-0"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
