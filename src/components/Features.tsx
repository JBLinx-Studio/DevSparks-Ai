
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Bot, Rocket, Shield, Zap, Sparkles } from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: <Code className="h-8 w-8" />,
      title: "Intelligent Code Generation",
      description: "Generate complete functions, components, and modules with natural language prompts. Our AI understands context and best practices."
    },
    {
      icon: <Bot className="h-8 w-8" />,
      title: "Real-time Code Assistant",
      description: "Get instant suggestions, bug fixes, and optimizations as you type. Like having a senior developer pair programming with you."
    },
    {
      icon: <Rocket className="h-8 w-8" />,
      title: "Lightning Fast Builds",
      description: "Optimize your build process with AI-powered bundling and deployment strategies. Deploy 5x faster than traditional methods."
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Security First",
      description: "Automatic security scanning and vulnerability detection. Our AI identifies and fixes security issues before they reach production."
    },
    {
      icon: <Zap className="h-8 w-8" />,
      title: "Performance Optimization",
      description: "AI-driven performance analysis and automatic optimizations. Reduce bundle size and improve loading times effortlessly."
    },
    {
      icon: <Sparkles className="h-8 w-8" />,
      title: "Smart Refactoring",
      description: "Modernize legacy code with intelligent refactoring suggestions. Upgrade to latest patterns and frameworks seamlessly."
    }
  ];

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Everything You Need to{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Code Faster
            </span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            DevSparks AI provides a comprehensive suite of AI-powered tools designed to 
            accelerate your development workflow and improve code quality.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="bg-gray-900/50 backdrop-blur-sm border-white/10 hover:border-blue-500/50 transition-all duration-300 group">
              <CardHeader>
                <div className="text-blue-400 group-hover:text-purple-400 transition-colors duration-300 mb-4">
                  {feature.icon}
                </div>
                <CardTitle className="text-white text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-300 text-base leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
