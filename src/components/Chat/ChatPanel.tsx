import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Project } from '../../types';
import { ProjectTemplate } from '../../services/ProjectTemplates';
import { Button } from '../ui/Button';
import { Send, Mic, Bot, User, Sparkles, Zap } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  currentProject: Project | null;
  onCreateFromTemplate?: (templateId: string, projectName: string) => void;
  availableTemplates?: ProjectTemplate[];
}

export function ChatPanel({ 
  messages, 
  onSendMessage, 
  currentProject, 
  onCreateFromTemplate,
  availableTemplates = [] 
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleVoiceInput = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(prev => prev + transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } else {
      alert('Speech recognition is not supported in this browser.');
    }
  };

  return (
    <div className="w-96 border-r border-border bg-card flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center space-x-2">
            <Bot className="w-5 h-5 text-primary" />
            <span>VisionStack AI</span>
          </h3>
          {availableTemplates.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
              className="p-1"
            >
              <Sparkles className="w-4 h-4" />
            </Button>
          )}
        </div>
        {currentProject && (
          <p className="text-sm text-muted-foreground mt-1">
            Working on: {currentProject.name}
          </p>
        )}
        
        {/* Template Quick Actions */}
        {showTemplates && availableTemplates.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">Quick Start:</p>
            {availableTemplates.slice(0, 3).map((template) => (
              <Button
                key={template.id}
                variant="ghost"
                size="sm"
                onClick={() => {
                  const projectName = prompt(`Enter project name for ${template.name}:`);
                  if (projectName && onCreateFromTemplate) {
                    onCreateFromTemplate(template.id, projectName);
                  }
                }}
                className="w-full justify-start text-left h-auto p-2"
              >
                <div>
                  <div className="font-medium text-xs">{template.name}</div>
                  <div className="text-xs text-muted-foreground">{template.description}</div>
                </div>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex space-x-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}
            
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">
                {message.isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-pulse">Thinking...</div>
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                ) : (
                  message.content
                )}
              </div>
              
              {message.audioUrl && (
                <audio controls className="mt-2 w-full">
                  <source src={message.audioUrl} type="audio/mpeg" />
                </audio>
              )}
              
              <div className="text-xs opacity-70 mt-2">
                {formatTimestamp(message.timestamp)}
              </div>
            </div>

            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe what you want to build..."
              className="w-full p-3 pr-12 border border-input rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={2}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleVoiceInput}
              className={`absolute right-2 top-2 p-1 ${
                isListening ? 'text-red-500' : 'text-muted-foreground'
              }`}
              disabled={isListening}
            >
              <Mic className="w-4 h-4" />
            </Button>
          </div>
          
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}