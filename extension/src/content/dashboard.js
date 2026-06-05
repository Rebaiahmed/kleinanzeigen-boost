console.log('[AnzeigenBoost] Dashboard script loaded');

console.log('[Extension] Sending ready message');
window.postMessage({ type: 'ANZEIGENBOOST_EXTENSION_READY', source: 'extension' }, '*');

// Listen for messages from React
window.addEventListener('message', (event) => {
  // Only accept messages from same origin
  if (event.origin !== window.location.origin) return;
  
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  
  if (data.type === 'CHECK_PLATFORM_LOGIN') {
    chrome.runtime.sendMessage({ type: 'CHECK_PLATFORM_LOGIN' }, (response) => {
      window.postMessage({
        type: 'PLATFORM_LOGIN_STATUS',
        source: 'extension',
        isLoggedIn: response?.isLoggedIn ?? false,
        username: response?.username ?? null,
        token: response?.token ?? null
      }, '*');
    });
  }
  
  if (data.type === 'SET_COOKIES') {
    chrome.runtime.sendMessage({ type: 'SET_COOKIES', cookies: data.cookies }, (response) => {
      window.postMessage({
        type: 'SET_COOKIES_RESPONSE',
        source: 'extension',
        success: response?.success ?? false,
        error: response?.error ?? null,
        token: response?.token ?? null
      }, '*');
    });
  }

  if (data.type === 'ANZEIGENBOOST_SET_TOKEN') {
    chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: data.token });
  }
});
