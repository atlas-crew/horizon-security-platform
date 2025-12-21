/**
 * Threat Hunting Page
 * Query builder, filters, results table, saved queries
 */

import { useState, useEffect, useCallback } from 'react';
import { Database, AlertCircle } from 'lucide-react';
import { HuntQueryBuilder, HuntResultsTable, SavedQueries } from '../components/hunting';
import { useHunt, type HuntQuery, type HuntResult, type SavedQuery } from '../hooks/useHunt';

export default function HuntingPage() {
  const {
    isLoading,
    error,
    status,
    getStatus,
    queryTimeline,
    getSavedQueries,
    saveQuery,
    runSavedQuery,
    deleteSavedQuery,
    clearError,
  } = useHunt();

  const [result, setResult] = useState<HuntResult | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [queryToSave, setQueryToSave] = useState<HuntQuery | null>(null);

  // Fetch status and saved queries on mount
  useEffect(() => {
    getStatus().catch(() => {});
    loadSavedQueries();
  }, [getStatus]);

  const loadSavedQueries = useCallback(async () => {
    try {
      const queries = await getSavedQueries();
      setSavedQueries(queries);
    } catch {
      // Ignore error - saved queries are optional
    }
  }, [getSavedQueries]);

  const handleQuery = async (query: HuntQuery) => {
    clearError();
    try {
      const huntResult = await queryTimeline(query);
      setResult(huntResult);
    } catch {
      setResult(null);
    }
  };

  const handleSaveQuery = (query: HuntQuery) => {
    setQueryToSave(query);
    setSaveModalOpen(true);
  };

  const confirmSaveQuery = async (name: string, description?: string) => {
    if (!queryToSave) return;

    try {
      await saveQuery(name, queryToSave, description);
      setSaveModalOpen(false);
      setQueryToSave(null);
      await loadSavedQueries();
    } catch {
      // Error is displayed via the error state
    }
  };

  const handleRunSavedQuery = async (id: string) => {
    clearError();
    try {
      const huntResult = await runSavedQuery(id);
      setResult(huntResult);
      await loadSavedQueries(); // Refresh to update lastRunAt
    } catch {
      setResult(null);
    }
  };

  const handleDeleteSavedQuery = async (id: string) => {
    try {
      await deleteSavedQuery(id);
      await loadSavedQueries();
    } catch {
      // Error is displayed via the error state
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Threat Hunting</h1>
          <p className="text-gray-400 mt-1">
            Search and analyze threats across the fleet
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
          <Database className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-400">
            {status?.historical ? 'Historical queries enabled' : 'Real-time only'}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              status?.historical ? 'bg-green-500' : 'bg-yellow-500'
            }`}
          />
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
          <button
            onClick={clearError}
            className="ml-auto text-sm text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Query Builder */}
      <HuntQueryBuilder
        onQuery={handleQuery}
        onSave={handleSaveQuery}
        isLoading={isLoading}
        historicalEnabled={status?.historical ?? false}
      />

      <div className="grid grid-cols-4 gap-6">
        {/* Results */}
        <div className="col-span-3">
          <HuntResultsTable result={result} isLoading={isLoading} />
        </div>

        {/* Saved Queries */}
        <div>
          <SavedQueries
            queries={savedQueries}
            onRun={handleRunSavedQuery}
            onDelete={handleDeleteSavedQuery}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Save Query Modal */}
      {saveModalOpen && (
        <SaveQueryModal
          onSave={confirmSaveQuery}
          onCancel={() => {
            setSaveModalOpen(false);
            setQueryToSave(null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Save Query Modal
// =============================================================================

interface SaveQueryModalProps {
  onSave: (name: string, description?: string) => void;
  onCancel: () => void;
}

function SaveQueryModal({ onSave, onCancel }: SaveQueryModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), description.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-white mb-4">Save Query</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My saved query"
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-horizon-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-horizon-500 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="btn-primary"
            >
              Save Query
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
