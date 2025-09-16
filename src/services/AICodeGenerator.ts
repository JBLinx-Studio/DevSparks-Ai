// AI Code Generation Service - Advanced capabilities beyond WebSim
import { Project, ChatMessage } from '../types';

interface CodeGenerationRequest {
  prompt: string;
  context: {
    currentFile?: string;
    selectedCode?: string;
    projectFiles: Record<string, any>;
    framework: string;
  };
  options: {
    generateTests?: boolean;
    includeComments?: boolean;
    optimizePerformance?: boolean;
    followBestPractices?: boolean;
  };
}

interface CodeGenerationResult {
  success: boolean;
  files: Record<string, string>;
  suggestions: string[];
  improvements: string[];
  errors: string[];
  explanation: string;
}

export class AICodeGenerator {
  private static instance: AICodeGenerator;
  private puterAI: any;

  static getInstance(): AICodeGenerator {
    if (!AICodeGenerator.instance) {
      AICodeGenerator.instance = new AICodeGenerator();
    }
    return AICodeGenerator.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Puter AI connection
      if ((window as any).lovablePuter) {
        this.puterAI = (window as any).lovablePuter.ai;
        console.log('AI Code Generator initialized with Puter AI');
      } else {
        throw new Error('Puter AI not available');
      }
    } catch (error) {
      console.error('Failed to initialize AI Code Generator:', error);
      throw error;
    }
  }

  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    await this.initialize();

    try {
      const prompt = this.buildPrompt(request);
      
      const response = await this.puterAI.chat([
        {
          role: 'system',
          content: `You are VisionStack AI, an advanced code generation assistant similar to Lovable. 
          You generate high-quality, production-ready code with proper TypeScript types, React best practices, 
          and modern web development patterns. Always provide complete, working code that follows the project's 
          existing patterns and architecture.`
        },
        {
          role: 'user',
          content: prompt
        }
      ]);

      return this.parseAIResponse(response, request);

    } catch (error) {
      return {
        success: false,
        files: {},
        suggestions: [],
        improvements: [],
        errors: [`AI Generation failed: ${error}`],
        explanation: 'Failed to generate code due to AI service error.'
      };
    }
  }

  private buildPrompt(request: CodeGenerationRequest): string {
    const { prompt, context, options } = request;
    
    let systemPrompt = `Generate code for: ${prompt}\n\n`;
    
    // Add context information
    systemPrompt += `Project Context:
- Framework: ${context.framework}
- Current file: ${context.currentFile || 'N/A'}
- Selected code: ${context.selectedCode ? 'Yes' : 'No'}

`;

    // Add existing files context
    systemPrompt += `Existing Files:\n`;
    Object.entries(context.projectFiles).forEach(([path, file]) => {
      systemPrompt += `${path}:\n\`\`\`\n${(file.content || '').substring(0, 500)}\n\`\`\`\n\n`;
    });

    // Add options
    if (options.generateTests) {
      systemPrompt += `- Include comprehensive tests\n`;
    }
    if (options.includeComments) {
      systemPrompt += `- Add detailed comments and documentation\n`;
    }
    if (options.optimizePerformance) {
      systemPrompt += `- Optimize for performance (memoization, lazy loading, etc.)\n`;
    }
    if (options.followBestPractices) {
      systemPrompt += `- Follow React and TypeScript best practices\n`;
    }

    systemPrompt += `
Please provide:
1. Complete working code files
2. Explanations for architectural decisions
3. Suggestions for improvements
4. Any additional files needed

Format your response as JSON:
{
  "files": {
    "path/to/file.tsx": "file content"
  },
  "explanation": "What was created and why",
  "suggestions": ["suggestion 1", "suggestion 2"],
  "improvements": ["improvement 1", "improvement 2"]
}`;

    return systemPrompt;
  }

  private parseAIResponse(response: any, request: CodeGenerationRequest): CodeGenerationResult {
    try {
      // Extract JSON from AI response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        success: true,
        files: parsed.files || {},
        suggestions: parsed.suggestions || [],
        improvements: parsed.improvements || [],
        errors: [],
        explanation: parsed.explanation || 'Code generated successfully'
      };

    } catch (error) {
      return {
        success: false,
        files: {},
        suggestions: [],
        improvements: [],
        errors: [`Failed to parse AI response: ${error}`],
        explanation: 'AI response could not be processed'
      };
    }
  }

  async generateComponent(
    componentName: string, 
    requirements: string, 
    project: Project
  ): Promise<CodeGenerationResult> {
    return this.generateCode({
      prompt: `Create a React component named ${componentName} that ${requirements}`,
      context: {
        projectFiles: project.files,
        framework: project.framework || 'React'
      },
      options: {
        generateTests: true,
        includeComments: true,
        followBestPractices: true
      }
    });
  }

  async generatePage(
    pageName: string, 
    requirements: string, 
    project: Project
  ): Promise<CodeGenerationResult> {
    return this.generateCode({
      prompt: `Create a complete page component named ${pageName} that ${requirements}. Include routing setup if needed.`,
      context: {
        projectFiles: project.files,
        framework: project.framework || 'React'
      },
      options: {
        generateTests: true,
        includeComments: true,
        followBestPractices: true,
        optimizePerformance: true
      }
    });
  }

  async generateAPI(
    endpoint: string, 
    functionality: string, 
    project: Project
  ): Promise<CodeGenerationResult> {
    return this.generateCode({
      prompt: `Create API endpoint ${endpoint} that ${functionality}. Include proper error handling and validation.`,
      context: {
        projectFiles: project.files,
        framework: project.framework || 'React'
      },
      options: {
        generateTests: true,
        includeComments: true,
        followBestPractices: true
      }
    });
  }

  async refactorCode(
    filePath: string, 
    currentCode: string, 
    refactorGoals: string, 
    project: Project
  ): Promise<CodeGenerationResult> {
    return this.generateCode({
      prompt: `Refactor the following code to ${refactorGoals}`,
      context: {
        currentFile: filePath,
        selectedCode: currentCode,
        projectFiles: project.files,
        framework: project.framework || 'React'
      },
      options: {
        includeComments: true,
        followBestPractices: true,
        optimizePerformance: true
      }
    });
  }

  async explainCode(
    code: string, 
    context?: string
  ): Promise<string> {
    await this.initialize();

    try {
      const response = await this.puterAI.chat([
        {
          role: 'system',
          content: 'You are a code explanation expert. Explain code clearly and concisely, highlighting key concepts and patterns.'
        },
        {
          role: 'user',
          content: `Explain this code${context ? ` in the context of ${context}` : ''}:\n\n\`\`\`\n${code}\n\`\`\``
        }
      ]);

      return response;

    } catch (error) {
      return `Failed to explain code: ${error}`;
    }
  }

  async suggestImprovements(
    project: Project
  ): Promise<string[]> {
    await this.initialize();

    try {
      const projectSummary = this.createProjectSummary(project);
      
      const response = await this.puterAI.chat([
        {
          role: 'system',
          content: 'You are a code review expert. Analyze projects and suggest concrete improvements for code quality, performance, and architecture.'
        },
        {
          role: 'user',
          content: `Analyze this project and suggest improvements:\n\n${projectSummary}`
        }
      ]);

      // Parse suggestions from response
      const suggestions = response.split('\n')
        .filter((line: string) => line.trim().startsWith('-') || line.trim().startsWith('*'))
        .map((line: string) => line.trim().replace(/^[-*]\s*/, ''));

      return suggestions.slice(0, 10); // Limit to top 10 suggestions

    } catch (error) {
      return [`Failed to generate suggestions: ${error}`];
    }
  }

  private createProjectSummary(project: Project): string {
    let summary = `Project: ${project.name}\n`;
    summary += `Framework: ${project.framework || 'React'}\n`;
    summary += `Entry Point: ${project.entryPoint}\n\n`;
    
    summary += `Files:\n`;
    Object.entries(project.files).forEach(([path, file]) => {
      summary += `${path} (${(file.content || '').length} chars)\n`;
    });

    return summary;
  }
}