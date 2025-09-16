import React, { useEffect, useRef } from 'react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  readOnly?: boolean;
}

export function CodeEditor({ value, onChange, language, readOnly = false }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoRef = useRef<any>(null);

  useEffect(() => {
    if (editorRef.current && (window as any).monaco) {
      // Initialize Monaco Editor
      const monaco = (window as any).monaco;
      
      if (!monacoRef.current) {
        monacoRef.current = monaco.editor.create(editorRef.current, {
          value: value,
          language: language,
          theme: 'vs-dark',
          automaticLayout: true,
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          readOnly: readOnly,
          minimap: { enabled: false },
          folding: true,
          wordWrap: 'on',
          tabSize: 2,
          insertSpaces: true,
        });

        // Listen for content changes
        monacoRef.current.onDidChangeModelContent(() => {
          const newValue = monacoRef.current.getValue();
          onChange(newValue);
        });
      }
    } else if (!readOnly) {
      // Fallback to textarea if Monaco is not available
      return (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-full p-4 font-mono text-sm bg-slate-900 text-gray-100 border-none outline-none resize-none"
          placeholder="Start typing your code..."
          spellCheck={false}
        />
      );
    }
  }, [language]);

  // Update editor value when prop changes
  useEffect(() => {
    if (monacoRef.current && monacoRef.current.getValue() !== value) {
      monacoRef.current.setValue(value);
    }
  }, [value]);

  // Update editor language when prop changes
  useEffect(() => {
    if (monacoRef.current) {
      const model = monacoRef.current.getModel();
      if (model) {
        (window as any).monaco.editor.setModelLanguage(model, language);
      }
    }
  }, [language]);

  // Update read-only state
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.updateOptions({ readOnly });
    }
  }, [readOnly]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (monacoRef.current) {
        monacoRef.current.dispose();
        monacoRef.current = null;
      }
    };
  }, []);

  if (readOnly && !value) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="text-lg mb-2">No file selected</div>
          <div className="text-sm">Select a file from the sidebar to start editing</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <div ref={editorRef} className="absolute inset-0" />
    </div>
  );
}