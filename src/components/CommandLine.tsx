import { forwardRef, useCallback, useState, useEffect, useRef } from 'react';
import { getAllCommands, getNoteTitles } from '@/lib/commands';

interface CommandLineProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  showPlaceholder?: boolean;
}

const COMMANDS = getAllCommands();

const CommandLine = forwardRef<HTMLInputElement, CommandLineProps>(
  ({ value, onChange, onSubmit, onKeyDown, disabled, showPlaceholder = false }, ref) => {
    const [suggestion, setSuggestion] = useState('');
    const [noteTitles, setNoteTitles] = useState<{ id: number; title: string }[]>([]);
    const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load note titles once on mount + periodic refresh (not on every keystroke)
    const refreshTitles = useCallback(async () => {
      const titles = await getNoteTitles();
      setNoteTitles(titles);
    }, []);

    useEffect(() => {
      refreshTitles();
      // Refresh titles periodically to catch new/deleted notes
      refreshTimerRef.current = setInterval(refreshTitles, 5000);
      return () => {
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      };
    }, [refreshTitles]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      // Parse for autocomplete
      const parts = newValue.split(' ');
      const cmd = parts[0]?.toLowerCase();
      const arg = parts.slice(1).join(' ').toLowerCase();

      // Command autocomplete (first word)
      if (parts.length === 1 && newValue && !newValue.includes(' ')) {
        const match = COMMANDS.find(c => 
          c.startsWith(newValue.toLowerCase()) && c !== newValue.toLowerCase()
        );
        setSuggestion(match ? match.slice(newValue.length) : '');
        return;
      }

      // Title autocomplete for open/edit commands
      if (['open', 'edit', 'view', 'show'].includes(cmd) && arg && parts.length > 1) {
        // Only if not a number
        if (isNaN(parseInt(arg))) {
          const match = noteTitles.find(t => 
            t.title.toLowerCase().startsWith(arg) && t.title.toLowerCase() !== arg
          );
          if (match) {
            const remaining = match.title.slice(arg.length);
            setSuggestion(remaining);
            return;
          }
        }
      }

      setSuggestion('');
    }, [onChange, noteTitles]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !disabled) {
        e.preventDefault();
        setSuggestion('');
        onSubmit(value);
        // Refresh titles after command execution (e.g., after new/delete)
        setTimeout(refreshTitles, 300);
      } else if (e.key === 'Tab' && suggestion) {
        e.preventDefault();
        onChange(value + suggestion);
        setSuggestion('');
      } else {
        onKeyDown?.(e);
      }
    }, [value, suggestion, disabled, onSubmit, onChange, onKeyDown, refreshTitles]);

    // Placeholder hints for new users
    const placeholderText = showPlaceholder && !value 
      ? 'Type "help" to get started...' 
      : disabled 
        ? 'Processing...' 
        : '';

    return (
      <div className="flex items-center gap-2 group">
        <span className="terminal-prompt font-bold glow-text">$</span>
        <div className="relative flex-1">
          <input
            ref={ref}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-transparent border-none outline-none terminal-command text-base font-mono caret-transparent"
            placeholder={placeholderText}
          />
          {/* Cursor + autocomplete overlay */}
          <span className="absolute left-0 top-0 pointer-events-none flex items-center h-full">
            {/* Hidden text measurement — takes up same width as typed text */}
            <span className="invisible whitespace-pre font-mono text-base">{value || ''}</span>
            {/* Blinking block cursor — positioned right after the text */}
            <span className="w-2 h-5 bg-primary cursor-blink inline-block" />
            {/* Autocomplete suggestion — appears after cursor */}
            {suggestion && (
              <span className="terminal-dim font-mono text-base">{suggestion}</span>
            )}
          </span>
        </div>
      </div>
    );
  }
);

CommandLine.displayName = 'CommandLine';

export default CommandLine;
