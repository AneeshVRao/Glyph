import type { OutputLine } from '@/lib/commands';
import { cn } from '@/lib/utils';

interface OutputDisplayProps {
  lines: OutputLine[];
}

export default function OutputDisplay({ lines }: OutputDisplayProps) {
  if (lines.length === 0) return null;

  // Parse content for highlight markers (»text«)
  const renderContent = (content: string, type: string) => {
    if (!content.includes('»')) {
      return content || '\u00A0';
    }

    const parts = content.split(/(»[^«]*«)/);
    return parts.map((part, i) => {
      if (part.startsWith('»') && part.endsWith('«')) {
        return (
          <span key={i} className="terminal-warning font-bold bg-warning/10 px-0.5 rounded">
            {part.slice(1, -1)}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-0.5 mb-2">
      {lines.map((line, i) => (
        <div
          key={i}
          className={cn(
            'font-mono text-base whitespace-pre-wrap',
            line.type === 'prompt' && 'terminal-prompt',
            line.type === 'output' && 'terminal-output',
            line.type === 'error' && 'terminal-error',
            line.type === 'warning' && 'terminal-warning',
            line.type === 'info' && 'terminal-info',
            line.type === 'success' && 'terminal-success',
            line.type === 'dim' && 'terminal-dim',
            line.type === 'highlight' && 'terminal-warning bg-warning/10'
          )}
        >
          {renderContent(line.content, line.type)}
        </div>
      ))}
    </div>
  );
}
