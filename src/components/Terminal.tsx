import { useState, useRef, useEffect, useCallback } from "react";
import {
  parseAndExecute,
  exportNotes,
  importNotes,
  updateNote,
  type OutputLine,
  type CommandResult,
} from "@/lib/commands";
import { type Note } from "@/lib/db";
import { useConfig, applyTheme } from "@/hooks/useConfig";
import CommandLine from "./CommandLine";
import OutputDisplay from "./OutputDisplay";
import NoteEditor from "./NoteEditor";

interface HistoryEntry {
  input: string;
  output: OutputLine[];
  timestamp: number;
}

export default function Terminal() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editorState, setEditorState] = useState<{
    note: Note;
    isNew: boolean;
  } | null>(null);
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { config, refreshConfig } = useConfig();

  // Apply theme when config changes
  useEffect(() => {
    applyTheme(config.theme);
  }, [config.theme]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input on click
  const handleTerminalClick = useCallback(() => {
    if (!editorState) {
      inputRef.current?.focus();
    }
  }, [editorState]);

  // Handle command execution
  const executeCommand = useCallback(
    async (input: string) => {
      if (isProcessing || !input.trim()) return;

      setIsProcessing(true);
      setIsFirstVisit(false);

      // Add to command history
      if (input.trim()) {
        setCommandHistory((prev) => [
          ...prev.filter((cmd) => cmd !== input),
          input,
        ]);
        setHistoryIndex(-1);
      }

      try {
        const result: CommandResult = await parseAndExecute(input);

        if (result.shouldClear) {
          setHistory([]);
        } else {
          setHistory((prev) => [
            ...prev,
            {
              input,
              output: result.output,
              timestamp: Date.now(),
            },
          ]);
        }

        if (result.openEditor) {
          setEditorState(result.openEditor);
        }

        if (result.triggerExport) {
          const data = await exportNotes();
          const blob = new Blob([data], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `glyph-notes-${
            new Date().toISOString().split("T")[0]
          }.json`;
          a.click();
          URL.revokeObjectURL(url);

          setHistory((prev) => [
            ...prev,
            {
              input: "",
              output: [
                {
                  type: "success",
                  content: "✓ Export downloaded successfully",
                },
              ],
              timestamp: Date.now(),
            },
          ]);
        }

        if (result.triggerImport) {
          fileInputRef.current?.click();
        }

        // Refresh config if config command was executed
        if (input.trim().toLowerCase().startsWith("config ")) {
          await refreshConfig();
        }
      } catch (error) {
        setHistory((prev) => [
          ...prev,
          {
            input,
            output: [
              {
                type: "error",
                content: `Error: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`,
              },
            ],
            timestamp: Date.now(),
          },
        ]);
      }

      setInputValue("");
      setIsProcessing(false);
    },
    [isProcessing, refreshConfig]
  );

  // Handle file import
  const handleFileImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = await importNotes(text);

        const output: OutputLine[] = [
          { type: "success", content: `✓ Imported ${result.imported} notes` },
        ];

        if (result.duplicates > 0) {
          output.push({
            type: "info",
            content: `  ${result.duplicates} duplicates renamed`,
          });
        }

        if (result.skipped > 0) {
          output.push({
            type: "warning",
            content: `  ${result.skipped} entries skipped`,
          });
        }

        setHistory((prev) => [
          ...prev,
          {
            input: "",
            output,
            timestamp: Date.now(),
          },
        ]);
      } catch (error) {
        setHistory((prev) => [
          ...prev,
          {
            input: "",
            output: [
              {
                type: "error",
                content: `Import failed: ${
                  error instanceof Error ? error.message : "Invalid JSON"
                }`,
              },
            ],
            timestamp: Date.now(),
          },
        ]);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    []
  );

  // Handle editor save
  const handleEditorSave = useCallback(
    async (note: Note, body: string, tags: string[]) => {
      if (!note.id) return;

      await updateNote(note.id, { body, tags });

      setHistory((prev) => [
        ...prev,
        {
          input: "",
          output: [{ type: "success", content: `✓ Note #${note.id} saved` }],
          timestamp: Date.now(),
        },
      ]);

      setEditorState(null);
      inputRef.current?.focus();
    },
    []
  );

  // Handle editor close
  const handleEditorClose = useCallback(() => {
    setEditorState(null);
    inputRef.current?.focus();
  }, []);

  // Handle keyboard navigation through history
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length > 0) {
          const newIndex =
            historyIndex < commandHistory.length - 1
              ? historyIndex + 1
              : historyIndex;
          setHistoryIndex(newIndex);
          setInputValue(
            commandHistory[commandHistory.length - 1 - newIndex] || ""
          );
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInputValue(
            commandHistory[commandHistory.length - 1 - newIndex] || ""
          );
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInputValue("");
        }
      }
    },
    [commandHistory, historyIndex]
  );

  // Welcome message on mount
  useEffect(() => {
    setHistory([
      {
        input: "",
        output: [
          {
            type: "info",
            content: "╭───────────────────────────────────────────────╮",
          },
          {
            type: "info",
            content: "│                                               │",
          },
          {
            type: "info",
            content: "│          TERMINAL NOTES v1.1.0                │",
          },
          {
            type: "info",
            content: "│                                               │",
          },
          {
            type: "info",
            content: "│   Local-first • Offline-first • Yours        │",
          },
          {
            type: "info",
            content: "│                                               │",
          },
          {
            type: "info",
            content: "╰───────────────────────────────────────────────╯",
          },
          { type: "output", content: "" },
          { type: "dim", content: '  Type "help" for available commands' },
          { type: "dim", content: '  Type "new" to create your first note' },
          { type: "output", content: "" },
        ],
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const scanlineClass = config.scanlines ? "scanlines" : "";

  return (
    <div
      className={`terminal-container min-h-screen flex flex-col ${scanlineClass}`}
      onClick={handleTerminalClick}
    >
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/30">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-destructive/70" />
          <div className="w-3 h-3 rounded-full bg-warning/70" />
          <div className="w-3 h-3 rounded-full bg-success/70" />
        </div>
        <span className="text-sm terminal-dim ml-2">terminal-notes</span>
        <span className="text-sm terminal-dim ml-auto flex items-center gap-2">
          <span className="opacity-60">theme:</span>
          <span className="terminal-command">{config.theme}</span>
          <span className="mx-2 opacity-30">|</span>
          IndexedDB: active
        </span>
      </div>

      {/* Terminal content */}
      <div ref={terminalRef} className="flex-1 overflow-auto p-4 space-y-1">
        {/* Output history */}
        {history.map((entry, i) => (
          <div key={i} className="animate-fade-in">
            {entry.input && (
              <div className="flex items-center gap-2 mb-1">
                <span className="terminal-prompt font-bold">$</span>
                <span className="terminal-command">{entry.input}</span>
              </div>
            )}
            <OutputDisplay lines={entry.output} />
          </div>
        ))}

        {/* Editor overlay */}
        {editorState && (
          <NoteEditor
            note={editorState.note}
            isNew={editorState.isNew}
            onSave={handleEditorSave}
            onClose={handleEditorClose}
          />
        )}

        {/* Command input */}
        {!editorState && (
          <CommandLine
            ref={inputRef}
            value={inputValue}
            onChange={setInputValue}
            onSubmit={executeCommand}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            showPlaceholder={isFirstVisit && history.length <= 1}
          />
        )}
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        aria-label="Import notes file"
        onChange={handleFileImport}
      />

      {/* Status bar */}
      <div className="px-4 py-1.5 border-t border-border/50 bg-muted/30 flex items-center justify-between text-xs terminal-dim">
        <span>
          Press ↑↓ for history • Tab for autocomplete • "help" for commands
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Offline Ready
        </span>
      </div>
    </div>
  );
}
