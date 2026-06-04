// Background service worker
import { ENDPOINTS } from '../config/endpoints';

const API_URL = ENDPOINTS.API_BASE;

chrome.runtime.onMessage.addListener((message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (message.type === 'CHECK_AUTH') {
    chrome.storage.session.get(['token'], (result) => {
      sendResponse({ isAuthenticated: !!result.token });
    });
    return true; // Keep message channel open for async response
  }
  
  if (message.type === 'FETCH_AND_LOGIN') {
    const email = message.payload.email;
    chrome.cookies.getAll({ domain: ENDPOINTS.MARKETPLACE_DOMAIN }, (cookies) => {
      if (!cookies || cookies.length === 0) {
        sendResponse({ success: false, error: 'Keine Kleinanzeigen Cookies gefunden.' });
        return;
      }
      const cookieString = JSON.stringify(cookies);
      fetch(`${API_URL}/auth/login/cookie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, cookies: cookieString })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success || data.accessToken) {
          const token = data.accessToken || 'mock-jwt-token-cookie';
          chrome.storage.session.set({ token }, () => {
            sendResponse({ success: true });
          });
        } else {
          sendResponse({ success: false, error: data.message || 'Login fehlgeschlagen.' });
        }
      })
      .catch(err => {
        sendResponse({ success: false, error: 'Serverfehler: ' + err.message });
      });
    });
    return true;
  }

  if (message.type === 'INIT_HANDSHAKE') {
    try {
      if (!chrome.cookies) {
        sendResponse({ success: false, error: 'Cookies API nicht verfügbar. Bitte Erweiterung neu laden!' });
        return true;
      }
      
      chrome.cookies.getAll({ domain: ENDPOINTS.MARKETPLACE_DOMAIN }, (cookies) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: 'Cookie Fehler: ' + chrome.runtime.lastError.message });
          return;
        }

        if (!cookies || cookies.length === 0) {
          sendResponse({ success: false, error: 'Keine Kleinanzeigen Cookies gefunden. Bitte auf kleinanzeigen.de einloggen.' });
          return;
        }
        
        fetch(`${API_URL}/auth/handshake-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cookies })
        })
        .then(res => res.json())
        .then(data => {
          if (data.token) {
            const dashboardUrl = ENDPOINTS.DASHBOARD_AUTH_CALLBACK;
            chrome.tabs.create({ url: `${dashboardUrl}?token=${data.token}` });
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: data.message || 'Token Generierung fehlgeschlagen.' });
          }
        })
        .catch(err => {
          sendResponse({ success: false, error: 'Serverfehler: ' + err.message });
        });
      });
    } catch (e: any) {
      sendResponse({ success: false, error: 'Hintergrundfehler: ' + e.message });
    }
    return true;
  }

  if (message.type === 'LOGOUT') {
    chrome.storage.session.remove(['token'], () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
