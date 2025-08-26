
import { useState } from 'react'
import './App.css'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8">DevSparks AI</h1>
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            WebSim project converted to React. Your uploaded files are preserved and ready for integration.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Original Files</h3>
              <ul className="text-sm text-muted-foreground">
                <li>app.js</li>
                <li>previewManager.js</li>
                <li>chatManager</li>
                <li>githubManager.js</li>
                <li>file1.js</li>
              </ul>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Status</h3>
              <p className="text-sm text-green-600">✓ Build Configuration Complete</p>
              <p className="text-sm text-green-600">✓ React Environment Ready</p>
              <p className="text-sm text-yellow-600">⚠ Integration Needed</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Next Steps</h3>
              <p className="text-sm text-muted-foreground">
                Ready to integrate your WebSim functionality into React components.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
