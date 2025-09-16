import React, { useState } from 'react';
import { useVisionStack } from '../hooks/useVisionStack';
import { Header } from './Header/Header';
import { Sidebar } from './Sidebar/Sidebar';
import { ChatPanel } from './Chat/ChatPanel';
import { EditorPanel } from './Editor/EditorPanel';
import { PreviewModal } from './Preview/PreviewModal';

export function VisionStackApp() {
  const visionStack = useVisionStack();
  const [showPreview, setShowPreview] = useState(false);

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
            onSendMessage={(message) => visionStack.addMessage('user', message)}
            currentProject={visionStack.currentProject}
          />
          
          <EditorPanel 
            currentProject={visionStack.currentProject}
            currentFile={visionStack.currentFile}
            onFileUpdate={visionStack.updateFile}
            onPreview={() => setShowPreview(true)}
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