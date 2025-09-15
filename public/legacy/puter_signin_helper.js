// Helper method for App class to show Puter sign-in
export function showPuterSignIn() {
  // Use the global sign-in component
  if (window.puterSignIn) {
    window.puterSignIn.show();
  } else {
    console.warn('Puter sign-in component not available');
  }
}

// Add the method to App prototype
if (window.App) {
  window.App.prototype.showPuterSignIn = showPuterSignIn;
}