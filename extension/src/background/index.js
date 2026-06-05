console.log('[AnzeigenBoost] Background loaded');

const API_BASE = 'http://localhost:3000/api';
const WS_URL = 'ws://localhost:3000/ws/extension';

let ws = null;
let reconnectTimeout = null;
let currentToken = null;

// Connect to NestJS WebSocket Server
function connectWebSocket(token) {
  if (ws) {
    try {
      ws.close();
    } catch (e) {}
  }
  
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  currentToken = token;
  ws = new WebSocket(`${WS_URL}?token=${token}`);

  ws.onopen = () => {
    console.log('[Extension WS] Connected to backend');
  };

  ws.onmessage = async (event) => {
    let commandId = null;
    try {
      const message = JSON.parse(event.data);
      commandId = message.commandId;
      const { action, payload } = message;

      if (!commandId || !action) return;

      console.log(`[Extension WS] Received command: ${action}`, payload);

      if (action === 'PING') {
        ws.send(JSON.stringify({
          type: 'COMMAND_RESPONSE',
          commandId,
          success: true,
          payload: { pong: true }
        }));
      } else if (action === 'SYNC_ADS') {
        try {
          // Hit the HTML page first to pass session trap
          await fetch('https://www.kleinanzeigen.de/m-meine-anzeigen.html', {
            credentials: 'include'
          });

          const res = await fetch('https://www.kleinanzeigen.de/m-meine-anzeigen-verwalten.json?sort=DEFAULT', {
            credentials: 'include'
          });
          if (!res.ok) {
            throw new Error(`Kleinanzeigen API returned status ${res.status}`);
          }
          const rawData = await res.json();
          const rawAds = rawData.ads || [];
          
          const stateMapping = {
            'active': 'Aktiv',
            'paused': 'Pausiert',
            'reserved': 'Reserviert',
            'sold': 'Verkauft'
          };

          const mappedAds = rawAds.map(ad => {
            if (!ad) return null;
            const adId = ad.id !== undefined && ad.id !== null ? ad.id.toString() : Math.random().toString();
            return {
              id: adId,
              title: ad.title || '',
              category: ad.category || '',
              price: ad.price || '',
              views: ad.viewCount || 0,
              favorites: ad.watchCount || 0,
              messages: ad.replies || 0,
              date: ad.creationDate || '',
              status: stateMapping[ad.state?.toLowerCase()] || 'Aktiv',
              image: ad.adImage?.url || 'https://via.placeholder.com/150/f5f5f5/a0a0a0?text=No+Image'
            };
          }).filter(Boolean);

          ws.send(JSON.stringify({
            type: 'COMMAND_RESPONSE',
            commandId,
            success: true,
            payload: mappedAds
          }));
        } catch (err) {
          ws.send(JSON.stringify({
            type: 'COMMAND_RESPONSE',
            commandId,
            success: false,
            error: err.message || 'Failed to sync ads via extension'
          }));
        }
      } else {
        ws.send(JSON.stringify({
          type: 'COMMAND_RESPONSE',
          commandId,
          success: false,
          error: `Unhandled action: ${action}`
        }));
      }
    } catch (err) {
      console.error('[Extension WS] Error processing message:', err);
      if (ws && commandId) {
        try {
          ws.send(JSON.stringify({
            type: 'COMMAND_RESPONSE',
            commandId,
            success: false,
            error: err.message || 'Error processing message'
          }));
        } catch (e) {}
      }
    }
  };

  ws.onclose = (event) => {
    console.log('[Extension WS] Closed:', event.reason);
    ws = null;
    if (currentToken) {
      reconnectTimeout = setTimeout(() => {
        if (currentToken) connectWebSocket(currentToken);
      }, 5000);
    }
  };

  ws.onerror = (err) => {
    console.error('[Extension WS] Socket error:', err);
  };
}

// Watch token in chrome session storage to control WS connection state
if (chrome.storage && chrome.storage.session) {
  chrome.storage.session.get(['token'], (result) => {
    if (result.token) {
      connectWebSocket(result.token);
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'session' && changes.token) {
      const newToken = changes.token.newValue;
      if (newToken) {
        connectWebSocket(newToken);
      } else {
        currentToken = null;
        if (ws) {
          ws.close();
          ws = null;
        }
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
      }
    }
  });
}

// Helper to authenticate extension and connect WebSocket
function authenticateAndConnect(email, cookies) {
  fetch(`${API_BASE}/auth/login/cookie`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, cookies: JSON.stringify(cookies) })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success || data.accessToken) {
      const token = data.accessToken || 'mock-jwt-token-cookie';
      if (chrome.storage && chrome.storage.session) {
        chrome.storage.session.set({ token }, () => {
          connectWebSocket(token);
        });
      } else {
        connectWebSocket(token);
      }
    }
  })
  .catch(err => {
    console.error('[AnzeigenBoost] Authentication failed:', err);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_PLATFORM_LOGIN') {
    if (!chrome.cookies) {
      sendResponse({ isLoggedIn: false, error: 'Cookies API not available' });
      return true;
    }
    chrome.cookies.getAll({ domain: '.kleinanzeigen.de' }, (cookies) => {
      const sessionCookie = cookies && cookies.find(c => 
        c.name.includes('access_token') || 
        c.name.includes('refresh_token') ||
        c.name === 'access_token' ||
        c.name === 'refresh_token'
      );
      
      const isLoggedIn = cookies && cookies.length > 0 && !!sessionCookie;
      if (!isLoggedIn) {
        sendResponse({ isLoggedIn: false, username: null });
        return;
      }
      
      let username = 'Kleinanzeigen_User';

      // 1. Scan all cookies for any value matching email regex
      if (cookies && cookies.length > 0) {
        for (const c of cookies) {
          try {
            const val = decodeURIComponent(c.value);
            const emailMatch = val.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (emailMatch) {
              username = emailMatch[0];
              break;
            }
          } catch (e) {}
        }
      }

      // 2. If no email found, try decoding sessionCookie JWT payload
      if (username === 'Kleinanzeigen_User' && sessionCookie) {
        try {
          const parts = sessionCookie.value.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.email) username = payload.email;
            else if (payload.username) username = payload.username;
            else if (payload.sub) username = payload.sub;
          }
        } catch (e) {}
      }

      // 3. Fallback: check specifically named cookies
      if (username === 'Kleinanzeigen_User' && cookies && cookies.length > 0) {
        const nameCookie = cookies.find(c => 
          c.name.toLowerCase().includes('user') || 
          c.name.toLowerCase().includes('email') ||
          c.name.toLowerCase().includes('name')
        );
        if (nameCookie) {
          try {
            const val = decodeURIComponent(nameCookie.value);
            if (val && val.length < 50 && !val.includes('{') && !val.includes('[') && val.trim().length > 2) {
              username = val.trim();
            }
          } catch (e) {}
        }
      }
      
      // Request handshake token from backend
      fetch(`${API_BASE}/auth/handshake-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies })
      })
      .then(res => res.json())
      .then(data => {
        sendResponse({ isLoggedIn: true, username, token: data.token });
      })
      .catch(err => {
        console.error('[AnzeigenBoost] Handshake error:', err);
        // Fallback to active state but without token
        sendResponse({ isLoggedIn: true, username, token: null });
      });
    });
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'SET_COOKIES') {
    if (!chrome.cookies) {
      sendResponse({ success: false, error: 'Cookies API not available' });
      return true;
    }
    
    const cookies = message.cookies;
    if (!Array.isArray(cookies)) {
      sendResponse({ success: false, error: 'Cookies must be an array' });
      return true;
    }
    
    const promises = cookies.map(cookie => {
      return new Promise((resolve) => {
        const secure = cookie.secure ?? true;
        const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
        const url = `http${secure ? 's' : ''}://${domain}${cookie.path || '/'}`;
        
        const details = {
          url: url,
          name: cookie.name,
          value: cookie.value,
          path: cookie.path || '/',
          secure: secure,
          httpOnly: cookie.httpOnly ?? false,
        };
        
        if (cookie.domain) {
          details.domain = cookie.domain;
        }
        if (cookie.expirationDate !== undefined) {
          details.expirationDate = cookie.expirationDate;
        }
        if (cookie.sameSite !== undefined) {
          let ss = 'unspecified';
          if (cookie.sameSite === 'no_restriction' || cookie.sameSite === 'None') ss = 'no_restriction';
          else if (cookie.sameSite === 'lax' || cookie.sameSite === 'Lax') ss = 'lax';
          else if (cookie.sameSite === 'strict' || cookie.sameSite === 'Strict') ss = 'strict';
          details.sameSite = ss;
        }
        
        chrome.cookies.set(details, () => {
          resolve();
        });
      });
    });
    
    Promise.all(promises).then(() => {
      // Request handshake token from backend using the newly set cookies
      fetch(`${API_BASE}/auth/handshake-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies })
      })
      .then(res => res.json())
      .then(data => {
        sendResponse({ success: true, token: data.token });
      })
      .catch(err => {
        sendResponse({ success: true, token: null });
      });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep channel open
  }

  if (message.type === 'SET_TOKEN') {
    const token = message.token;
    if (chrome.storage && chrome.storage.session) {
      chrome.storage.session.set({ token }, () => {
        connectWebSocket(token);
      });
    } else {
      connectWebSocket(token);
    }
    sendResponse({ success: true });
    return true;
  }
  
  return true;
});
