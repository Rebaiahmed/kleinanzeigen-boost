import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { detectBrowserSupport } from '../lib/browserSupport';

/**
 * Shown to Firefox/Safari users: the extension is Chrome-only, so connecting and
 * reposting won't work in their browser. Dismissible (remembered per browser).
 */
export function BrowserSupportBanner() {
  const [support] = useState(detectBrowserSupport);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('ab_browser_warning_dismissed') === '1',
  );

  if (support.supported || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem('ab_browser_warning_dismissed', '1');
    setDismissed(true);
  };

  return (
    <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-sm p-3 mb-4 flex items-start gap-3 text-[13px]">
      <AlertTriangle className="w-4 h-4 text-[#c2620a] shrink-0 mt-0.5" />
      <div className="flex-1 text-[#7a4a12]">
        <p className="font-semibold text-[#9a3412]">
          AnzeigenBoost funktioniert am besten mit Google Chrome
        </p>
        <p className="mt-0.5">
          Du nutzt {support.name}. Die AnzeigenBoost-Erweiterung – nötig zum Verbinden
          und automatischen Neu-Einstellen deiner Anzeigen – ist nur für Chrome
          (und Chromium-Browser wie Edge, Brave) verfügbar.{' '}
          <a
            href="https://www.google.com/chrome/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#9a3412] underline hover:no-underline"
          >
            Chrome herunterladen
          </a>
        </p>
      </div>
      <button
        onClick={dismiss}
        aria-label="Hinweis schließen"
        className="text-[#c2620a] hover:text-[#9a3412] shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
