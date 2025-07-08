
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Play, Code, Zap } from "lucide-react";

const Hero = () => {
  return (
    <section className="px-4 sm:px-6 lg:px-8 py-20">
      <div className="max-w-7xl mx-auto text-center">
        <Badge className="mb-6 bg-blue-600/20 text-blue-400 border-blue-600/30 hover:bg-blue-600/30">
          <Zap className="h-4 w-4 mr-2" />
          Powered by Advanced AI
        </Badge>
        
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
          Code Smarter with{" "}
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            AI-Powered
          </span>{" "}
          Development
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-4xl mx-auto leading-relaxed">
          Transform your development workflow with intelligent code generation, 
          real-time suggestions, and automated debugging. Build applications 10x faster.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg">
            Start Free Trial
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10 px-8 py-6 text-lg">
            <Play className="mr-2 h-5 w-5" />
            Watch Demo
          </Button>
        </div>

        {/* Code Preview */}
        <div className="relative max-w-4xl mx-auto">
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-6 shadow-2xl">
            <div className="flex items-center mb-4">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="flex items-center ml-4 text-gray-400 text-sm">
                <Code className="h-4 w-4 mr-2" />
                AI Code Generation
              </div>
            </div>
            <div className="text-left font-mono text-sm">
              <div className="text-gray-500 mb-2">// DevSparks AI generating React component...</div>
              <div className="text-blue-400">const <span className="text-white">TodoApp</span> = () =&gt; {'{'};</div>
              <div className="text-gray-300 ml-4">const [todos, setTodos] = useState([]);</div>
              <div className="text-gray-300 ml-4">const [input, setInput] = useState('');</div>
              <div className="text-gray-500 ml-4">// AI automatically adds error handling</div>
              <div className="text-green-400 ml-4">return (</div>
              <div className="text-gray-300 ml-8">&lt;div className="todo-app"&gt;</div>
              <div className="text-gray-300 ml-12">{'{'}<span className="text-yellow-400">/* Component JSX */</span>{'}'}</div>
              <div className="text-gray-300 ml-8">&lt;/div&gt;</div>
              <div className="text-green-400 ml-4">);</div>
              <div className="text-blue-400">{'}'}</div>
            </div>
          </div>
          
          {/* Floating elements */}
          <div className="absolute -top-4 -right-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-3 shadow-lg animate-pulse">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div className="absolute -bottom-4 -left-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-3 shadow-lg animate-pulse delay-300">
            <Code className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
