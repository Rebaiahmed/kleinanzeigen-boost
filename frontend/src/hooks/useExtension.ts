import { useEffect, useState, useCallback } from 'react';

export function useExtension() {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const triggerHandshake = useCallback(() => {
    console.log('[React] Triggering manual check...');
    const token = localStorage.getItem('token') || localStorage.getItem('kb_session');
    if (token) {
      window.postMessage({ type: 'ANZEIGENBOOST_SET_TOKEN', token }, '*');
    }
    window.postMessage({ type: 'CHECK_PLATFORM_LOGIN' }, '*');
  }, []);

  useEffect(() => {
    let checked = false;

    // Send token and check platform login immediately on mount in case the extension is already ready
    const token = localStorage.getItem('token') || localStorage.getItem('kb_session');
    if (token) {
      console.log('[React] Sending initial token to extension on mount');
      window.postMessage({ type: 'ANZEIGENBOOST_SET_TOKEN', token }, '*');
    }
    console.log('[React] Checking platform login status on mount');
    window.postMessage({ type: 'CHECK_PLATFORM_LOGIN' }, '*');

    const handler = (event: MessageEvent) => {
      // Wait for extension to announce itself
      if (event.data?.type === 'ANZEIGENBOOST_EXTENSION_READY') {
        console.log('[React] Received extension ready');
        
        // Share frontend JWT token with extension so they share the same userId session
        const token = localStorage.getItem('token') || localStorage.getItem('kb_session');
        if (token) {
          window.postMessage({ type: 'ANZEIGENBOOST_SET_TOKEN', token }, '*');
        }

        // Send ONE check message
        if (!checked) {
          console.log('[React] Sending check message to extension');
          window.postMessage({ type: 'CHECK_PLATFORM_LOGIN' }, '*');
          checked = true;
        }
      }
      
      // Verify login status
      if (event.data?.type === 'PLATFORM_LOGIN_STATUS') {
        console.log('[React] Received platform login status:', event.data.isLoggedIn);
        setIsChecking(false);
        if (event.data.isLoggedIn) {
          setIsConnected(true);
          if (event.data.username) {
            localStorage.setItem('kb_username', event.data.username);
            window.dispatchEvent(new Event('kb_username_changed'));
          }
        }
      }
    };
    
    window.addEventListener('message', handler);
    
    // Fallback if extension doesn't respond
    const timeout = setTimeout(() => {
      setIsChecking(false);
    }, 2000);

    return () => {
      window.removeEventListener('message', handler);
      clearTimeout(timeout);
    };
  }, []);

  return { isConnected, isChecking, triggerHandshake };
}
