/**
 * Reply template injection for Kleinanzeigen messaging.
 * Detects when user is replying to a message and injects template picker UI.
 */

interface ReplyTemplate {
  id?: string;
  icon: string;
  title: string;
  content: string;
  copyCount: number;
  createdAt?: number;
  updatedAt?: number;
}

const log = (...args: any[]) => console.log('[AB-messaging]', ...args);

let templateCache: ReplyTemplate[] | null = null;

/** Fetch reply templates from backend. */
async function fetchTemplates(): Promise<ReplyTemplate[]> {
  if (templateCache) return templateCache;

  try {
    const token = await new Promise<string>((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_SESSION_TOKEN' }, (response) => {
        resolve(response?.token || '');
      });
    });

    if (!token) {
      log('No session token available');
      return [];
    }

    const apiUrl = localStorage.getItem('apiUrl') || 'http://localhost:3000/api';
    const res = await fetch(`${apiUrl}/reply-templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    templateCache = await res.json();
    return templateCache;
  } catch (err: any) {
    log('Failed to fetch templates:', err.message);
    return [];
  }
}

/** Detect reply textarea and inject template picker. */
function injectTemplatePickerUI() {
  // Look for Kleinanzeigen's reply textarea
  const textarea = document.querySelector<HTMLTextAreaElement>(
    'textarea[placeholder*="Nachricht"], textarea[data-testid*="message"], [contenteditable="true"][role="textbox"]'
  );

  if (!textarea) {
    log('Reply textarea not found');
    return;
  }

  // Don't inject twice
  if (document.querySelector('[data-ab-template-picker]')) {
    log('Template picker already injected');
    return;
  }

  log('Found reply textarea, injecting template picker...');

  const container = document.createElement('div');
  container.setAttribute('data-ab-template-picker', '1');
  Object.assign(container.style, {
    marginBottom: '8px',
    padding: '8px 0',
    borderBottom: '1px solid #e5e5e5',
  } as CSSStyleDeclaration);

  const btn = document.createElement('button');
  btn.innerHTML = '📋 Antwort-Vorlage';
  Object.assign(btn.style, {
    padding: '8px 12px',
    background: '#A8C300',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    fontFamily: 'system-ui, sans-serif',
    transition: 'background 0.2s',
  } as CSSStyleDeclaration);

  btn.addEventListener('mouseenter', () => {
    btn.style.background = '#96ae00';
  });

  btn.addEventListener('mouseleave', () => {
    btn.style.background = '#A8C300';
  });

  btn.addEventListener('click', async () => {
    log('Template picker clicked');
    const templates = await fetchTemplates();
    if (templates.length === 0) {
      alert('Keine Antwort-Vorlagen verfügbar');
      return;
    }

    // Dropdown menu with KA styling
    const menu = document.createElement('div');
    Object.assign(menu.style, {
      position: 'absolute',
      background: '#fff',
      border: '1px solid #ddd',
      borderRadius: '4px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      zIndex: '10000',
      minWidth: '220px',
      maxWidth: '300px',
      maxHeight: '400px',
      overflowY: 'auto',
    } as CSSStyleDeclaration);

    templates.forEach((template, index) => {
      const item = document.createElement('div');
      Object.assign(item.style, {
        padding: '10px 12px',
        cursor: 'pointer',
        borderBottom: index < templates.length - 1 ? '1px solid #f0f0f0' : 'none',
        fontSize: '13px',
        transition: 'background 0.15s',
        color: '#333',
      } as CSSStyleDeclaration);

      item.textContent = `${template.icon} ${template.title}`;

      item.addEventListener('mouseenter', () => {
        item.style.background = '#f0f5f0';
        item.style.color = '#A8C300';
        item.style.fontWeight = '500';
      });

      item.addEventListener('mouseleave', () => {
        item.style.background = '';
        item.style.color = '#333';
        item.style.fontWeight = 'normal';
      });

      item.addEventListener('click', async () => {
        log('Template selected:', template.title);
        insertTemplate(textarea, template.content);
        menu.remove();
        // Track the copy
        try {
          const token = await new Promise<string>((resolve) => {
            chrome.runtime.sendMessage({ type: 'GET_SESSION_TOKEN' }, (response) => {
              resolve(response?.token || '');
            });
          });
          const apiUrl = localStorage.getItem('apiUrl') || 'http://localhost:3000/api';
          await fetch(`${apiUrl}/reply-templates/${template.id}/copy`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (err: any) {
          log('Failed to track template copy:', err.message);
        }
      });

      menu.appendChild(item);
    });

    const rect = btn.getBoundingClientRect();
    Object.assign(menu.style, {
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
    } as CSSStyleDeclaration);

    document.body.appendChild(menu);

    // Close menu when clicking outside
    const closeMenu = () => {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    };

    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 0);
  });

  container.appendChild(btn);

  // Insert before textarea
  textarea.parentElement?.insertBefore(container, textarea);
}

/** Insert template text into reply textarea. */
function insertTemplate(textarea: HTMLTextAreaElement, text: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  textarea.value = before + text + after;

  // Trigger change event for React
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));

  // Focus and position cursor at end of inserted text
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
}

/** Monitor for reply textarea and inject picker when it appears. */
export function initKaMessaging() {
  log('Initializing messaging template injection...');

  // Initial check
  injectTemplatePickerUI();

  // Watch for dynamic content (SPA navigation)
  const observer = new MutationObserver(() => {
    injectTemplatePickerUI();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
  });
}
