/**
 * Reply template injection for Kleinanzeigen messaging.
 * Simpler, more visible approach.
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

let templateCache: ReplyTemplate[] = [];
let isCachePopulated = false;
let injectionAttempts = 0;

/** Get token from background or storage. */
async function getToken(): Promise<string> {
  // Try to get from background script first
  try {
    return await new Promise<string>((resolve) => {
      const timeout = setTimeout(() => {
        resolve('');
      }, 2000);

      chrome.runtime.sendMessage({ type: 'GET_SESSION_TOKEN' }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          resolve('');
        } else {
          resolve(response?.token || '');
        }
      });
    });
  } catch (err) {
    return '';
  }
}

/** Fetch reply templates from backend. */
async function fetchTemplates(): Promise<ReplyTemplate[]> {
  if (isCachePopulated) return templateCache;

  try {
    const token = await getToken();

    if (!token) {
      console.warn('[AB-messaging] No session token — cannot fetch templates');
      return [];
    }

    const apiUrl = localStorage.getItem('apiUrl') || 'http://localhost:3000/api';
    console.log('[AB-messaging] Fetching templates from:', `${apiUrl}/reply-templates`);

    const res = await fetch(`${apiUrl}/reply-templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error('[AB-messaging] Failed to fetch templates: HTTP', res.status);
      throw new Error(`HTTP ${res.status}`);
    }

    templateCache = await res.json();
    isCachePopulated = true;
    console.log('[AB-messaging] Fetched', templateCache.length, 'templates');
    return templateCache;
  } catch (err: any) {
    console.error('[AB-messaging] Failed to fetch templates:', err.message);
    return [];
  }
}

/** Insert template text into input field. */
function insertTemplate(element: HTMLElement, text: string) {
  if (element instanceof HTMLTextAreaElement) {
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const before = element.value.substring(0, start);
    const after = element.value.substring(end);
    element.value = before + text + after;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.focus();
    element.selectionStart = element.selectionEnd = start + text.length;
  } else if (element.contentEditable === 'true') {
    const sel = window.getSelection();
    if (sel) {
      const range = sel.getRangeAt(0);
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      sel.removeAllRanges();
      sel.addRange(range);
      element.focus();
    }
  }
}

/** Show simple template picker UI. */
function showTemplateModal(inputElement: HTMLElement) {
  // Create modal backdrop
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.4);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, sans-serif;
  `;

  // Create modal content
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    max-width: 400px;
    width: 90%;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    z-index: 10000;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 16px;
    border-bottom: 1px solid #e5e5e5;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  header.innerHTML = `
    <h3 style="margin:0; font-size:16px; font-weight:600; color:#333;">📋 Antwort-Vorlage einfügen</h3>
    <button style="border:none; background:none; font-size:20px; cursor:pointer; color:#999;">✕</button>
  `;

  const closeBtn = header.querySelector('button');
  const closeModal = () => {
    backdrop.remove();
  };
  closeBtn?.addEventListener('click', closeModal);

  // Template list
  const listContainer = document.createElement('div');
  listContainer.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  `;

  fetchTemplates().then((templates) => {
    if (templates.length === 0) {
      listContainer.innerHTML = `
        <div style="padding:20px; text-align:center; color:#999;">
          Keine Vorlagen verfügbar
        </div>
      `;
      return;
    }

    templates.forEach((template) => {
      const item = document.createElement('button');
      item.style.cssText = `
        width: 100%;
        padding: 12px 16px;
        border: none;
        border-bottom: 1px solid #f0f0f0;
        text-align: left;
        cursor: pointer;
        background: white;
        transition: background 0.2s;
        font-family: system-ui, sans-serif;
        font-size: 14px;
      `;
      item.innerHTML = `<strong>${template.icon} ${template.title}</strong><br><span style="color:#999; font-size:12px;">${template.content.substring(0, 60)}...</span>`;

      item.addEventListener('mouseenter', () => {
        item.style.background = '#f5f5f5';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'white';
      });

      item.addEventListener('click', async () => {
        insertTemplate(inputElement, template.content);
        closeModal();

        // Track usage
        try {
          const token = await getToken();
          if (token) {
            const apiUrl = localStorage.getItem('apiUrl') || 'http://localhost:3000/api';
            await fetch(`${apiUrl}/reply-templates/${template.id}/copy`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            });
          }
        } catch (e) {
          console.error('[AB-messaging] Failed to track template usage:', e);
        }
      });

      listContainer.appendChild(item);
    });
  });

  modal.appendChild(header);
  modal.appendChild(listContainer);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
}

/** Try to inject button near any input/textarea on the page. */
function injectTemplateButton() {
  injectionAttempts++;
  if (injectionAttempts > 100) {
    return;
  }

  // Find any textarea on the page
  const textareas = document.querySelectorAll('textarea');
  if (textareas.length > 0) {
    console.log('[AB-messaging] Found', textareas.length, 'textarea(s) to inject button');
  }

  textareas.forEach((textarea) => {
    // Skip if already has button
    if (textarea.parentElement?.querySelector('[data-ab-template-btn]')) {
      console.log('[AB-messaging] Button already exists for this textarea, skipping');
      return;
    }

    // Create button — match Kleinanzeigen's secondary button style
    // (outlined, subtle, matches native chat controls)
    const btn = document.createElement('button');
    btn.setAttribute('data-ab-template-btn', '1');
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 8px;
      padding: 8px 14px;
      background: transparent;
      color: #1976d2;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      font-family: system-ui, sans-serif;
      transition: all 0.2s ease;
      white-space: nowrap;
      line-height: 1;
    `;
    btn.innerHTML = '<span style="font-size: 14px;">📋</span><span>Vorlage</span>';

    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = '#1976d2';
      btn.style.background = '#e3f2fd';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
      btn.style.borderColor = '#e0e0e0';
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[AB-messaging] Button clicked, showing template modal');
      showTemplateModal(textarea);
    });

    // Insert button after textarea
    textarea.parentElement?.insertBefore(btn, textarea.nextSibling);
    console.log('[AB-messaging] Button injected after textarea');
  });
}

/** Monitor page for textareas and inject buttons. */
export function initKaMessaging() {
  console.log('[AB-messaging] Initializing template button injection');

  // Initial injection
  injectTemplateButton();

  // Watch for dynamic content
  const observer = new MutationObserver(() => {
    injectTemplateButton();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
