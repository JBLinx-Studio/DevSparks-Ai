import React, { useState, useEffect } from 'react';
import { Project } from '../../types';
import { Button } from '../ui/Button';
import { Play, Eye, Code, Terminal, Settings } from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { Console } from './Console';

interface EditorPanelProps {
  currentProject: Project | null;
  currentFile: string | null;
  onFileUpdate: (path: string, content: string) => void;
  onPreview: () => void;
}

export function EditorPanel({ 
  currentProject, 
  currentFile, 
  onFileUpdate, 
  onPreview 
}: EditorPanelProps) {
  const [activeTab, setActiveTab] = useState<'editor' | 'console' | 'settings'>('editor');
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);

  const currentFileContent = currentProject && currentFile 
    ? currentProject.files[currentFile]?.content || ''
    : '';

  const handleCodeChange = (newContent: string) => {
    if (currentProject && currentFile) {
      onFileUpdate(currentFile, newContent);
    }
  };

  const handleBuildAndPreview = async () => {
    if (!currentProject) return;
    
    setConsoleOutput(prev => [...prev, 'Starting build process...']);
    
    try {
      // Here we would integrate with esbuild-wasm for actual compilation
      setConsoleOutput(prev => [...prev, 'Building project files...']);
      setConsoleOutput(prev => [...prev, 'Transpiling TypeScript/JSX...']);
      setConsoleOutput(prev => [...prev, 'Bundling dependencies...']);
      setConsoleOutput(prev => [...prev, 'Build completed successfully']);
      
      onPreview();
    } catch (error) {
      setConsoleOutput(prev => [...prev, `Build failed: ${error}`]);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Editor Header */}
      <div className="h-12 border-b border-border px-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <Button
              variant={activeTab === 'editor' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('editor')}
              className="flex items-center space-x-2"
            >
              <Code className="w-4 h-4" />
              <span>Editor</span>
            </Button>
            
            <Button
              variant={activeTab === 'console' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('console')}
              className="flex items-center space-x-2"
            >
              <Terminal className="w-4 h-4" />
              <span>Console</span>
            </Button>
            
            <Button
              variant={activeTab === 'settings' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('settings')}
              className="flex items-center space-x-2"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </Button>
          </div>

          {currentFile && (
            <div className="text-sm text-muted-foreground">
              {currentFile}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreview}
            className="flex items-center space-x-2"
          >
            <Eye className="w-4 h-4" />
            <span>Preview</span>
          </Button>
          
          <Button
            variant="primary"
            size="sm"
            onClick={handleBuildAndPreview}
            className="flex items-center space-x-2"
            disabled={!currentProject}
          >
            <Play className="w-4 h-4" />
            <span>Build & Preview</span>
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1">
        {activeTab === 'editor' && (
          <CodeEditor
            value={currentFileContent}
            onChange={handleCodeChange}
            language={getLanguageFromFile(currentFile)}
            readOnly={!currentProject || !currentFile}
          />
        )}
        
        {activeTab === 'console' && (
          <Console
            output={consoleOutput}
            onClear={() => setConsoleOutput([])}
          />
        )}
        
        {activeTab === 'settings' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Editor Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Theme</label>
                <select className="w-full p-2 border border-input rounded bg-background">
                  <option>Dark</option>
                  <option>Light</option>
                  <option>Auto</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Font Size</label>
                <select className="w-full p-2 border border-input rounded bg-background">
                  <option>12px</option>
                  <option>14px</option>
                  <option>16px</option>
                  <option>18px</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="wordWrap" defaultChecked />
                <label htmlFor="wordWrap" className="text-sm">Word Wrap</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="autoSave" defaultChecked />
                <label htmlFor="autoSave" className="text-sm">Auto Save</label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getLanguageFromFile(filename: string | null): string {
  if (!filename) return 'plaintext';
  
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, string> = {
    'html': 'html',
    'css': 'css',
    'js': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'jsx': 'javascript',
    'json': 'json',
    'md': 'markdown',
    'yml': 'yaml',
    'yaml': 'yaml'
  };
  
  return languageMap[ext || ''] || 'plaintext';
}