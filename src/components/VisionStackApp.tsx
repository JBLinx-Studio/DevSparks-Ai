import React, { useState } from 'react';
import { useVisionStack } from '../hooks/useVisionStack';
import { Header } from './Header/Header';
import { Sidebar } from './Sidebar/Sidebar';
import { ChatPanel } from './Chat/ChatPanel';
import { EditorPanel } from './Editor/EditorPanel';
import { PreviewModal } from './Preview/PreviewModal';
import { ProjectTemplateService } from '../services/ProjectTemplates';
import { AdvancedCompiler } from '../services/AdvancedCompiler';
import { AICodeGenerator } from '../services/AICodeGenerator';

export function VisionStackApp() {
  const visionStack = useVisionStack();
  const [showPreview, setShowPreview] = useState(false);

  // Initialize advanced services
  React.useEffect(() => {
    const initServices = async () => {
      try {
        await AdvancedCompiler.getInstance().initialize();
        await AICodeGenerator.getInstance().initialize();
        console.log('Advanced VisionStack services initialized');
      } catch (error) {
        console.error('Failed to initialize advanced services:', error);
      }
    };
    
    initServices();
  }, []);

  const handleCreateProjectFromTemplate = async (templateId: string, projectName: string) => {
    try {
      const project = ProjectTemplateService.createProjectFromTemplate(templateId, projectName);
      await visionStack.createProject(project.name, project.description);
      // Update with template files
      Object.entries(project.files).forEach(([path, file]) => {
        visionStack.updateFile(path, file.content);
      });
      visionStack.addMessage('assistant', `Created ${projectName} from ${templateId} template with advanced features!`);
    } catch (error) {
      visionStack.addMessage('assistant', `Failed to create project: ${error}`);
    }
  };

  const handleAICodeGeneration = async (prompt: string) => {
    if (!visionStack.currentProject) return;
    
    try {
      const aiGenerator = AICodeGenerator.getInstance();
      const result = await aiGenerator.generateCode({
        prompt,
        context: {
          currentFile: visionStack.currentFile,
          projectFiles: visionStack.currentProject.files,
          framework: visionStack.currentProject.framework || 'React'
        },
        options: {
          generateTests: true,
          includeComments: true,
          followBestPractices: true
        }
      });

      if (result.success) {
        // Apply generated files
        Object.entries(result.files).forEach(([path, content]) => {
          visionStack.updateFile(path, content);
        });
        
        let response = result.explanation;
        if (result.suggestions.length > 0) {
          response += '\n\nSuggestions:\n' + result.suggestions.map(s => `• ${s}`).join('\n');
        }
        
        visionStack.addMessage('assistant', response);
      } else {
        visionStack.addMessage('assistant', `Code generation failed: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      visionStack.addMessage('assistant', `AI code generation error: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header 
        currentProject={visionStack.currentProject}
        user={visionStack.user}
        puterUser={visionStack.puterUser}
        isConnected={visionStack.isConnected}
        onCreateProject={() => visionStack.createProject('New Project')}
      />
      
      <main className="flex h-[calc(100vh-4rem)]">
        <Sidebar 
          projects={visionStack.projects}
          currentProject={visionStack.currentProject}
          currentFile={visionStack.currentFile}
          onProjectSelect={visionStack.loadProject}
          onCreateProject={visionStack.createProject}
          onFileSelect={visionStack.setCurrentFile}
        />
        
        <div className="flex flex-1">
          <ChatPanel 
            messages={visionStack.chatHistory}
            onSendMessage={(message) => {
              visionStack.addMessage('user', message);
              // Check if this is an AI code generation request
              if (message.toLowerCase().includes('create') || 
                  message.toLowerCase().includes('generate') || 
                  message.toLowerCase().includes('build') ||
                  message.toLowerCase().includes('add')) {
                handleAICodeGeneration(message);
              }
            }}
            onCreateFromTemplate={handleCreateProjectFromTemplate}
            availableTemplates={ProjectTemplateService.getAllTemplates()}
            currentProject={visionStack.currentProject}
          />
          
          <EditorPanel 
            currentProject={visionStack.currentProject}
            currentFile={visionStack.currentFile}
            onFileUpdate={visionStack.updateFile}
            onPreview={() => setShowPreview(true)}
            onFileSelect={visionStack.setCurrentFile}
          />
        </div>
      </main>

      {showPreview && (
        <PreviewModal
          project={visionStack.currentProject}
          previewConfig={visionStack.previewConfig}
          onClose={() => setShowPreview(false)}
          onModeChange={visionStack.setPreviewMode}
        />
      )}
    </div>
  );
}