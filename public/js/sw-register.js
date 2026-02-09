if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('[SW] Registered:', registration.scope);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              if (window.showToast) {
                window.showToast('New version available! Refresh to update.', 'info', 10000);
              }
            }
          });
        });
      })
      .catch(error => {
        console.error('[SW] Registration failed:', error);
      });
  });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  if (window.showToast) {
    window.showToast('Install MAPIT as an app for better performance!', 'info', 8000);
  }
});

window.addEventListener('online', () => {
  if (window.showToast) {
    window.showToast('Back online!', 'success', 3000);
  }
});

window.addEventListener('offline', () => {
  if (window.showToast) {
    window.showToast('You are offline. Some features may be limited.', 'warning', 5000);
  }
});
