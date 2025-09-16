import React, { useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Trash2, Download } from 'lucide-react';

interface ConsoleProps {
  output: string[];
  onClear: () => void;
}

export function Console({ output, onClear }: ConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  const handleExport = () => {
    const content = output.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-output-${new Date().toISOString().slice(0, 19)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = () => {
    return new Date().toLocaleTimeString();
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-gray-100">
      {/* Console Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="text-sm font-medium">Console Output</div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="text-gray-300 hover:text-white"
            disabled={output.length === 0}
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-gray-300 hover:text-white"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Console Content */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1"
      >
        {output.length === 0 ? (
          <div className="text-gray-500 italic">Console is empty. Build output will appear here.</div>
        ) : (
          output.map((line, index) => (
            <div key={index} className="flex items-start space-x-3">
              <span className="text-gray-500 text-xs min-w-[60px]">
                {formatTimestamp()}
              </span>
              <span className={getLineStyle(line)}>
                {line}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Console Input */}
      <div className="border-t border-gray-700 p-3">
        <div className="flex items-center space-x-2">
          <span className="text-green-400">$</span>
          <input
            type="text"
            placeholder="Type a command..."
            className="flex-1 bg-transparent border-none outline-none text-gray-100 placeholder-gray-500"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                const input = e.currentTarget.value.trim();
                if (input) {
                  // Handle console commands here
                  console.log('Console command:', input);
                  e.currentTarget.value = '';
                }
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function getLineStyle(line: string): string {
  if (line.toLowerCase().includes('error')) {
    return 'text-red-400';
  } else if (line.toLowerCase().includes('warn')) {
    return 'text-yellow-400';
  } else if (line.toLowerCase().includes('success') || line.toLowerCase().includes('completed')) {
    return 'text-green-400';
  } else if (line.toLowerCase().includes('info')) {
    return 'text-blue-400';
  }
  return 'text-gray-300';
}