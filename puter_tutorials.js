// puter_tutorials.js
/* @tweakable [URL to Puter tutorials used by the UI; change to a local/docs URL if needed for Lovable preview] */
const PUTER_TUTORIALS_URL = 'https://developer.puter.com/tutorials/';

const PuterTutorials = {
  open: (url = PUTER_TUTORIALS_URL) => {
    // open in a user-gesture friendly way; Lovable will allow popups from script-triggered clicks
    try {
      const w = window.open(url, '_blank');
      if (!w) {
        // fallback to same-window navigation if popup blocked
        window.location.href = url;
      }
    } catch (e) {
      window.location.href = url;
    }
  },
  url: PUTER_TUTORIALS_URL
};

// Expose globally for Lovable + other modules to call programmatically
window.puterTutorials = PuterTutorials;
export default PuterTutorials;