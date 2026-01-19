import { useState, useEffect, useCallback, useRef } from 'react';

// Types
interface VersionEntry {
  id: string;
  content: any;
  timestamp: number;
  prompt?: string;
}

interface BlockVersionHistory {
  blockId: string;
  unitId: string;
  versions: VersionEntry[];
  currentIndex: number;
}

// Constants
const MAX_VERSIONS = 5;
const STORAGE_PREFIX = 'ai-refine-history';

/**
 * Custom hook for managing version history of AI refinements
 * Stores history in localStorage for persistence across sessions
 */
export function useVersionHistory(
  unitId: string,
  blockId: string,
  currentContent: any,
  onUpdate: (content: any) => void
) {
  const [history, setHistory] = useState<BlockVersionHistory | null>(null);
  const isInitialized = useRef(false);
  const storageKey = `${STORAGE_PREFIX}:${unitId}:${blockId}`;

  // Load from localStorage on mount
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as BlockVersionHistory;
        setHistory(parsed);
      }
    } catch (err) {
      console.error('Failed to load version history:', err);
    }
  }, [storageKey]);

  // Save to localStorage whenever history changes
  useEffect(() => {
    if (history) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(history));
      } catch (err) {
        console.error('Failed to save version history:', err);
      }
    }
  }, [history, storageKey]);

  // Save new version after AI refinement
  const saveVersion = useCallback((newContent: any, prompt?: string) => {
    setHistory(prev => {
      const newEntry: VersionEntry = {
        id: crypto.randomUUID(),
        content: JSON.parse(JSON.stringify(newContent)),
        timestamp: Date.now(),
        prompt
      };

      if (!prev) {
        // First time - initialize with the new version
        return {
          blockId,
          unitId,
          versions: [newEntry],
          currentIndex: 0
        };
      }

      // If we're not at the end, we're creating a new branch
      // Remove all versions after current index
      const versionsUpToCurrent = prev.versions.slice(0, prev.currentIndex + 1);

      // Add new version
      let newVersions = [...versionsUpToCurrent, newEntry];

      // Enforce max versions limit
      if (newVersions.length > MAX_VERSIONS) {
        newVersions = newVersions.slice(newVersions.length - MAX_VERSIONS);
      }

      return {
        ...prev,
        versions: newVersions,
        currentIndex: newVersions.length - 1
      };
    });
  }, [blockId, unitId]);

  // Navigate to previous version
  const goToPrevious = useCallback(() => {
    if (!history || history.currentIndex <= 0) return;

    const newIndex = history.currentIndex - 1;
    const previousVersion = history.versions[newIndex];

    setHistory(prev => prev ? { ...prev, currentIndex: newIndex } : null);
    onUpdate(JSON.parse(JSON.stringify(previousVersion.content)));
  }, [history, onUpdate]);

  // Navigate to next version
  const goToNext = useCallback(() => {
    if (!history || history.currentIndex >= history.versions.length - 1) return;

    const newIndex = history.currentIndex + 1;
    const nextVersion = history.versions[newIndex];

    setHistory(prev => prev ? { ...prev, currentIndex: newIndex } : null);
    onUpdate(JSON.parse(JSON.stringify(nextVersion.content)));
  }, [history, onUpdate]);

  // Computed values
  const canGoBack = history ? history.currentIndex > 0 : false;
  const canGoForward = history ? history.currentIndex < history.versions.length - 1 : false;
  const currentVersionNumber = history ? history.currentIndex + 1 : 0;
  const totalVersions = history ? history.versions.length : 0;
  const hasHistory = totalVersions > 0;

  return {
    saveVersion,
    goToPrevious,
    goToNext,
    canGoBack,
    canGoForward,
    currentVersionNumber,
    totalVersions,
    hasHistory
  };
}
