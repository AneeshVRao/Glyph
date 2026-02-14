import type { OutputLine } from '@/lib/commands';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface OutputDisplayProps {
  lines: OutputLine[];
}

export default function OutputDisplay({ lines }: OutputDisplayProps) {
  if (lines.length === 0) return null;

  // Parse content for highlight markers (»text«)
  const renderContent = (content: string, type: string) => {
    if (type === 'markdown') {
      return (
        <div className="markdown-content pl-2">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({children}) => <h1 className="text-xl font-bold terminal-success mb-2 border-b border-success/30 pb-1">{children}</h1>,
              h2: ({children}) => <h2 className="text-lg font-bold terminal-success mb-2 mt-4">{children}</h2>,
              h3: ({children}) => <h3 className="text-base font-bold terminal-success mb-1 mt-3">{children}</h3>,
              p: ({children}) => <p className="mb-2 last:mb-0 leading-relaxed text-foreground/90">{children}</p>,
              ul: ({children}) => <ul className="list-disc list-inside mb-2 pl-2 space-y-1">{children}</ul>,
              ol: ({children}) => <ol className="list-decimal list-inside mb-2 pl-2 space-y-1">{children}</ol>,
              li: ({children}) => <li className="terminal-output">{children}</li>,
              blockquote: ({children}) => <blockquote className="border-l-2 border-success/50 pl-4 italic terminal-dim mb-2">{children}</blockquote>,
              code: ({children}) => <code className="bg-primary/10 rounded px-1 py-0.5 font-mono text-sm terminal-warning">{children}</code>,
              pre: ({children}) => <pre className="bg-primary/5 p-3 rounded mb-2 overflow-x-auto border border-border/30"><code className="bg-transparent p-0 text-sm">{children}</code></pre>,
              a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="terminal-info underline hover:text-success transition-colors">{children}</a>,
              strong: ({children}) => <strong className="font-bold text-success">{children}</strong>,
              em: ({children}) => <em className="italic text-warning">{children}</em>,
              hr: () => <hr className="border-border/40 my-4" />,
              table: ({children}) => <div className="overflow-x-auto my-4"><table className="w-full border-collapse text-left">{children}</table></div>,
              th: ({children}) => <th className="border-b border-border/50 p-2 font-bold terminal-success">{children}</th>,
              td: ({children}) => <td className="border-b border-border/20 p-2 terminal-dim">{children}</td>,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      );
    }

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
            line.type === 'highlight' && 'terminal-warning bg-warning/10',
            line.type === 'markdown' && 'w-full max-w-3xl'
          )}
        >
          {renderContent(line.content, line.type)}
        </div>
      ))}
    </div>
  );
}
