import { useState, useEffect, useCallback } from 'react';
import { Project, ChatMessage, User, PuterUser, AppState } from '../types';

// Custom hook to manage VisionStack application state
export function useVisionStack() {
  const [state, setState] = useState<AppState>({
    currentProject: null,
    projects: [],
    currentFile: null,
    user: null,
    puterUser: null,
    isConnected: false,
    aiProvider: 'puter:gpt-5',
    chatHistory: [],
    previewConfig: {
      mode: 'desktop',
      showConsole: false,
      autoRefresh: true
    }
  });

  // Initialize application
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = useCallback(async () => {
    try {
      // Initialize Puter if available
      if ((window as any).lovablePuter) {
        const puterUser = await (window as any).lovablePuter.getUser();
        if (puterUser) {
          setState(prev => ({ 
            ...prev, 
            puterUser, 
            isConnected: true 
          }));
        }
      }

      // Load projects from storage
      await loadProjects();
      
      // Initialize welcome message if no chat history
      if (state.chatHistory.length === 0) {
        addMessage('assistant', 'Welcome to VisionStack! I can help you build React applications with TypeScript, JSX, and more. What would you like to create today?');
      }
    } catch (error) {
      console.error('Failed to initialize VisionStack:', error);
    }
  }, [state.chatHistory.length]);

  const loadProjects = useCallback(async () => {
    try {
      let projects: Project[] = [];
      
      // Try to load from Puter first
      if (state.isConnected && (window as any).lovablePuter) {
        try {
          const puterProjects = await loadProjectsFromPuter();
          projects = puterProjects;
        } catch (error) {
          console.warn('Failed to load from Puter, using local storage:', error);
        }
      }
      
      // Fallback to localStorage
      if (projects.length === 0) {
        projects = loadProjectsFromLocal();
      }

      setState(prev => ({ ...prev, projects }));
      
      // Load first project if available
      if (projects.length > 0 && !state.currentProject) {
        await loadProject(projects[0]);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }, [state.isConnected, state.currentProject]);

  const loadProjectsFromLocal = (): Project[] => {
    try {
      const stored = localStorage.getItem('visionstack-projects');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const loadProjectsFromPuter = async (): Promise<Project[]> => {
    // Implementation for Puter project loading
    try {
      const data = await (window as any).lovablePuter.fs.readFile('visionstack/projects.json');
      return JSON.parse(data);
    } catch {
      return [];
    }
  };

  const saveProjectsToLocal = (projects: Project[]) => {
    try {
      localStorage.setItem('visionstack-projects', JSON.stringify(projects));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  };

  const saveProjectsToPuter = async (projects: Project[]) => {
    try {
      await (window as any).lovablePuter.fs.writeFile(
        'visionstack/projects.json', 
        JSON.stringify(projects, null, 2)
      );
    } catch (error) {
      console.error('Failed to save to Puter:', error);
    }
  };

  const createProject = useCallback(async (name: string, description: string = '') => {
    const newProject: Project = {
      id: Date.now().toString(),
      name,
      description,
      files: {
        'index.html': {
          path: 'index.html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    </style>
</head>
<body>
    <h1>Welcome to ${name}</h1>
    <p>Start building your application!</p>
</body>
</html>`,
          type: 'html',
          size: 0,
          lastModified: new Date().toISOString()
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entryPoint: 'index.html'
    };

    const updatedProjects = [...state.projects, newProject];
    setState(prev => ({ 
      ...prev, 
      projects: updatedProjects,
      currentProject: newProject,
      currentFile: 'index.html'
    }));

    // Save to storage
    saveProjectsToLocal(updatedProjects);
    if (state.isConnected) {
      await saveProjectsToPuter(updatedProjects);
    }

    return newProject;
  }, [state.projects, state.isConnected]);

  const loadProject = useCallback(async (project: Project) => {
    setState(prev => ({ 
      ...prev, 
      currentProject: project,
      currentFile: project.entryPoint || Object.keys(project.files)[0] || null
    }));
  }, []);

  const updateFile = useCallback((path: string, content: string) => {
    if (!state.currentProject) return;

    const updatedFiles = {
      ...state.currentProject.files,
      [path]: {
        ...state.currentProject.files[path],
        content,
        lastModified: new Date().toISOString(),
        size: content.length
      }
    };

    const updatedProject = {
      ...state.currentProject,
      files: updatedFiles,
      updatedAt: new Date().toISOString()
    };

    const updatedProjects = state.projects.map(p => 
      p.id === updatedProject.id ? updatedProject : p
    );

    setState(prev => ({ 
      ...prev, 
      currentProject: updatedProject,
      projects: updatedProjects
    }));

    // Save to storage
    saveProjectsToLocal(updatedProjects);
    if (state.isConnected) {
      saveProjectsToPuter(updatedProjects);
    }
  }, [state.currentProject, state.projects, state.isConnected]);

  const addMessage = useCallback((role: 'user' | 'assistant' | 'system', content: string, audioUrl?: string) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date().toISOString(),
      audioUrl
    };

    setState(prev => ({ 
      ...prev, 
      chatHistory: [...prev.chatHistory, message]
    }));
  }, []);

  const setCurrentFile = useCallback((filePath: string) => {
    setState(prev => ({ ...prev, currentFile: filePath }));
  }, []);

  const setPreviewMode = useCallback((mode: 'desktop' | 'tablet' | 'mobile') => {
    setState(prev => ({ 
      ...prev, 
      previewConfig: { ...prev.previewConfig, mode }
    }));
  }, []);

  return {
    ...state,
    createProject,
    loadProject,
    updateFile,
    addMessage,
    setCurrentFile,
    setPreviewMode,
    loadProjects
  };
}