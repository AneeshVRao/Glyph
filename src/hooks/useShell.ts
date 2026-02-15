import { useState, useCallback, useEffect } from 'react';
import { 
  parseAndExecute, 
  type CommandResult, 
  type OutputLine,
  type ShellContext 
} from '@/lib/commands';
import { getFolder } from '@/lib/db';

export function useShell() {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentPath, setCurrentPath] = useState<number | undefined>(undefined);
  const [pathString, setPathString] = useState<string>('~');
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Update path string when currentPath changes
  useEffect(() => {
    const updatePathString = async () => {
      if (currentPath === undefined) {
        setPathString('~');
        return;
      }
      
      try {
        // In a real shell we'd walk up the tree, but for now let's just show the current folder name
        // TODO: Implement full path resolution
        const folder = await getFolder(currentPath);
        setPathString(folder ? `~/${folder.name}` : '?');
      } catch (e) {
        setPathString('?');
      }
    };
    updatePathString();
  }, [currentPath]);

  const addToHistory = useCallback((cmd: string) => {
    if (cmd.trim()) {
      setHistory(prev => {
        const newHistory = [...prev, cmd];
        // Keep last 100 commands
        return newHistory.slice(-100);
      });
      setHistoryIndex(-1);
    }
  }, []);

  const clearOutput = useCallback(() => {
    setOutput([]);
  }, []);

  const execute = useCallback(async (cmdInput: string) => {
    if (!cmdInput.trim()) return;

    setIsProcessing(true);
    
    // Echo command
    const promptLine: OutputLine = {
      type: 'prompt',
      content: `${pathString} $ ${cmdInput}`,
      timestamp: Date.now()
    };
    
    setOutput(prev => [...prev, promptLine]);
    addToHistory(cmdInput);

    try {
      // Handle piping
      const commands = cmdInput.split('|');
      let currentStdin: string[] | undefined = undefined;
      let finalResult: CommandResult | undefined = undefined;

      for (let i = 0; i < commands.length; i++) {
        const cmdPart = commands[i];
        
        // Pass stdin only if it's not the first command
        const context: ShellContext = {
          currentPath,
          setCurrentPath,
          pathString,
          stdin: i > 0 ? currentStdin : undefined
        };

        const result = await parseAndExecute(cmdPart, context);
        
        // If any command returns an error, stop the chain and show the error
        const hasError = result.output.some(l => l.type === 'error');
        if (hasError) {
          finalResult = result;
          break;
        }

        // Prepare stdin for next command
        // We accept all output types as input for now
        if (i < commands.length - 1) {
           currentStdin = result.output.map(l => l.content);
        }
        
        finalResult = result;
      }

      if (finalResult) {
        if (finalResult.shouldClear) {
          clearOutput();
        } else {
          setOutput(prev => [...prev, ...finalResult.output]);
        }
        return finalResult;
      }
      
    } catch (error) {
      setOutput(prev => [...prev, {
        type: 'error',
        content: `Shell Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [currentPath, pathString, addToHistory, clearOutput]);

  return {
    history,
    historyIndex,
    setHistoryIndex,
    output,
    currentPath,
    pathString,
    isProcessing,
    execute,
    clearOutput
  };
}
