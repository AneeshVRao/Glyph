import { useState, useRef, useEffect, useCallback } from 'react';
import type { Note } from '@/lib/db';

interface NoteEditorProps {
  note: Note;
  isNew: boolean;
  onSave: (note: Note, body: string, tags: string[]) => void;
  onClose: () => void;
}

export default function NoteEditor({ note, isNew, onSave, onClose }: NoteEditorProps) {
  const [body, setBody] = useState(note.body);
  const [tagInput, setTagInput] = useState(note.tags.join(', '));
  const [mode, setMode] = useState<'edit' | 'tags'>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (mode === 'tags') {
        setMode('edit');
        textareaRef.current?.focus();
      } else {
        // Save and close
        const tags = tagInput
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);
        onSave(note, body, tags);
      }
    } else if (e.key === 'q' && e.ctrlKey) {
      e.preventDefault();
      onClose();
    } else if (e.key === 't' && e.ctrlKey) {
      e.preventDefault();
      setMode(mode === 'tags' ? 'edit' : 'tags');
      if (mode === 'edit') {
        setTimeout(() => tagInputRef.current?.focus(), 0);
      } else {
        setTimeout(() => textareaRef.current?.focus(), 0);
      }
    }
  }, [body, tagInput, note, mode, onSave, onClose]);

  // Calculate text stats
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const lineCount = body.split('\n').length;

  // Handle save
  const handleSave = useCallback(() => {
    const tags = tagInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    onSave(note, body, tags);
  }, [body, tagInput, note, onSave]);

  return (
    <div 
      className="my-4 border border-border rounded glow-border"
      onKeyDown={handleKeyDown}
    >
      {/* Editor header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="terminal-info">───</span>
          <span className="terminal-output font-bold">
            #{note.id}: {note.title}
          </span>
          <span className="terminal-info">───</span>
          {isNew && <span className="terminal-warning text-sm">[NEW]</span>}
        </div>
        <span className="terminal-dim text-sm">
          {mode === 'edit' ? 'EDIT' : 'TAGS'}
        </span>
      </div>

      {/* Editor body */}
      <div className="p-4 min-h-[200px] max-h-[400px] overflow-auto">
        {mode === 'edit' ? (
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Start writing..."
            className="w-full h-full min-h-[180px] bg-transparent border-none outline-none resize-none terminal-output font-mono text-base leading-relaxed"
            spellCheck={false}
          />
        ) : (
          <div className="space-y-2">
            <label className="terminal-dim text-sm">Tags (comma-separated):</label>
            <input
              ref={tagInputRef}
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="work, ideas, todo"
              className="w-full bg-muted/50 border border-border rounded px-3 py-2 terminal-output font-mono outline-none focus:border-primary"
            />
            <p className="terminal-dim text-sm">
              Current: {tagInput.split(',').filter(t => t.trim()).map(t => `[${t.trim()}]`).join(' ') || '(none)'}
            </p>
          </div>
        )}
      </div>

      {/* Editor footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 text-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            className="terminal-success hover:glow-text transition-all"
          >
            [ESC] Save
          </button>
          <button
            onClick={onClose}
            className="terminal-warning hover:glow-text transition-all"
          >
            [CTRL+Q] Discard
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setMode(mode === 'tags' ? 'edit' : 'tags');
              if (mode === 'edit') {
                setTimeout(() => tagInputRef.current?.focus(), 0);
              } else {
                setTimeout(() => textareaRef.current?.focus(), 0);
              }
            }}
            className="terminal-info hover:glow-text transition-all"
          >
            [CTRL+T] {mode === 'edit' ? 'Edit Tags' : 'Back to Edit'}
          </button>
          <span className="terminal-dim">
            {wordCount}w {lineCount}L {body.length}c
          </span>
        </div>
      </div>
    </div>
  );
}
