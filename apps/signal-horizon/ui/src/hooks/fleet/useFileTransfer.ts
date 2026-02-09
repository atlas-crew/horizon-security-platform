/**
 * useFileTransfer Hook
 *
 * Manages file system operations for remote sensors including directory listing,
 * file downloads with progress tracking, and checksum verification.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3100';
const API_KEY = import.meta.env.VITE_API_KEY || import.meta.env.VITE_HORIZON_API_KEY || 'dev-dashboard-key';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * File system entry information
 */
export interface FileInfo {
  /** Full path to the file or directory */
  path: string;
  /** File or directory name */
  name: string;
  /** File size in bytes (0 for directories) */
  size: number;
  /** Last modified timestamp (ISO string) */
  modified: string;
  /** Whether this is a directory */
  isDir: boolean;
  /** File checksum (optional, for files only) */
  checksum?: string;
  /** File permissions (optional) */
  permissions?: string;
}

/**
 * Download progress tracking
 */
export interface DownloadProgress {
  /** File path being downloaded */
  path: string;
  /** Total file size in bytes */
  totalSize: number;
  /** Bytes downloaded so far */
  downloadedSize: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current download speed in bytes/sec */
  speed: number;
  /** Estimated time remaining in seconds */
  eta: number;
  /** Current status */
  status: 'pending' | 'downloading' | 'verifying' | 'complete' | 'error' | 'cancelled';
  /** Error message if status is 'error' */
  error?: string;
  /** Downloaded blob (only when complete) */
  blob?: Blob;
  /** Verified checksum (only when complete) */
  verifiedChecksum?: string;
}

/**
 * Options for the useFileTransfer hook
 */
export interface UseFileTransferOptions {
  /** Target sensor ID */
  sensorId: string;
  /** Initial path to display (default: '/') */
  initialPath?: string;
  /** Callback when download completes */
  onDownloadComplete?: (path: string, blob: Blob) => void;
  /** Callback when download fails */
  onDownloadError?: (path: string, error: Error) => void;
}

/**
 * Return type for the useFileTransfer hook
 */
export interface UseFileTransferResult {
  // Directory listing
  /** Current directory path */
  currentPath: string;
  /** Files and directories in current path */
  files: FileInfo[];
  /** Whether files are loading */
  isLoadingFiles: boolean;
  /** Error from listing operation */
  filesError: Error | null;

  // Navigation
  /** Navigate to a specific path */
  navigateTo: (path: string) => void;
  /** Navigate to parent directory */
  navigateUp: () => void;
  /** Refresh current directory */
  refresh: () => void;

  // Downloads
  /** Map of active downloads by path */
  downloads: Map<string, DownloadProgress>;
  /** Start downloading a file */
  downloadFile: (path: string) => void;
  /** Cancel an active download */
  cancelDownload: (path: string) => void;
  /** Clear completed/failed downloads */
  clearCompletedDownloads: () => void;

  // File info
  /** Get detailed file info (including checksum) */
  getFileInfo: (path: string) => Promise<FileInfo>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build authorization headers for API requests
 */
function getAuthHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Normalize a path (ensure leading slash, remove trailing slash unless root)
 */
function normalizePath(path: string): string {
  let normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized !== '/' && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Get parent directory path
 */
function getParentPath(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === '/') return '/';
  const parts = normalized.split('/').filter(Boolean);
  parts.pop();
  return parts.length === 0 ? '/' : `/${parts.join('/')}`;
}

/**
 * Calculate download speed from samples
 */
function calculateSpeed(samples: { time: number; bytes: number }[]): number {
  if (samples.length < 2) return 0;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const timeDiff = (last.time - first.time) / 1000; // seconds
  const bytesDiff = last.bytes - first.bytes;
  return timeDiff > 0 ? bytesDiff / timeDiff : 0;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useFileTransfer(options: UseFileTransferOptions): UseFileTransferResult {
  const { sensorId, initialPath = '/', onDownloadComplete, onDownloadError } = options;

  // State
  const [currentPath, setCurrentPath] = useState(normalizePath(initialPath));
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState<Error | null>(null);
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(new Map());

  // Refs
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const isMountedRef = useRef(true);

  // =============================================================================
  // Directory Listing
  // =============================================================================

  /**
   * Fetch directory contents from API
   */
  const fetchDirectory = useCallback(
    async (path: string): Promise<FileInfo[]> => {
      const response = await fetch(
        `${API_URL}/api/v1/fleet/sensors/${sensorId}/files?path=${encodeURIComponent(path)}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to list directory: ${response.status}`);
      }

      const data = await response.json();
      return (data.files || []).map(
        (file: {
          path: string;
          name: string;
          size: number;
          modified: string;
          isDir: boolean;
          checksum?: string;
          permissions?: string;
        }) => ({
          path: file.path,
          name: file.name,
          size: file.size,
          modified: file.modified,
          isDir: file.isDir,
          checksum: file.checksum,
          permissions: file.permissions,
        })
      );
    },
    [sensorId]
  );

  /**
   * Navigate to a specific directory path
   */
  const navigateTo = useCallback(
    async (path: string) => {
      const normalized = normalizePath(path);
      setCurrentPath(normalized);
      setIsLoadingFiles(true);
      setFilesError(null);

      try {
        const fileList = await fetchDirectory(normalized);
        if (isMountedRef.current) {
          // Sort: directories first, then by name
          const sorted = [...fileList].sort((a, b) => {
            if (a.isDir && !b.isDir) return -1;
            if (!a.isDir && b.isDir) return 1;
            return a.name.localeCompare(b.name);
          });
          setFiles(sorted);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setFilesError(err instanceof Error ? err : new Error('Failed to list directory'));
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoadingFiles(false);
        }
      }
    },
    [fetchDirectory]
  );

  /**
   * Navigate to parent directory
   */
  const navigateUp = useCallback(() => {
    const parentPath = getParentPath(currentPath);
    if (parentPath !== currentPath) {
      navigateTo(parentPath);
    }
  }, [currentPath, navigateTo]);

  /**
   * Refresh current directory
   */
  const refresh = useCallback(() => {
    navigateTo(currentPath);
  }, [currentPath, navigateTo]);

  // =============================================================================
  // File Downloads
  // =============================================================================

  /**
   * Update download progress state
   */
  const updateDownload = useCallback((path: string, updates: Partial<DownloadProgress>) => {
    setDownloads((prev) => {
      const next = new Map(prev);
      const current = next.get(path);
      if (current) {
        next.set(path, { ...current, ...updates });
      }
      return next;
    });
  }, []);

  /**
   * Start downloading a file
   */
  const downloadFile = useCallback(
    async (path: string) => {
      // Check if already downloading
      if (downloads.has(path)) {
        const existing = downloads.get(path);
        if (existing && ['pending', 'downloading', 'verifying'].includes(existing.status)) {
          return; // Already in progress
        }
      }

      // Create abort controller
      const abortController = new AbortController();
      abortControllersRef.current.set(path, abortController);

      // Initialize download state
      const initialProgress: DownloadProgress = {
        path,
        totalSize: 0,
        downloadedSize: 0,
        progress: 0,
        speed: 0,
        eta: 0,
        status: 'pending',
      };

      setDownloads((prev) => {
        const next = new Map(prev);
        next.set(path, initialProgress);
        return next;
      });

      // Speed tracking samples
      const speedSamples: { time: number; bytes: number }[] = [];
      const MAX_SAMPLES = 10;

      try {
        // Start download request
        const response = await fetch(
          `${API_URL}/api/v1/fleet/sensors/${sensorId}/files/download?path=${encodeURIComponent(path)}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${API_KEY}`,
            },
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Download failed: ${response.status}`);
        }

        // Get total size from headers
        const contentLength = response.headers.get('content-length');
        const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
        const expectedChecksum = response.headers.get('x-checksum');

        updateDownload(path, {
          totalSize,
          status: 'downloading',
        });

        // Read the stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        const chunks: Uint8Array[] = [];
        let downloadedSize = 0;

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          chunks.push(value);
          downloadedSize += value.length;

          // Update speed samples
          const now = Date.now();
          speedSamples.push({ time: now, bytes: downloadedSize });
          if (speedSamples.length > MAX_SAMPLES) {
            speedSamples.shift();
          }

          // Calculate speed and ETA
          const speed = calculateSpeed(speedSamples);
          const remaining = totalSize - downloadedSize;
          const eta = speed > 0 ? remaining / speed : 0;

          // Calculate progress
          const progress = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;

          if (isMountedRef.current) {
            updateDownload(path, {
              downloadedSize,
              progress,
              speed,
              eta,
            });
          }
        }

        // Create blob from chunks - concatenate all Uint8Arrays
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const concatenated = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          concatenated.set(chunk, offset);
          offset += chunk.length;
        }
        const blob = new Blob([concatenated]);

        // Verify checksum if provided
        if (expectedChecksum && isMountedRef.current) {
          updateDownload(path, { status: 'verifying' });

          // Calculate checksum (SHA-256)
          const arrayBuffer = await blob.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const calculatedChecksum = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

          if (calculatedChecksum !== expectedChecksum.toLowerCase()) {
            throw new Error(`Checksum verification failed. Expected: ${expectedChecksum}, Got: ${calculatedChecksum}`);
          }

          if (isMountedRef.current) {
            updateDownload(path, {
              status: 'complete',
              progress: 100,
              blob,
              verifiedChecksum: calculatedChecksum,
            });
          }
        } else if (isMountedRef.current) {
          updateDownload(path, {
            status: 'complete',
            progress: 100,
            blob,
          });
        }

        // Notify callback
        if (isMountedRef.current) {
          onDownloadComplete?.(path, blob);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Cancelled
          if (isMountedRef.current) {
            updateDownload(path, {
              status: 'cancelled',
              error: 'Download cancelled',
            });
          }
        } else {
          // Error
          const error = err instanceof Error ? err : new Error('Download failed');
          if (isMountedRef.current) {
            updateDownload(path, {
              status: 'error',
              error: error.message,
            });
            onDownloadError?.(path, error);
          }
        }
      } finally {
        abortControllersRef.current.delete(path);
      }
    },
    [sensorId, downloads, updateDownload, onDownloadComplete, onDownloadError]
  );

  /**
   * Cancel an active download
   */
  const cancelDownload = useCallback((path: string) => {
    const controller = abortControllersRef.current.get(path);
    if (controller) {
      controller.abort();
    }
  }, []);

  /**
   * Clear completed/failed downloads from the list
   */
  const clearCompletedDownloads = useCallback(() => {
    setDownloads((prev) => {
      const next = new Map(prev);
      for (const [path, download] of next.entries()) {
        if (['complete', 'error', 'cancelled'].includes(download.status)) {
          next.delete(path);
        }
      }
      return next;
    });
  }, []);

  // =============================================================================
  // File Info
  // =============================================================================

  /**
   * Get detailed file information including checksum
   */
  const getFileInfo = useCallback(
    async (path: string): Promise<FileInfo> => {
      const response = await fetch(
        `${API_URL}/api/v1/fleet/sensors/${sensorId}/files/info?path=${encodeURIComponent(path)}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to get file info: ${response.status}`);
      }

      const data = await response.json();
      return {
        path: data.path,
        name: data.name,
        size: data.size,
        modified: data.modified,
        isDir: data.isDir,
        checksum: data.checksum,
        permissions: data.permissions,
      };
    },
    [sensorId]
  );

  // =============================================================================
  // Lifecycle
  // =============================================================================

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    navigateTo(currentPath);

    return () => {
      isMountedRef.current = false;
      // Cancel all active downloads
      for (const controller of abortControllersRef.current.values()) {
        controller.abort();
      }
      abortControllersRef.current.clear();
    };
    // Only run on mount
  }, []);

  // Reload when sensorId changes
  useEffect(() => {
    setCurrentPath(normalizePath(initialPath));
    setFiles([]);
    setFilesError(null);
    navigateTo(normalizePath(initialPath));
  }, [sensorId]);

  return {
    // Directory listing
    currentPath,
    files,
    isLoadingFiles,
    filesError,

    // Navigation
    navigateTo,
    navigateUp,
    refresh,

    // Downloads
    downloads,
    downloadFile,
    cancelDownload,
    clearCompletedDownloads,

    // File info
    getFileInfo,
  };
}
