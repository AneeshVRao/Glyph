import { forwardRef, useCallback, useState, useEffect } from 'react';
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

    // Load note titles for autocomplete
    useEffect(() => {
      const loadTitles = async () => {
        const titles = await getNoteTitles();
        setNoteTitles(titles);
      };
      loadTitles();
    }, [value]); // Refresh when value changes (after operations)

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
      } else if (e.key === 'Tab' && suggestion) {
        e.preventDefault();
        onChange(value + suggestion);
        setSuggestion('');
      } else {
        onKeyDown?.(e);
      }
    }, [value, suggestion, disabled, onSubmit, onChange, onKeyDown]);

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
            className="w-full bg-transparent border-none outline-none terminal-command text-base font-mono caret-primary"
            placeholder={placeholderText}
          />
          {/* Autocomplete suggestion */}
          {suggestion && (
            <span className="absolute left-0 top-0 pointer-events-none">
              <span className="invisible">{value}</span>
              <span className="terminal-dim">{suggestion}</span>
            </span>
          )}
        </div>
        <span className="w-2 h-5 bg-primary cursor-blink" />
      </div>
    );
  }
);

CommandLine.displayName = 'CommandLine';

export default CommandLine;
