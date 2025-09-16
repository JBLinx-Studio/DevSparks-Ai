// Enhanced Compiler Service with esbuild-wasm integration
import * as esbuild from 'esbuild-wasm';
import { Project, BuildOptions } from '../../types';

interface CompilerOptions {
  minify?: boolean;
  sourcemap?: boolean;
  target?: string;
  format?: 'esm' | 'cjs' | 'iife';
  external?: string[];
  jsx?: 'transform' | 'preserve';
  jsxFactory?: string;
  jsxFragment?: string;
}

interface CompilerResult {
  success: boolean;
  code?: string;
  map?: string;
  errors: string[];
  warnings: string[];
  assets?: Record<string, string>;
}

export class CompilerService {
  private static instance: CompilerService | null = null;
  private initialized = false;
  private esbuildPromise: Promise<void> | null = null;

  static getInstance(): CompilerService {
    if (!CompilerService.instance) {
      CompilerService.instance = new CompilerService();
    }
    return CompilerService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    if (!this.esbuildPromise) {
      this.esbuildPromise = this.initializeEsbuild();
    }
    
    await this.esbuildPromise;
    this.initialized = true;
  }

  private async initializeEsbuild(): Promise<void> {
    try {
      await esbuild.initialize({
        wasmURL: 'https://unpkg.com/esbuild-wasm@0.19.0/esbuild.wasm',
        worker: true
      });
      console.log('esbuild-wasm initialized successfully');
    } catch (error) {
      console.error('Failed to initialize esbuild-wasm:', error);
      throw error;
    }
  }

  async compileProject(project: Project, options: CompilerOptions = {}): Promise<CompilerResult> {
    await this.initialize();

    try {
      const entryPoint = project.entryPoint || this.detectEntryPoint(project.files);
      
      if (!entryPoint) {
        return {
          success: false,
          errors: ['No entry point found. Please create an index.html, index.ts, or index.js file.'],
          warnings: []
        };
      }

      // Create virtual file system
      const virtualFS = this.createVirtualFileSystem(project.files);
      
      // Configure esbuild options
      const buildOptions: esbuild.BuildOptions = {
        entryPoints: [entryPoint],
        bundle: true,
        write: false,
        format: options.format || 'esm',
        target: options.target || 'es2020',
        minify: options.minify || false,
        sourcemap: options.sourcemap || false,
        jsx: options.jsx || 'transform',
        jsxFactory: options.jsxFactory || 'React.createElement',
        jsxFragment: options.jsxFragment || 'React.Fragment',
        external: options.external || [],
        plugins: [
          this.createVirtualFilePlugin(virtualFS),
          this.createReactShimPlugin(),
          this.createCSSInlinePlugin()
        ],
        define: {
          'process.env.NODE_ENV': '"development"',
          'global': 'globalThis'
        }
      };

      const result = await esbuild.build(buildOptions);

      const compiledCode = result.outputFiles?.[0]?.text || '';
      const sourceMap = result.outputFiles?.find(f => f.path.endsWith('.map'))?.text;

      return {
        success: result.errors.length === 0,
        code: compiledCode,
        map: sourceMap,
        errors: result.errors.map(err => this.formatError(err)),
        warnings: result.warnings.map(warn => this.formatWarning(warn))
      };

    } catch (error) {
      return {
        success: false,
        errors: [`Compilation failed: ${error}`],
        warnings: []
      };
    }
  }

  private detectEntryPoint(files: Record<string, any>): string | null {
    const candidates = [
      'index.html',
      'index.tsx',
      'index.ts',
      'index.jsx',
      'index.js',
      'src/index.tsx',
      'src/index.ts',
      'src/index.jsx',
      'src/index.js',
      'App.tsx',
      'App.ts',
      'main.tsx',
      'main.ts'
    ];

    for (const candidate of candidates) {
      if (files[candidate]) {
        return candidate;
      }
    }

    // Return first file if no standard entry point found
    const firstFile = Object.keys(files)[0];
    return firstFile || null;
  }

  private createVirtualFileSystem(files: Record<string, any>): Record<string, string> {
    const virtualFS: Record<string, string> = {};
    
    Object.entries(files).forEach(([path, file]) => {
      virtualFS[path] = file.content || '';
    });

    return virtualFS;
  }

  private createVirtualFilePlugin(virtualFS: Record<string, string>): esbuild.Plugin {
    return {
      name: 'virtual-fs',
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          if (virtualFS[args.path]) {
            return { path: args.path, namespace: 'virtual' };
          }
          
          // Handle relative imports
          if (args.path.startsWith('./') || args.path.startsWith('../')) {
            const resolved = this.resolveRelativePath(args.importer, args.path);
            if (virtualFS[resolved]) {
              return { path: resolved, namespace: 'virtual' };
            }
          }

          // External imports (CDN)
          if (!args.path.startsWith('.')) {
            return {
              path: `https://esm.sh/${args.path}`,
              external: true
            };
          }

          return undefined;
        });

        build.onLoad({ filter: /.*/, namespace: 'virtual' }, (args) => {
          const content = virtualFS[args.path];
          if (content !== undefined) {
            return {
              contents: content,
              loader: this.getLoader(args.path)
            };
          }
          return undefined;
        });
      }
    };
  }

  private createReactShimPlugin(): esbuild.Plugin {
    return {
      name: 'react-shim',
      setup(build) {
        build.onLoad({ filter: /\.(tsx|jsx)$/ }, (args) => {
          return undefined; // Let default handling work, but ensure React is available
        });
      }
    };
  }

  private createCSSInlinePlugin(): esbuild.Plugin {
    return {
      name: 'css-inline',
      setup(build) {
        build.onLoad({ filter: /\.css$/ }, (args) => {
          // This would inline CSS into JS
          return undefined;
        });
      }
    };
  }

  private resolveRelativePath(importer: string, importPath: string): string {
    const importerParts = importer.split('/');
    const importParts = importPath.split('/');
    
    let result = [...importerParts.slice(0, -1)];
    
    for (const part of importParts) {
      if (part === '..') {
        result.pop();
      } else if (part !== '.') {
        result.push(part);
      }
    }
    
    return result.join('/');
  }

  private getLoader(path: string): esbuild.Loader {
    const ext = path.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'tsx':
        return 'tsx';
      case 'ts':
        return 'ts';
      case 'jsx':
        return 'jsx';
      case 'js':
        return 'js';
      case 'css':
        return 'css';
      case 'json':
        return 'json';
      default:
        return 'text';
    }
  }

  private formatError(error: esbuild.Message): string {
    return `${error.location?.file}:${error.location?.line}:${error.location?.column}: ${error.text}`;
  }

  private formatWarning(warning: esbuild.Message): string {
    return `Warning: ${warning.location?.file}:${warning.location?.line}:${warning.location?.column}: ${warning.text}`;
  }

  async generatePreviewHTML(project: Project): Promise<string> {
    const compilation = await this.compileProject(project, {
      format: 'iife',
      minify: false,
      sourcemap: true
    });

    if (!compilation.success) {
      return this.generateErrorHTML(compilation.errors);
    }

    const template = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name} - Preview</title>
    <style>
        body { 
            margin: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #app { min-height: 100vh; }
    </style>
</head>
<body>
    <div id="app"></div>
    <script type="module">
        ${compilation.code}
    </script>
    <script>
        // Error handling
        window.addEventListener('error', (e) => {
            console.error('Runtime error:', e.error);
        });
        
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
        });
    </script>
</body>
</html>`;

    return template;
  }

  private generateErrorHTML(errors: string[]): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Compilation Error</title>
    <style>
        body { 
            font-family: monospace; 
            padding: 20px; 
            background: #1a1a1a; 
            color: #ff6b6b; 
        }
        .error { 
            background: #2d1b1b; 
            padding: 15px; 
            margin: 10px 0; 
            border-left: 4px solid #ff6b6b; 
            white-space: pre-wrap; 
        }
    </style>
</head>
<body>
    <h1>Compilation Failed</h1>
    ${errors.map(error => `<div class="error">${error}</div>`).join('')}
</body>
</html>`;
  }
}