// Puter Sign-In Component - Clean white popup for signing in
// Only shows the white sign-in popup, no red overlays

class PuterSignIn {
  constructor() {
    this.isVisible = false;
    this.createSignInPopup();
    this.bindEvents();
  }

  createSignInPopup() {
    // Remove any existing popups
    const existing = document.getElementById('puter-signin-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'puter-signin-popup';
    popup.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      z-index: 10000;
      display: none;
      min-width: 280px;
      font-family: Inter, system-ui, sans-serif;
    `;

    popup.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">Sign in to Puter.AI</h3>
        <button id="close-puter-signin" style="background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px; color: #6b7280;">&times;</button>
      </div>
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280; line-height: 1.4;">
        Get access to free, unlimited AI models including GPT-5, Claude 4, and DeepSeek.
      </p>
      <div style="display: flex; gap: 8px;">
        <button id="puter-signin-btn" style="
          background: #3b82f6; 
          color: white; 
          border: none; 
          padding: 8px 16px; 
          border-radius: 6px; 
          cursor: pointer; 
          font-size: 14px; 
          font-weight: 500;
          flex: 1;
        ">Sign In</button>
        <button id="puter-signin-cancel" style="
          background: #f9fafb; 
          color: #374151; 
          border: 1px solid #d1d5db; 
          padding: 8px 16px; 
          border-radius: 6px; 
          cursor: pointer; 
          font-size: 14px;
        ">Later</button>
      </div>
    `;

    document.body.appendChild(popup);
    this.popup = popup;
  }

  bindEvents() {
    // Close button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'close-puter-signin' || e.target.id === 'puter-signin-cancel') {
        this.hide();
      }
    });

    // Sign in button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'puter-signin-btn') {
        this.signIn();
      }
    });

    // Listen for successful Puter sign-in
    window.addEventListener('puter:signin', () => {
      this.hide();
    });
  }

  show() {
    if (this.popup && !this.isVisible) {
      this.popup.style.display = 'block';
      this.isVisible = true;
    }
  }

  hide() {
    if (this.popup && this.isVisible) {
      this.popup.style.display = 'none';
      this.isVisible = false;
    }
  }

  async signIn() {
    try {
      const signInBtn = document.getElementById('puter-signin-btn');
      if (signInBtn) {
        signInBtn.textContent = 'Signing in...';
        signInBtn.disabled = true;
      }

      // Use the global Puter integration
      if (window.lovablePuter && window.lovablePuter.signIn) {
        await window.lovablePuter.signIn();
      } else if (window.Puter && window.Puter.auth && window.Puter.auth.signIn) {
        await window.Puter.auth.signIn();
      } else {
        throw new Error('Puter sign-in not available');
      }

      this.hide();
      
      // Notify the app
      if (window.app && window.app.initPuterStorage) {
        window.app.initPuterStorage();
      }
    } catch (error) {
      console.error('Puter sign-in failed:', error);
      
      const signInBtn = document.getElementById('puter-signin-btn');
      if (signInBtn) {
        signInBtn.textContent = 'Try Again';
        signInBtn.disabled = false;
      }
      
      // Show error briefly
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        margin-top: 8px; 
        padding: 8px; 
        background: #fef2f2; 
        border: 1px solid #fecaca; 
        border-radius: 4px; 
        color: #dc2626; 
        font-size: 12px;
      `;
      errorDiv.textContent = 'Sign-in failed. Please try again.';
      this.popup.appendChild(errorDiv);
      
      setTimeout(() => {
        if (errorDiv.parentNode) errorDiv.remove();
      }, 3000);
    }
  }
}

// Initialize the sign-in component
const puterSignIn = new PuterSignIn();

// Expose globally for the app to use
window.puterSignIn = puterSignIn;

export default puterSignIn;