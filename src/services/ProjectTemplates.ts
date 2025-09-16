// Advanced Project Templates System - WebSim can't handle this complexity
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: 'react' | 'vanilla' | 'fullstack' | 'mobile';
  framework: string;
  files: Record<string, string>;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  entryPoint: string;
  features: string[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'react-typescript-advanced',
    name: 'React + TypeScript + Tailwind',
    description: 'Production-ready React app with TypeScript, Tailwind CSS, and modern tooling',
    category: 'react',
    framework: 'React',
    entryPoint: 'src/main.tsx',
    features: ['TypeScript', 'Tailwind CSS', 'ESLint', 'Vite', 'React Router'],
    dependencies: {
      'react': '^18.3.1',
      'react-dom': '^18.3.1',
      'react-router-dom': '^6.26.0',
      'clsx': '^2.1.1',
      'lucide-react': '^0.544.0'
    },
    scripts: {
      'dev': 'vite',
      'build': 'tsc && vite build',
      'preview': 'vite preview'
    },
    files: {
      'src/main.tsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)`,
      'src/App.tsx': `import React from 'react'
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import './App.css'

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </div>
  )
}

export default App`,
      'src/pages/HomePage.tsx': `import React from 'react'

const HomePage: React.FC = () => {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8">
        Welcome to Your React App
      </h1>
      <p className="text-lg text-center text-muted-foreground">
        Start building something amazing!
      </p>
    </main>
  )
}

export default HomePage`,
      'src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --muted: 210 40% 98%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
}

* {
  box-sizing: border-box;
}

body {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
}`,
      'src/App.css': `/* Component styles */`,
      'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
      'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`,
      'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
})`
    }
  },
  {
    id: 'fullstack-nextjs',
    name: 'Next.js Fullstack App',
    description: 'Complete fullstack application with Next.js, API routes, and database',
    category: 'fullstack',
    framework: 'Next.js',
    entryPoint: 'pages/index.tsx',
    features: ['Next.js', 'API Routes', 'TypeScript', 'Tailwind', 'Database Ready'],
    dependencies: {
      'next': '^14.0.0',
      'react': '^18.3.1',
      'react-dom': '^18.3.1'
    },
    scripts: {
      'dev': 'next dev',
      'build': 'next build',
      'start': 'next start'
    },
    files: {
      'pages/index.tsx': `import Head from 'next/head'

export default function Home() {
  return (
    <>
      <Head>
        <title>Next.js App</title>
        <meta name="description" content="Fullstack Next.js application" />
      </Head>
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-16">
          <h1 className="text-5xl font-bold text-center text-gray-900 mb-8">
            Welcome to Next.js
          </h1>
          <p className="text-xl text-center text-gray-600">
            Your fullstack application is ready to build upon
          </p>
        </div>
      </main>
    </>
  )
}`,
      'pages/api/hello.ts': `import type { NextApiRequest, NextApiResponse } from 'next'

type Data = {
  message: string
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  res.status(200).json({ message: 'Hello from Next.js API!' })
}`,
      'next.config.js': `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig`
    }
  }
];

export class ProjectTemplateService {
  static getTemplate(id: string): ProjectTemplate | null {
    return PROJECT_TEMPLATES.find(template => template.id === id) || null;
  }

  static getAllTemplates(): ProjectTemplate[] {
    return PROJECT_TEMPLATES;
  }

  static getTemplatesByCategory(category: ProjectTemplate['category']): ProjectTemplate[] {
    return PROJECT_TEMPLATES.filter(template => template.category === category);
  }

  static createProjectFromTemplate(templateId: string, projectName: string): any {
    const template = this.getTemplate(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    // Process template files with project name substitution
    const processedFiles: Record<string, any> = {};
    
    Object.entries(template.files).forEach(([path, content]) => {
      const processedContent = content.replace(/{{PROJECT_NAME}}/g, projectName);
      processedFiles[path] = {
        path,
        content: processedContent,
        type: path.split('.').pop() || 'text',
        size: processedContent.length,
        lastModified: new Date().toISOString()
      };
    });

    // Add package.json with dependencies
    processedFiles['package.json'] = {
      path: 'package.json',
      content: JSON.stringify({
        name: projectName.toLowerCase().replace(/\s+/g, '-'),
        version: '0.1.0',
        private: true,
        scripts: template.scripts,
        dependencies: template.dependencies,
        devDependencies: {
          '@types/react': '^18.3.0',
          '@types/react-dom': '^18.3.0',
          '@vitejs/plugin-react': '^4.3.0',
          'typescript': '^5.5.0',
          'vite': '^5.4.0'
        }
      }, null, 2),
      type: 'json',
      size: 0,
      lastModified: new Date().toISOString()
    };

    return {
      id: Date.now().toString(),
      name: projectName,
      description: `Generated from ${template.name} template`,
      files: processedFiles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entryPoint: template.entryPoint,
      framework: template.framework,
      template: templateId
    };
  }
}