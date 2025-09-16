import React, { useState } from 'react';
import { Project, ProjectFile } from '../../types';
import { Button } from '../ui/Button';
import { 
  File, 
  FileText, 
  Code, 
  Image, 
  Plus, 
  ChevronRight, 
  ChevronDown,
  Trash2
} from 'lucide-react';
import { getFileType } from '../../lib/utils';

interface FileTreeProps {
  project: Project;
  currentFile: string | null;
  onFileSelect: (filePath: string) => void;
}

export function FileTree({ project, currentFile, onFileSelect }: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showAddFile, setShowAddFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const getFileIcon = (file: ProjectFile) => {
    const type = getFileType(file.path);
    switch (type) {
      case 'html':
      case 'jsx':
      case 'tsx':
        return <Code className="w-4 h-4 text-blue-500" />;
      case 'css':
        return <Code className="w-4 h-4 text-purple-500" />;
      case 'javascript':
      case 'typescript':
        return <Code className="w-4 h-4 text-yellow-500" />;
      case 'json':
        return <FileText className="w-4 h-4 text-green-500" />;
      case 'image':
        return <Image className="w-4 h-4 text-pink-500" />;
      default:
        return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  const handleAddFile = () => {
    if (newFileName.trim()) {
      // Create new file in project
      const newFile: ProjectFile = {
        path: newFileName.trim(),
        content: '',
        type: getFileType(newFileName.trim()) as any,
        size: 0,
        lastModified: new Date().toISOString()
      };

      // This would need to be passed up to the parent to update the project
      console.log('Add file:', newFile);
      
      setNewFileName('');
      setShowAddFile(false);
    }
  };

  // Organize files into folders
  const organizeFiles = (files: Record<string, ProjectFile>) => {
    const organized: { [key: string]: { files: ProjectFile[], folders: any } } = {
      files: [],
      folders: {}
    };

    Object.values(files).forEach(file => {
      const parts = file.path.split('/');
      if (parts.length === 1) {
        // Root level file
        organized.files.push(file);
      } else {
        // File in folder - simplified for now, just show all files
        organized.files.push(file);
      }
    });

    return organized;
  };

  const organizedFiles = organizeFiles(project.files);

  return (
    <div className="flex-1 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Files</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddFile(true)}
          className="flex items-center space-x-2"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      {showAddFile && (
        <div className="mb-4 p-3 border border-border rounded-lg bg-muted/50">
          <input
            type="text"
            placeholder="filename.ext"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            className="w-full p-2 mb-2 text-sm border border-input rounded bg-background"
            onKeyPress={(e) => e.key === 'Enter' && handleAddFile()}
          />
          <div className="flex space-x-2">
            <Button size="sm" onClick={handleAddFile}>
              Add
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setShowAddFile(false);
                setNewFileName('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {organizedFiles.files.map((file) => (
          <div
            key={file.path}
            onClick={() => onFileSelect(file.path)}
            className={`flex items-center space-x-2 p-2 rounded cursor-pointer transition-colors group ${
              currentFile === file.path
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-muted/50 text-foreground'
            }`}
          >
            {getFileIcon(file)}
            <span className="flex-1 text-sm truncate">{file.path}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                // Handle delete file
                console.log('Delete file:', file.path);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
            >
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {Object.keys(project.files).length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <File className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No files yet</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddFile(true)}
            className="mt-2"
          >
            Add your first file
          </Button>
        </div>
      )}
    </div>
  );
}