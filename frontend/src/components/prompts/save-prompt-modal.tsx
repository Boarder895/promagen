// src/components/prompts/save-prompt-modal.tsx
// ============================================================================
// SAVE PROMPT MODAL
// ============================================================================
// Modal for saving prompts to the library with name and optional notes.
// Authority: docs/authority/prompt-intelligence.md §9.2
// ============================================================================

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface SavePromptData {
  name: string;
  notes?: string;
  tags?: string[];
}

export interface SavePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SavePromptData) => void;
  /** Preview of the prompt being saved */
  promptPreview?: string;
  /** Platform name for display */
  platformName?: string;
  /** Whether saving is in progress */
  isSaving?: boolean;
  /** Suggested name based on prompt content */
  suggestedName?: string;
}

// ============================================================================
// Component
// ============================================================================

export function SavePromptModal({
  isOpen,
  onClose,
  onSave,
  promptPreview,
  platformName,
  isSaving = false,
  suggestedName = '',
}: SavePromptModalProps) {
  const [name, setName] = useState(suggestedName);
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      if (suggestedName) {
        setName(suggestedName);
      }
    }
  }, [isOpen, suggestedName]);

  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setNotes('');
      setTagsInput('');
      setError('');
    }
  }, [isOpen]);

  // Handle save
  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a name for your prompt');
      return;
    }

    // Parse tags from comma-separated input
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    onSave({
      name: trimmedName,
      notes: notes.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
  }, [name, notes, tagsInput, onSave]);

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleSave, onClose]
  );

  if (!isOpen) return null;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default border-0"
        onClick={onClose}
        aria-label="Close modal"
        tabIndex={-1}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-prompt-title"
        className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 id="save-prompt-title" className="text-lg font-semibold text-white">
            Save to Library
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Prompt preview */}
          {promptPreview && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-wide text-white/40">Preview</span>
                {platformName && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400">
                    {platformName}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/60 line-clamp-3 font-mono">
                {promptPreview}
              </p>
            </div>
          )}

          {/* Name input */}
          <div>
            <label htmlFor="prompt-name" className="block text-sm font-medium text-white/70 mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              ref={inputRef}
              id="prompt-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g., Cyberpunk City at Night"
              className="w-full px-4 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all"
              maxLength={100}
            />
            {error && (
              <p className="mt-1 text-xs text-red-400">{error}</p>
            )}
          </div>

          {/* Notes input */}
          <div>
            <label htmlFor="prompt-notes" className="block text-sm font-medium text-white/70 mb-1.5">
              Notes <span className="text-white/30">(optional)</span>
            </label>
            <textarea
              id="prompt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this prompt..."
              rows={2}
              className="w-full px-4 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all resize-none"
              maxLength={500}
            />
          </div>

          {/* Tags input */}
          <div>
            <label htmlFor="prompt-tags" className="block text-sm font-medium text-white/70 mb-1.5">
              Tags <span className="text-white/30">(optional, comma-separated)</span>
            </label>
            <input
              id="prompt-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g., cyberpunk, city, night"
              className="w-full px-4 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-white/[0.02]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            ) : (
              'Save to Library'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SavePromptModal;
