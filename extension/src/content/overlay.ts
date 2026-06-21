/**
 * Document-start overlay painter. Registered dynamically (chrome.scripting
 * .registerContentScripts) only while a repost is running, so it runs before
 * Kleinanzeigen renders anything — the user never sees a blank/half-loaded page.
 *
 * It reads sessionStorage('ab_status') and paints the SAME overlay the
 * background's renderOverlayInPage() paints. Two modes:
 *   - normal: full-screen branded cover (clean UX for real users).
 *   - debug:  small non-blocking bottom-right widget with a live per-field log,
 *             leaving the form visible (dev-only; background sets debug:true).
 * Keep this render in sync with renderOverlayInPage in repost-engine.ts.
 */

type Status = { message: string; phase: 'working' | 'done' | 'error'; debug?: boolean; log?: string[] };

function paint(): void {
  try {
    const root = document.documentElement;
    if (!root) return;

    let raw: string | null = null;
    try { raw = sessionStorage.getItem('ab_status'); } catch { /* noop */ }

    // Seed an initial status on the very first page if the tab was opened with
    // the repost hash (covers the homepage before the engine takes over).
    if (!raw && location.hash.includes('ab-repost')) {
      raw = JSON.stringify({ message: 'AnzeigenBoost wird gestartet…', phase: 'working' });
      try { sessionStorage.setItem('ab_status', raw); } catch { /* noop */ }
    }

    if (!raw) {
      const ex = document.getElementById('ab-overlay');
      if (ex) ex.remove();
      return;
    }

    const s = JSON.parse(raw) as Status;
    const debug = !!s.debug;
    const mode = debug ? 'debug' : 'full';
    let o = document.getElementById('ab-overlay');
    if (o && o.getAttribute('data-mode') !== mode) { o.remove(); o = null; }

    if (!o) {
      o = document.createElement('div');
      o.id = 'ab-overlay';
      o.setAttribute('data-mode', mode);
      if (debug) {
        o.setAttribute('style', 'position:fixed;bottom:16px;right:16px;width:330px;max-height:60vh;z-index:2147483647;background:rgba(17,24,39,.93);color:#fff;border:1px solid rgba(168,195,0,.5);border-radius:10px;box-shadow:0 10px 34px rgba(0,0,0,.45);font-family:system-ui,-apple-system,Segoe UI,sans-serif;display:flex;flex-direction:column;overflow:hidden;');
        o.innerHTML = '<style>@keyframes ab-spin{to{transform:rotate(360deg)}}</style>'
          + '<div style="padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.1);display:flex;align-items:center;gap:7px;">'
          + '<span style="font-size:13px;font-weight:800;">Anzeigen<span style="color:#A8C300;">Boost</span></span>'
          + '<span style="font-size:9px;font-weight:800;color:#1f2937;background:#A8C300;padding:1px 6px;border-radius:6px;letter-spacing:.5px;">DEBUG</span>'
          + '<span id="ab-msg" style="font-size:11px;color:#cbd5e1;margin-left:auto;text-align:right;flex:1;min-width:0;"></span></div>'
          + '<div id="ab-log" style="padding:8px 12px;overflow-y:auto;font-size:11px;line-height:1.55;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;"></div>';
      } else {
        o.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1f2937,#111827);font-family:system-ui,-apple-system,Segoe UI,sans-serif;');
        o.innerHTML = '<style>@keyframes ab-spin{to{transform:rotate(360deg)}}</style>'
          + '<div style="text-align:center;color:#fff;max-width:440px;padding:32px;">'
          + '<div style="font-size:22px;font-weight:800;letter-spacing:.5px;margin-bottom:26px;">Anzeigen<span style="color:#A8C300;">Boost</span></div>'
          + '<div id="ab-icon" style="display:flex;justify-content:center;margin-bottom:22px;"></div>'
          + '<div id="ab-msg" style="font-size:16px;font-weight:600;line-height:1.45;"></div>'
          + '<div id="ab-sub" style="font-size:13px;color:#9ca3af;margin-top:10px;"></div>'
          + '<div id="ab-actions" style="margin-top:22px;"></div>'
          + '</div>';
      }
      root.appendChild(o);
    }

    const msgEl = o.querySelector('#ab-msg') as HTMLElement | null;
    if (msgEl) msgEl.textContent = s.message || '';

    if (debug) {
      const logEl = o.querySelector('#ab-log') as HTMLElement | null;
      if (logEl) {
        const lines: string[] = s.log || [];
        logEl.innerHTML = lines.map((l) => {
          const c = l.charAt(0) === '✗' ? '#fca5a5' : l.charAt(0) === '✓' ? '#bef264' : '#e5e7eb';
          return '<div style="color:' + c + ';">' + l.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>';
        }).join('');
        logEl.scrollTop = logEl.scrollHeight;
      }
      return;
    }

    const icon = o.querySelector('#ab-icon') as HTMLElement;
    const sub = o.querySelector('#ab-sub') as HTMLElement;
    const actions = o.querySelector('#ab-actions') as HTMLElement;
    if (s.phase === 'done') {
      icon.innerHTML = '<div style="width:52px;height:52px;border-radius:50%;background:#A8C300;color:#1f2937;font-size:30px;line-height:52px;font-weight:800;">✓</div>';
      sub.textContent = ''; actions.innerHTML = '';
    } else if (s.phase === 'error') {
      icon.innerHTML = '<div style="width:52px;height:52px;border-radius:50%;background:#ef4444;color:#fff;font-size:30px;line-height:52px;font-weight:800;">!</div>';
      sub.textContent = '';
      actions.innerHTML = '<button id="ab-close" style="background:#A8C300;color:#1f2937;border:0;border-radius:8px;padding:10px 22px;font-weight:700;cursor:pointer;font-size:14px;">Schließen</button>';
      const b = actions.querySelector('#ab-close') as HTMLElement | null;
      if (b) b.onclick = () => { try { sessionStorage.removeItem('ab_status'); } catch { /* noop */ } o!.remove(); };
    } else {
      icon.innerHTML = '<div style="width:52px;height:52px;border:4px solid rgba(168,195,0,.25);border-top-color:#A8C300;border-radius:50%;animation:ab-spin .8s linear infinite;"></div>';
      sub.textContent = 'Bitte diesen Tab nicht schließen.'; actions.innerHTML = '';
    }
  } catch { /* never let the overlay break the page */ }
}

paint();
document.addEventListener('DOMContentLoaded', paint);
