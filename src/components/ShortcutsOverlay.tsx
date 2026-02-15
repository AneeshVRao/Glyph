import { useEffect } from "react";
import { X } from "lucide-react";

interface ShortcutsOverlayProps {
  onClose: () => void;
}

export default function ShortcutsOverlay({ onClose }: ShortcutsOverlayProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const shortcuts = [
    { keys: ["Ctrl", "L"], desc: "Clear terminal" },
    { keys: ["Ctrl", "P"], desc: "Previous command" },
    { keys: ["Ctrl", "N"], desc: "Next command" },
    { keys: ["Tab"], desc: "Autocomplete command" },
    { keys: ["Ctrl", "/"], desc: "Toggle cheatsheet" },
  ];

  const editorShortcuts = [
    { keys: ["Ctrl", "S"], desc: "Save note" },
    { keys: ["Esc"], desc: "Close editor" },
  ];

  const commonCommands = [
    { cmd: "new", args: '"title"', desc: "Create note" },
    { cmd: "open", args: "<id>", desc: "View note" },
    { cmd: "edit", args: "<id>", desc: "Edit note" },
    { cmd: "list", args: "", desc: "List notes" },
    { cmd: "pin", args: "<id>", desc: "Pin note" },
    { cmd: "search", args: '"query"', desc: "Full text search" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl border border-border bg-card shadow-lg animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success/70" />
            <h2 className="text-lg font-bold terminal-success">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-destructive/20 rounded-sm transition-colors text-muted-foreground hover:text-destructive"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto max-h-[80vh]">
          {/* Left Column: Shortcuts */}
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold terminal-dim mb-3 uppercase tracking-wider">Terminal</h3>
              <div className="space-y-2">
                {shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                      {s.desc}
                    </span>
                    <div className="flex gap-1">
                      {s.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded min-w-[20px] text-center"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold terminal-dim mb-3 uppercase tracking-wider">Editor</h3>
              <div className="space-y-2">
                {editorShortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                      {s.desc}
                    </span>
                    <div className="flex gap-1">
                      {s.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded min-w-[20px] text-center"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Commands */}
          <div>
            <h3 className="text-sm font-bold terminal-dim mb-3 uppercase tracking-wider">Common Commands</h3>
            <div className="space-y-2">
              {commonCommands.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-4 group">
                  <div className="flex items-center gap-2 font-mono text-sm">
                    <span className="terminal-success group-hover:underline">{c.cmd}</span>
                    <span className="text-muted-foreground text-xs">{c.args}</span>
                  </div>
                  <span className="text-sm text-foreground/60 text-right">{c.desc}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground text-center">
                Type <span className="terminal-command">help</span> for full command list
              </p>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="bg-muted/30 p-2 text-center text-xs text-muted-foreground border-t border-border">
          Press <kbd className="px-1 bg-background border border-border rounded">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
