import React from 'react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  readOnly?: boolean;
}

// Simple, reliable textarea-based editor (we can upgrade to Monaco later)
export function CodeEditor({ value, onChange, language, readOnly = false }: CodeEditorProps) {
  return (
    <div className="flex-1 h-full">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        className="w-full h-full p-4 font-mono text-sm bg-card text-foreground border-none outline-none resize-none"
        placeholder="Start typing your code..."
      />
    </div>
  );
}