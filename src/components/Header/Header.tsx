import React from 'react';
import { Project, User, PuterUser } from '../../types';
import { Button } from '../ui/Button';
import { Plus, Settings, Github, Cloud } from 'lucide-react';

interface HeaderProps {
  currentProject: Project | null;
  user: User | null;
  puterUser: PuterUser | null;
  isConnected: boolean;
  onCreateProject: () => void;
}

export function Header({ 
  currentProject, 
  user, 
  puterUser, 
  isConnected, 
  onCreateProject 
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h1 className="text-2xl font-bold text-primary">VisionStack</h1>
        {currentProject && (
          <div className="text-sm text-muted-foreground">
            {currentProject.name}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateProject}
          className="flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </Button>

        <Button variant="outline" size="sm">
          <Github className="w-4 h-4" />
        </Button>

        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4" />
        </Button>

        <div className="flex items-center space-x-2 text-sm">
          <Cloud className={`w-4 h-4 ${isConnected ? 'text-green-500' : 'text-gray-400'}`} />
          <span className={isConnected ? 'text-green-600' : 'text-gray-500'}>
            {isConnected ? 
              (puterUser ? `Puter: ${puterUser.username}` : 'Connected') : 
              'Local'
            }
          </span>
        </div>
      </div>
    </header>
  );
}