// Advanced Compilation System - Beyond WebSim's capabilities
import * as esbuild from 'esbuild-wasm';
import { Project } from '../types';

interface CompilationResult {
  success: boolean;
  code: string;
  map?: string;
  errors: CompilationError[];
  warnings: CompilationWarning[];
  dependencies: string[];
  exports: string[];
  imports: string[];
  assets: Record<string, string>;
}

interface CompilationError {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

interface CompilationWarning {
  file: string;
  line: number;
  column: number;
  message: string;
}

export class AdvancedCompiler {
  private static instance: AdvancedCompiler;
  private initialized = false;
  private dependencyCache = new Map<string, string>();

  static getInstance(): AdvancedCompiler {
    if (!AdvancedCompiler.instance) {
      AdvancedCompiler.instance = new AdvancedCompiler();
    }
    return AdvancedCompiler.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await esbuild.initialize({
        wasmURL: 'https://unpkg.com/esbuild-wasm@0.19.0/esbuild.wasm',
        worker: true
      });
      this.initialized = true;
      console.log('Advanced Compiler initialized');
    } catch (error) {
      console.error('Failed to initialize Advanced Compiler:', error);
      throw error;
    }
  }

  async compileProject(project: Project): Promise<CompilationResult> {
    await this.initialize();

    try {
      const entryPoint = this.detectEntryPoint(project);
      const virtualFS = this.createVirtualFileSystem(project.files);
      
      // Advanced plugin system
      const plugins = [
        this.createVirtualFilePlugin(virtualFS),
        this.createDependencyResolutionPlugin(),
        this.createReactTransformPlugin(),
        this.createCSSProcessingPlugin(),
        this.createAssetPlugin(),
        this.createTypeScriptPlugin()
      ];

      const result = await esbuild.build({
        entryPoints: [entryPoint],
        bundle: true,
        write: false,
        format: 'esm',
        target: 'es2020',
        sourcemap: true,
        jsx: 'automatic',
        plugins,
        define: {
          'process.env.NODE_ENV': '"development"',
          'global': 'globalThis',
          '__DEV__': 'true'
        },
        loader: {
          '.png': 'dataurl',
          '.jpg': 'dataurl',
          '.jpeg': 'dataurl',
          '.gif': 'dataurl',
          '.svg': 'text',
          '.woff': 'dataurl',
          '.woff2': 'dataurl',
          '.ttf': 'dataurl',
          '.eot': 'dataurl'
        }
      });

      const compiledCode = result.outputFiles?.[0]?.text || '';
      const sourceMap = result.outputFiles?.find(f => f.path.endsWith('.map'))?.text;

      // Extract metadata
      const dependencies = this.extractDependencies(project.files);
      const exports = this.extractExports(compiledCode);
      const imports = this.extractImports(project.files);

      return {
        success: result.errors.length === 0,
        code: compiledCode,
        map: sourceMap,
        errors: result.errors.map(this.formatError),
        warnings: result.warnings.map(this.formatWarning),
        dependencies,
        exports,
        imports,
        assets: this.extractAssets(result.outputFiles || [])
      };

    } catch (error) {
      return {
        success: false,
        code: '',
        errors: [{ 
          file: 'compiler', 
          line: 0, 
          column: 0, 
          message: `Compilation failed: ${error}`,
          severity: 'error' as const
        }],
        warnings: [],
        dependencies: [],
        exports: [],
        imports: [],
        assets: {}
      };
    }
  }

  private detectEntryPoint(project: Project): string {
    const candidates = [
      'src/main.tsx', 'src/main.ts', 'src/index.tsx', 'src/index.ts',
      'index.tsx', 'index.ts', 'main.tsx', 'main.ts',
      'App.tsx', 'App.ts', 'pages/index.tsx', 'pages/index.ts'
    ];

    for (const candidate of candidates) {
      if (project.files[candidate]) {
        return candidate;
      }
    }

    // Fallback to first TypeScript/JavaScript file
    const firstTsFile = Object.keys(project.files).find(
      path => /\.(tsx?|jsx?)$/.test(path)
    );
    
    return firstTsFile || 'index.html';
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
      name: 'virtual-fs-advanced',
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          // Handle virtual files
          if (virtualFS[args.path]) {
            return { path: args.path, namespace: 'virtual' };
          }

          // Handle relative imports with advanced resolution
          if (args.path.startsWith('./') || args.path.startsWith('../')) {
            const resolved = this.resolveModulePath(args.importer, args.path, virtualFS);
            if (resolved && virtualFS[resolved]) {
              return { path: resolved, namespace: 'virtual' };
            }
          }

          // Handle node_modules and external packages
          if (!args.path.startsWith('.')) {
            return { path: args.path, external: true };
          }

          return undefined;
        });

        build.onLoad({ filter: /.*/, namespace: 'virtual' }, (args) => {
          const content = virtualFS[args.path];
          if (content !== undefined) {
            return {
              contents: content,
              loader: this.getFileLoader(args.path) as esbuild.Loader
            };
          }
          return undefined;
        });
      }
    };
  }

  private createDependencyResolutionPlugin(): esbuild.Plugin {
    return {
      name: 'dependency-resolution',
      setup(build) {
        build.onResolve({ filter: /^[^./]/ }, async (args) => {
          const packageName = args.path.split('/')[0];
          
          // Use CDN for external packages
          if (!this.dependencyCache.has(packageName)) {
            const cdnUrl = `https://esm.sh/${args.path}`;
            this.dependencyCache.set(packageName, cdnUrl);
          }

          return {
            path: this.dependencyCache.get(packageName) || args.path,
            external: true
          };
        });
      }
    };
  }

  private createReactTransformPlugin(): esbuild.Plugin {
    return {
      name: 'react-transform',
      setup(build) {
        build.onLoad({ filter: /\.(tsx|jsx)$/ }, (args) => {
          // Advanced React transformation logic would go here
          return undefined;
        });
      }
    };
  }

  private createCSSProcessingPlugin(): esbuild.Plugin {
    return {
      name: 'css-processing',
      setup(build) {
        build.onLoad({ filter: /\.css$/ }, (args) => {
          // Advanced CSS processing (Tailwind, PostCSS, etc.)
          return undefined;
        });
      }
    };
  }

  private createAssetPlugin(): esbuild.Plugin {
    return {
      name: 'asset-processing',
      setup(build) {
        build.onLoad({ filter: /\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/ }, (args) => {
          // Asset processing and optimization
          return undefined;
        });
      }
    };
  }

  private createTypeScriptPlugin(): esbuild.Plugin {
    return {
      name: 'typescript-advanced',
      setup(build) {
        build.onLoad({ filter: /\.tsx?$/ }, (args) => {
          // Advanced TypeScript processing
          return undefined;
        });
      }
    };
  }

  private resolveModulePath(importer: string, importPath: string, virtualFS: Record<string, string>): string | null {
    const importerDir = importer.split('/').slice(0, -1).join('/');
    const pathParts = importPath.split('/');
    
    let currentDir = importerDir;
    
    for (const part of pathParts) {
      if (part === '..') {
        currentDir = currentDir.split('/').slice(0, -1).join('/');
      } else if (part !== '.') {
        currentDir = currentDir ? `${currentDir}/${part}` : part;
      }
    }

    // Try different extensions
    const extensions = ['.tsx', '.ts', '.jsx', '.js', '.json'];
    for (const ext of extensions) {
      const fullPath = `${currentDir}${ext}`;
      if (virtualFS[fullPath]) {
        return fullPath;
      }
    }

    // Try index files
    for (const ext of extensions) {
      const indexPath = `${currentDir}/index${ext}`;
      if (virtualFS[indexPath]) {
        return indexPath;
      }
    }

    return currentDir;
  }

  private getFileLoader(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    
    const loaders: Record<string, string> = {
      'tsx': 'tsx',
      'ts': 'ts',
      'jsx': 'jsx',
      'js': 'js',
      'css': 'css',
      'json': 'json',
      'png': 'dataurl',
      'jpg': 'dataurl',
      'jpeg': 'dataurl',
      'gif': 'dataurl',
      'svg': 'text',
      'woff': 'dataurl',
      'woff2': 'dataurl',
      'ttf': 'dataurl',
      'eot': 'dataurl'
    };

    return loaders[ext || ''] || 'text';
  }

  private extractDependencies(files: Record<string, any>): string[] {
    const dependencies = new Set<string>();
    
    Object.values(files).forEach((file: any) => {
      const content = file.content || '';
      const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (!importPath.startsWith('.')) {
          dependencies.add(importPath.split('/')[0]);
        }
      }
    });
    
    return Array.from(dependencies);
  }

  private extractExports(code: string): string[] {
    const exports = new Set<string>();
    const exportRegex = /export\s+(?:default\s+)?(?:const\s+|function\s+|class\s+)?(\w+)/g;
    let match;
    
    while ((match = exportRegex.exec(code)) !== null) {
      exports.add(match[1]);
    }
    
    return Array.from(exports);
  }

  private extractImports(files: Record<string, any>): string[] {
    const imports = new Set<string>();
    
    Object.values(files).forEach((file: any) => {
      const content = file.content || '';
      const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        imports.add(match[1]);
      }
    });
    
    return Array.from(imports);
  }

  private extractAssets(outputFiles: esbuild.OutputFile[]): Record<string, string> {
    const assets: Record<string, string> = {};
    
    outputFiles.forEach(file => {
      if (file.path.includes('assets/') || file.path.match(/\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)) {
        assets[file.path] = file.text;
      }
    });
    
    return assets;
  }

  private formatError = (error: esbuild.Message): CompilationError => ({
    file: error.location?.file || 'unknown',
    line: error.location?.line || 0,
    column: error.location?.column || 0,
    message: error.text,
    severity: 'error' as const
  });

  private formatWarning = (warning: esbuild.Message): CompilationWarning => ({
    file: warning.location?.file || 'unknown',
    line: warning.location?.line || 0,
    column: warning.location?.column || 0,
    message: warning.text
  });
}