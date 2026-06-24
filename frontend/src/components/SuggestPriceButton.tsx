import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';

interface SuggestPriceResult {
  suggestedLow: number;
  suggestedHigh: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  comparablesUsed: number;
}

interface SuggestPriceButtonProps {
  ad: any;
}

export function SuggestPriceButton({ ad }: SuggestPriceButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<SuggestPriceResult | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  async function handleClick() {
    if (state === 'done') {
      setShowPopover(!showPopover);
      return;
    }

    setState('loading');
    setShowPopover(false);
    try {
      const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
      const apiUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

      const res = await fetch(`${apiUrl}/ai/suggest-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ adId: String(ad.id) }),
      });

      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      setResult(data);
      setState('done');
      setShowPopover(true);
    } catch (e) {
      console.error('[SuggestPrice] Error:', e);
      setState('error');
    }
  }

  const confidenceLabel = {
    low: 'niedrig',
    medium: 'mittel',
    high: 'hoch',
  };

  const confidenceColor = {
    low: 'text-gray-500',
    medium: 'text-orange-600',
    high: 'text-green-600',
  };

  return (
    <div className="w-full relative">
      <button
        ref={buttonRef}
        onClick={handleClick}
        disabled={state === 'loading'}
        title="Preisvorschlag basierend auf ähnlichen Anzeigen"
        className="w-full border rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 transition-colors whitespace-nowrap border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50"
      >
        <span className="shrink-0">💶</span>
        <span>
          {state === 'loading' ? 'Analysiere…' : state === 'error' ? 'Erneut versuchen' : 'Preis'}
        </span>
      </button>

      {state === 'done' && result && showPopover && (
        <div className="absolute left-0 right-0 top-full mt-2 min-w-72 bg-white border border-gray-200 shadow-lg rounded-sm p-3 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Close button */}
          <button
            onClick={() => setShowPopover(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Schließen"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Content */}
          <div className="pr-6">
            {/* Price range */}
            <div className="mb-2">
              <div className="text-sm font-semibold text-gray-900">
                💰 {result.suggestedLow} – {result.suggestedHigh} €
              </div>
            </div>

            {/* Confidence */}
            <div className="mb-2.5 text-xs">
              <span className="font-medium text-gray-700">Konfidenz:</span>
              {' '}
              <span className={`font-medium ${confidenceColor[result.confidence]}`}>
                {confidenceLabel[result.confidence]}
              </span>
              {' '}
              <span className="text-gray-500">({result.comparablesUsed} ähnliche Anzeigen)</span>
            </div>

            {/* Reasoning */}
            <p className="text-xs text-gray-700 mb-3 leading-relaxed italic">
              {result.reasoning}
            </p>

            {/* Verify link */}
            <a
              href={`https://www.kleinanzeigen.de/s-suchanfrage.html?keywords=${encodeURIComponent(ad.title)}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline text-xs font-medium"
            >
              → Echte Anzeigen vergleichen
            </a>
          </div>
        </div>
      )}

      {/* Dismiss popover when clicking outside */}
      {state === 'done' && showPopover && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowPopover(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
