import React, { useState } from 'react';
import { Project } from '../../types';
import { Button } from '../ui/Button';
import { Plus, Folder, Clock } from 'lucide-react';

interface ProjectListProps {
  projects: Project[];
  currentProject: Project | null;
  onProjectSelect: (project: Project) => void;
  onCreateProject: (name: string, description?: string) => void;
}

export function ProjectList({
  projects,
  currentProject,
  onProjectSelect,
  onCreateProject
}: ProjectListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim(), newProjectDescription.trim());
      setNewProjectName('');
      setNewProjectDescription('');
      setShowCreateForm(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="p-4 border-b border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Projects</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreateForm(true)}
          className="flex items-center space-x-2"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      {showCreateForm && (
        <div className="mb-4 p-3 border border-border rounded-lg bg-muted/50">
          <input
            type="text"
            placeholder="Project name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            className="w-full p-2 mb-2 text-sm border border-input rounded bg-background"
            onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
          />
          <textarea
            placeholder="Description (optional)"
            value={newProjectDescription}
            onChange={(e) => setNewProjectDescription(e.target.value)}
            className="w-full p-2 mb-2 text-sm border border-input rounded bg-background resize-none"
            rows={2}
          />
          <div className="flex space-x-2">
            <Button size="sm" onClick={handleCreateProject}>
              Create
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setShowCreateForm(false);
                setNewProjectName('');
                setNewProjectDescription('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => onProjectSelect(project)}
            className={`p-3 rounded-lg cursor-pointer transition-colors ${
              currentProject?.id === project.id
                ? 'bg-primary/10 border border-primary/20'
                : 'hover:bg-muted/50'
            }`}
          >
            <div className="flex items-start space-x-2">
              <Folder className="w-4 h-4 mt-0.5 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-foreground truncate">
                  {project.name}
                </div>
                {project.description && (
                  <div className="text-xs text-muted-foreground truncate mt-1">
                    {project.description}
                  </div>
                )}
                <div className="flex items-center space-x-2 mt-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(project.updatedAt)}</span>
                  <span>•</span>
                  <span>{Object.keys(project.files).length} files</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && !showCreateForm && (
        <div className="text-center py-8 text-muted-foreground">
          <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No projects yet</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateForm(true)}
            className="mt-2"
          >
            Create your first project
          </Button>
        </div>
      )}
    </div>
  );
}