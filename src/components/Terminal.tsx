import { useState, useRef, useEffect, useCallback } from "react";
import {
  exportNotes,
  importNotes,
  updateNote,
  type OutputLine,
  type CommandResult,
  type OutputAction,
} from "@/lib/commands";
import { type Note, purgeOldDeleted } from "@/lib/db";
import { useConfig, applyTheme } from "@/hooks/useConfig";
import { useShell } from "@/hooks/useShell";
import CommandLine from "./CommandLine";
import OutputDisplay from "./OutputDisplay";
import NoteEditor from "./NoteEditor";
import ShortcutsOverlay from "./ShortcutsOverlay";

export default function Terminal() {
  const shell = useShell();
  const [inputValue, setInputValue] = useState("");
  const [editorState, setEditorState] = useState<{
    note: Note;
    isNew: boolean;
  } | null>(null);

  // Visual Mode State
  const [visualMode, setVisualMode] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { config, refreshConfig } = useConfig();

  // Apply theme when config changes
  useEffect(() => {
    applyTheme(config.theme);
  }, [config.theme]);

  // Auto-scroll to bottom, unless in visual mode
  useEffect(() => {
    if (terminalRef.current && !visualMode) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [shell.output, visualMode]);

  // Re-focus input whenever processing ends or editor closes
  useEffect(() => {
    if (!editorState && !shell.isProcessing && !visualMode) {
      // Small delay to ensure DOM has settled after state updates
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [shell.isProcessing, editorState, visualMode]);

  // Focus input on click
  const handleTerminalClick = useCallback(() => {
    if (!editorState && !visualMode) {
      inputRef.current?.focus();
    }
  }, [editorState, visualMode]);

  // Handle command execution
  const executeCommand = useCallback(
    async (input: string) => {
      if (shell.isProcessing || !input.trim()) return;

      setIsFirstVisit(false);
      setInputValue("");

      try {
        const result = await shell.execute(input);

        if (!result) return;

        if (result.openEditor) {
          setEditorState(result.openEditor);
        }

        if (result.triggerExport) {
          const data = await exportNotes();
          const blob = new Blob([data], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `glyph-notes-${new Date().toISOString().split("T")[0]
            }.json`;
          a.click();
          URL.revokeObjectURL(url);
        }

        if (result.triggerImport) {
          fileInputRef.current?.click();
        }

        // Refresh config if config command was executed
        if (input.trim().toLowerCase().startsWith("config ")) {
          await refreshConfig();
        }
      } catch (error) {
        console.error("Execution error:", error);
      }

      // Re-focus input after command completes
      setTimeout(() => {
        if (!editorState && !visualMode) {
          inputRef.current?.focus();
        }
      }, 50);
    },
    [shell, refreshConfig, editorState, visualMode]
  );

  // Handle Action (Visual Mode)
  const handleAction = useCallback(async (action: OutputAction) => {
    setVisualMode(false);
    setSelectedIndex(-1);

    if (action.type === 'open') {
      // Open note
      await executeCommand(`open ${action.id}`);
    } else if (action.type === 'cd') {
      // Change directory
      await executeCommand(`cd ${action.path}`);
    } else if (action.type === 'run') {
      // Run arbitrary command
      await executeCommand(action.command);
    }
  }, [executeCommand]);

  // Web Audio Context for key sounds
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (config.soundEnabled && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, [config.soundEnabled]);

  const playKeySound = useCallback(() => {
    if (!config.soundEnabled || !audioContextRef.current) return;

    // Resume context if suspended (browser requirements)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const osc = audioContextRef.current.createOscillator();
    const gain = audioContextRef.current.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, audioContextRef.current.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioContextRef.current.currentTime + 0.05);

    gain.gain.setValueAtTime(0.05, audioContextRef.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(audioContextRef.current.destination);

    osc.start();
    osc.stop(audioContextRef.current.currentTime + 0.05);
  }, [config.soundEnabled]);

  // Handle Mac-style window controls
  const handleTrafficLightClick = useCallback((type: 'close' | 'minimize' | 'maximize') => {
    switch (type) {
      case 'close':
        // Red: Clear terminal
        executeCommand('clear');
        break;
      case 'minimize':
        // Yellow: Toggle shortcuts
        setShowShortcuts(prev => !prev);
        break;
      case 'maximize':
        // Green: Toggle fullscreen
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().then(() => {
            console.log("Fullscreen enabled");
          }).catch((e) => {
            console.error(`Error attempting to enable fullscreen mode: ${e.message} (${e.name})`);
            // Add a visual cue in terminal if possible, but we are in a callback.
            // For now, console error is checking.
          });
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          }
        }
        break;
    }
  }, [executeCommand]);

  // Handle global keyboard shortcuts and sound
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Play sound on any key press
      playKeySound();

      // Toggle shortcuts overlay with Ctrl+/
      if (e.ctrlKey && e.key === "/") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }

      if (editorState) return;

      // Visual Mode Toggle
      if (e.key === "Escape" || (e.ctrlKey && e.key === " ")) {
        if (visualMode) {
          setVisualMode(false);
          setSelectedIndex(-1);
          // Input focus handled by effect
        } else {
          // Enter Visual Mode
          e.preventDefault();
          setVisualMode(true);
          setSelectedIndex(shell.output.length - 1);
          inputRef.current?.blur();
        }
      }

      // Visual Mode Navigation
      if (visualMode) {
        if (e.key === "j" || e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, shell.output.length - 1));
        } else if (e.key === "k" || e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          const line = shell.output[selectedIndex];
          if (line?.action) {
            handleAction(line.action);
          }
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [visualMode, selectedIndex, shell.output, editorState, handleAction, playKeySound]);

  // Handle file import
  const handleFileImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = await importNotes(text);

        // We could log success here if needed
        console.log(`Imported ${result.imported} notes`);
      } catch (error) {
        console.error("Import failed", error);
      }

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

  // Handle keyboard navigation through history (delegate to CommandLine via shell)
  const handleShellKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Play sound is handled by global listener usually, but we can verify

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (shell.history.length > 0) {
          const newIndex =
            shell.historyIndex < shell.history.length - 1
              ? shell.historyIndex + 1
              : shell.historyIndex;
          shell.setHistoryIndex(newIndex);
          setInputValue(
            shell.history[shell.history.length - 1 - newIndex] || ""
          );
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (shell.historyIndex > 0) {
          const newIndex = shell.historyIndex - 1;
          shell.setHistoryIndex(newIndex);
          setInputValue(
            shell.history[shell.history.length - 1 - newIndex] || ""
          );
        } else if (shell.historyIndex === 0) {
          shell.setHistoryIndex(-1);
          setInputValue("");
        }
      }
    },
    [shell]
  );

  // Welcome message on mount
  useEffect(() => {
    if (shell.output.length === 0 && isFirstVisit) {
      shell.execute("version");
    }
    purgeOldDeleted().catch(() => { });
  }, []);

  // Class helpers
  const scanlineClass = config.scanlines ? "scanlines" : "";
  const crtClass = config.crtEnabled ? "text-flicker" : "";

  return (
    <div
      className={`terminal-container min-h-screen flex flex-col ${scanlineClass} ${crtClass}`}
      onClick={handleTerminalClick}
    >
      {/* CRT Overlay */}
      {config.crtEnabled && <div className="crt-overlay" />}

      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/30 relative z-10">
        <div className="flex gap-1.5 group">
          <div
            onClick={(e) => { e.stopPropagation(); handleTrafficLightClick('close'); }}
            className="w-3 h-3 rounded-full bg-destructive/70 hover:bg-destructive cursor-pointer transition-colors"
            title="Clear Terminal"
          />
          <div
            onClick={(e) => { e.stopPropagation(); handleTrafficLightClick('minimize'); }}
            className="w-3 h-3 rounded-full bg-warning/70 hover:bg-warning cursor-pointer transition-colors"
            title="Toggle Shortcuts"
          />
          <div
            onClick={(e) => { e.stopPropagation(); handleTrafficLightClick('maximize'); }}
            className="w-3 h-3 rounded-full bg-success/70 hover:bg-success cursor-pointer transition-colors"
            title="Toggle Fullscreen"
          />
        </div>
        <span className="text-sm terminal-dim ml-2">glyph-v2.1</span>
        <span className="text-sm terminal-dim ml-auto flex items-center gap-2">
          <span className="opacity-60">theme:</span>
          <span className="terminal-command">{config.theme}</span>
          <span className="mx-2 opacity-30">|</span>
          <span className="terminal-info">{shell.pathString}</span>
        </span>
      </div>

      {/* Terminal content */}
      <div ref={terminalRef} className="flex-1 overflow-auto p-4 space-y-1 relative z-0">
        {/* Output history */}
        <OutputDisplay
          lines={shell.output}
          visualMode={visualMode}
          selectedIndex={selectedIndex}
        />

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
            pathString={shell.pathString}
            onChange={setInputValue}
            onSubmit={executeCommand}
            onKeyDown={handleShellKeyDown}
            disabled={shell.isProcessing || visualMode}
            showPlaceholder={shell.output.length === 0}
          />
        )}

        {/* Shortcuts Overlay */}
        {showShortcuts && (
          <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />
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
      <div className="px-4 py-1.5 border-t border-border/50 bg-muted/30 flex items-center justify-between text-xs terminal-dim relative z-10">
        <span className="flex-1">
          {visualMode ? (
            <span className="text-warning font-bold animate-pulse">-- VISUAL MODE -- (j/k: move • Enter: select • Esc: exit)</span>
          ) : (
            "Press ↑↓ for history • Esc for Visual Mode • Ctrl+/ for cheatsheet"
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Offline Ready
        </span>
      </div>
    </div>
  );
}
