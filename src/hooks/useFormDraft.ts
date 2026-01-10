import { useState, useEffect, useCallback } from 'react';

interface DraftInfo<T> {
  data: T;
  savedAt: number;
  formType: string;
  displayName?: string;
}

const DRAFT_KEY_PREFIX = 'form_draft_';
const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function useFormDraft<T>(formType: string) {
  const storageKey = `${DRAFT_KEY_PREFIX}${formType}`;

  const getDraft = useCallback((): DraftInfo<T> | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;

      const draft = JSON.parse(stored) as DraftInfo<T>;
      
      // Check if draft has expired
      if (Date.now() - draft.savedAt > DRAFT_EXPIRY_MS) {
        localStorage.removeItem(storageKey);
        return null;
      }
      
      return draft;
    } catch (e) {
      console.error('Error reading form draft:', e);
      return null;
    }
  }, [storageKey]);

  const saveDraft = useCallback((data: T, displayName?: string) => {
    try {
      const draft: DraftInfo<T> = {
        data,
        savedAt: Date.now(),
        formType,
        displayName,
      };
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch (e) {
      console.error('Error saving form draft:', e);
    }
  }, [storageKey, formType]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error('Error clearing form draft:', e);
    }
  }, [storageKey]);

  const hasDraft = useCallback((): boolean => {
    return getDraft() !== null;
  }, [getDraft]);

  return {
    getDraft,
    saveDraft,
    clearDraft,
    hasDraft,
  };
}

// Helper to check if draft has meaningful data
export function isDraftMeaningful<T extends Record<string, any>>(
  data: T,
  requiredFields: (keyof T)[]
): boolean {
  return requiredFields.some((field) => {
    const value = data[field];
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return value > 0;
    if (value !== null && value !== undefined) return true;
    return false;
  });
}
