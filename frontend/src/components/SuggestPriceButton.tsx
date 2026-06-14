import React, { useState } from 'react';

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

  async function handleClick() {
    setState('loading');
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
    <>
      <button
        onClick={handleClick}
        disabled={state === 'loading'}
        title="Preisvorschlag basierend auf ähnlichen Anzeigen"
        className="flex-1 border rounded-sm py-1.5 px-1 font-medium text-[11px] flex items-center justify-center gap-1 transition-colors whitespace-nowrap border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50"
      >
        <span className="shrink-0">💶</span>
        <span>
          {state === 'loading' ? 'Analysiere…' : state === 'error' ? 'Erneut versuchen' : 'Preis'}
        </span>
      </button>

      {state === 'done' && result && (
        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded text-xs">
          <div className="mb-2">
            <strong className="text-gray-900">
              Preis-Vorschlag: {result.suggestedLow} – {result.suggestedHigh} €
            </strong>
          </div>
          <div className="mb-2">
            Konfidenz:{' '}
            <span className={`font-medium ${confidenceColor[result.confidence]}`}>
              {confidenceLabel[result.confidence]}
            </span>
            {' '}({result.comparablesUsed} ähnliche Anzeigen)
          </div>
          <p className="text-gray-600 mb-2 italic">{result.reasoning}</p>
          <a
            href={`https://www.kleinanzeigen.de/s-suchanfrage.html?keywords=${encodeURIComponent(ad.title)}`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline text-[10px]"
          >
            Echte Anzeigen vergleichen →
          </a>
        </div>
      )}
    </>
  );
}
