// Core Types for VisionStack AI Web App Creation Platform
export interface Project {
  id: string;
  name: string;
  description: string;
  files: Record<string, ProjectFile>;
  createdAt: string;
  updatedAt: string;
  entryPoint?: string;
}

export interface ProjectFile {
  path: string;
  content: string;
  type: FileType;
  size: number;
  lastModified: string;
}

export type FileType = 
  | 'html' 
  | 'css' 
  | 'javascript' 
  | 'typescript' 
  | 'jsx' 
  | 'tsx' 
  | 'json' 
  | 'markdown' 
  | 'text' 
  | 'image' 
  | 'other';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  audioUrl?: string;
  isLoading?: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  type: 'websim' | 'puter' | 'custom';
  model?: string;
}

export interface BuildOptions {
  minify?: boolean;
  sourcemap?: boolean;
  target?: string;
  format?: 'esm' | 'cjs' | 'iife';
}

export interface PreviewConfig {
  mode: 'desktop' | 'tablet' | 'mobile';
  showConsole: boolean;
  autoRefresh: boolean;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  provider: 'websim' | 'puter';
}

// Puter Integration Types
export interface PuterUser {
  id: string;
  username: string;
  email?: string;
}

export interface PuterDiagnostics {
  ok: boolean;
  auth: boolean;
  fs: boolean;
  kv: boolean;
  ai: boolean;
}

// Application State
export interface AppState {
  currentProject: Project | null;
  projects: Project[];
  currentFile: string | null;
  user: User | null;
  puterUser: PuterUser | null;
  isConnected: boolean;
  aiProvider: string;
  chatHistory: ChatMessage[];
  previewConfig: PreviewConfig;
}