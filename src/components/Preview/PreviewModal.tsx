import React, { useState, useRef, useEffect } from 'react';
import { Project, PreviewConfig } from '../../types';
import { Button } from '../ui/Button';
import { 
  X, 
  Maximize2, 
  RotateCcw, 
  ExternalLink, 
  Monitor, 
  Tablet, 
  Smartphone 
} from 'lucide-react';
import { CompilerService } from '../ai/CompilerService';

interface PreviewModalProps {
  project: Project | null;
  previewConfig: PreviewConfig;
  onClose: () => void;
  onModeChange: (mode: 'desktop' | 'tablet' | 'mobile') => void;
}

export function PreviewModal({ 
  project, 
  previewConfig, 
  onClose, 
  onModeChange 
}: PreviewModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (project) {
      generatePreview();
    }
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [project]);

  const generatePreview = async () => {
    if (!project) return;

    try {
      let htmlContent = '';
      if (hasAdvancedSources(project)) {
        const compiler = CompilerService.getInstance();
        htmlContent = await compiler.generatePreviewHTML(project);
      } else {
        htmlContent = generatePreviewHTML(project);
      }
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    }
  };

  const generatePreviewHTML = (project: Project): string => {
    const entryFile = project.files[project.entryPoint || 'index.html'];
    
    if (!entryFile) {
      return `
        <!DOCTYPE html>
        <html>
        <head><title>Preview Error</title></head>
        <body>
          <div style="padding: 20px; font-family: Arial;">
            <h2>No entry point found</h2>
            <p>Please make sure your project has an index.html file or set an entry point.</p>
          </div>
        </body>
        </html>
      `;
    }

    let html = entryFile.content;

    // Inject CSS files
    Object.entries(project.files).forEach(([path, file]) => {
      if (path.endsWith('.css')) {
        const cssTag = `<style>/* ${path} */\n${file.content}\n</style>`;
        html = html.replace('</head>', `${cssTag}\n</head>`);
      }
    });

    // Inject JS files
    Object.entries(project.files).forEach(([path, file]) => {
      if (path.endsWith('.js') && path !== project.entryPoint) {
        const scriptTag = `<script>/* ${path} */\n${file.content}\n</script>`;
        html = html.replace('</body>', `${scriptTag}\n</body>`);
      }
    });

    return html;
  };

  function hasAdvancedSources(project: Project): boolean {
    return Object.keys(project.files).some((p) => /\.(ts|tsx|jsx)$/.test(p));
  }


  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleOpenInNewWindow = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  const getPreviewDimensions = () => {
    switch (previewConfig.mode) {
      case 'mobile':
        return { width: '375px', height: '667px' };
      case 'tablet':
        return { width: '768px', height: '1024px' };
      default:
        return { width: '100%', height: '100%' };
    }
  };

  const dimensions = getPreviewDimensions();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className={`bg-white rounded-lg shadow-2xl ${
        isFullscreen ? 'w-full h-full' : 'w-[90vw] h-[90vh] max-w-6xl'
      }`}>
        {/* Preview Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold">
              Preview: {project?.name || 'Untitled'}
            </h3>
            
            <div className="flex items-center space-x-1">
              <Button
                variant={previewConfig.mode === 'desktop' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onModeChange('desktop')}
              >
                <Monitor className="w-4 h-4" />
              </Button>
              <Button
                variant={previewConfig.mode === 'tablet' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onModeChange('tablet')}
              >
                <Tablet className="w-4 h-4" />
              </Button>
              <Button
                variant={previewConfig.mode === 'mobile' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onModeChange('mobile')}
              >
                <Smartphone className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RotateCcw className="w-4 h-4" />
            </Button>
            
            <Button variant="outline" size="sm" onClick={handleOpenInNewWindow}>
              <ExternalLink className="w-4 h-4" />
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 p-4 bg-gray-50 overflow-auto">
          <div 
            className="mx-auto bg-white shadow-lg"
            style={{
              width: dimensions.width,
              height: previewConfig.mode === 'desktop' ? 'calc(90vh - 200px)' : dimensions.height,
              minHeight: '400px'
            }}
          >
            {previewUrl ? (
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="w-full h-full border-0 rounded"
                title="Preview"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="text-lg mb-2">Generating preview...</div>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview Footer */}
        <div className="px-4 py-2 border-t bg-gray-50 text-sm text-gray-600">
          <div className="flex items-center justify-between">
            <div>
              Mode: {previewConfig.mode} 
              {previewConfig.mode !== 'desktop' && (
                <span className="ml-2">
                  ({dimensions.width} × {dimensions.height})
                </span>
              )}
            </div>
            <div>
              {Object.keys(project?.files || {}).length} files
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}