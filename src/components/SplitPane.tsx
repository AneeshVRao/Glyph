import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialSplit?: number; // percentage (0-100)
  minSize?: number; // pixels
  onSplitChange?: (split: number) => void;
  className?: string; // Container className
}

export default function SplitPane({
  left,
  right,
  initialSplit = 50,
  minSize = 200,
  onSplitChange,
  className
}: SplitPaneProps) {
  const [split, setSplit] = useState(initialSplit);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      
      let newSplit = (x / width) * 100;
      
      // Constraints (convert minSize to percentage approx or just check output px)
      // Simpler: Clamp percentage to roughly minSize/width
      const minPct = (minSize / width) * 100;
      newSplit = Math.max(minPct, Math.min(100 - minPct, newSplit));

      setSplit(newSplit);
      onSplitChange?.(newSplit);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Optional: Add a class to body to force cursor style
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, minSize, onSplitChange]);

  return (
    <div 
      ref={containerRef} 
      className={cn("flex w-full h-full overflow-hidden", className)}
    >
      <div 
        className="h-full overflow-hidden" 
        style={{ width: `${split}%` }}
      >
        {left}
      </div>

      <div
        className="w-1 h-full cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors bg-border/30 z-50 flex-shrink-0 relative group"
        onMouseDown={handleMouseDown}
      >
          {/* Drag Handle Visual */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-border group-hover:bg-primary/70 rounded-full" />
      </div>

      <div 
        className="h-full overflow-hidden flex-1" 
         /* Use flex-1 instead of width calculation to autofill rest */
      >
        {right}
      </div>
    </div>
  );
}
