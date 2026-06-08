import { useEffect, useState, useCallback } from 'react';

export function sendTokenToExtension() {
  const token = localStorage.getItem('token') || localStorage.getItem('kb_session');
  if (!token) return;
  window.postMessage({ type: 'ANZEIGENBOOST_SET_TOKEN', token }, '*');
}

export function useExtension() {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [contextInvalidated, setContextInvalidated] = useState(false);

  // Clear any stale kb_username that may have been stored in previous sessions
  useEffect(() => {
    localStorage.removeItem('kb_username');
  }, []);

  const triggerHandshake = useCallback(() => {
    window.postMessage({ type: 'CHECK_PLATFORM_LOGIN', platform: 'kleinanzeigen' }, '*');
  }, []);

  useEffect(() => {
    // Send token once on mount so extension has it for syncs
    sendTokenToExtension();

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'ANZEIGENBOOST_EXTENSION_READY') {
        if (event.data.extensionId) {
          localStorage.setItem('anzeigenboost_ext_id', event.data.extensionId);
        }
        // Send token to extension now that it's ready
        sendTokenToExtension();
        window.postMessage({ type: 'CHECK_PLATFORM_LOGIN', platform: 'kleinanzeigen' }, '*');
      }

      if (event.data?.type === 'EXTENSION_CONTEXT_INVALIDATED') {
        setIsConnected(false);
        setIsChecking(false);
        setContextInvalidated(true);
      }

      if (event.data?.type === 'PLATFORM_LOGIN_STATUS') {
        setIsChecking(false);
        setIsConnected(!!event.data.isLoggedIn);
      }
    };

    window.addEventListener('message', handler);
    const timeout = setTimeout(() => setIsChecking(false), 2000);

    return () => {
      window.removeEventListener('message', handler);
      clearTimeout(timeout);
    };
  }, []);

  return { isConnected, isChecking, contextInvalidated, triggerHandshake };
}
