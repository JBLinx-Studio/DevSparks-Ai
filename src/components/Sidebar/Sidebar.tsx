import React from 'react';
import { Project } from '../../types';
import { ProjectList } from './ProjectList';
import { FileTree } from './FileTree';

interface SidebarProps {
  projects: Project[];
  currentProject: Project | null;
  currentFile: string | null;
  onProjectSelect: (project: Project) => void;
  onCreateProject: (name: string, description?: string) => void;
  onFileSelect: (filePath: string) => void;
}

export function Sidebar({
  projects,
  currentProject,
  currentFile,
  onProjectSelect,
  onCreateProject,
  onFileSelect
}: SidebarProps) {
  return (
    <aside className="w-80 border-r border-border bg-card">
      <div className="h-full flex flex-col">
        <ProjectList
          projects={projects}
          currentProject={currentProject}
          onProjectSelect={onProjectSelect}
          onCreateProject={onCreateProject}
        />
        
        {currentProject && (
          <FileTree
            project={currentProject}
            currentFile={currentFile}
            onFileSelect={onFileSelect}
          />
        )}
      </div>
    </aside>
  );
}