import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, X, TrendingUp, Loader2 } from 'lucide-react';

interface PriceSuggestionProps {
  adId: string;
  adTitle: string;
  currentPrice: string;
  onCheck: (adId: string, title: string) => Promise<{ suggestedPrice: number; reasoning: string } | null>;
  aiBlocked?: boolean;
}

export function PriceSuggestion({ adId, adTitle, currentPrice, onCheck, aiBlocked }: PriceSuggestionProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ suggestedPrice: number; reasoning: string } | null>(null);
  const [visible, setVisible] = useState(false);

  const handleClick = async () => {
    if (aiBlocked) return;
    if (result) { setVisible(true); return; } // show cached result
    setLoading(true);
    setVisible(true);
    const data = await onCheck(adId, adTitle);
    setResult(data);
    setLoading(false);
  };

  // Parse current price number for comparison
  const currentNum = parseFloat(currentPrice?.replace(/[^\d.,]/g, '').replace(',', '.')) || null;
  const diff = result && currentNum ? result.suggestedPrice - currentNum : null;
  const diffPct = diff && currentNum ? Math.round((diff / currentNum) * 100) : null;

  return (
    <div className="w-full">
      <button
        onClick={handleClick}
        disabled={loading || aiBlocked}
        title={aiBlocked ? t('priceSuggestion.limitReached') : t('priceSuggestion.titleHint')}
        className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-sm text-[11px] font-medium border transition-colors ${
          aiBlocked
            ? 'border-gray-200 text-gray-300 cursor-not-allowed'
            : 'border-blue-200 text-blue-600 hover:bg-blue-50'
        }`}
      >
        {loading
          ? <><Loader2 className="w-3 h-3 animate-spin" /> {t('priceSuggestion.analyzing')}</>
          : <><TrendingUp className="w-3 h-3" /> {t('priceSuggestion.priceSuggestion')}</>
        }
      </button>

      {visible && (
        <div className="mt-2 rounded-sm border border-blue-100 bg-blue-50 p-3 text-[12px] relative">
          <button
            onClick={() => setVisible(false)}
            className="absolute top-1.5 right-1.5 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {loading ? (
            <div className="flex items-center gap-2 text-blue-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{t('priceSuggestion.analyzingMarket')}</span>
            </div>
          ) : result ? (
            <div className="space-y-2 pr-4">
              {/* Suggested price */}
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="font-bold text-blue-800 text-[14px]">
                  {result.suggestedPrice} €
                </span>
                {diff !== null && diffPct !== null && (
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                    diff > 0
                      ? 'bg-green-100 text-green-700'
                      : diff < 0
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diff > 0 ? '+' : ''}{diffPct}% {t('priceSuggestion.vsCurrentPrice')}
                  </span>
                )}
              </div>

              {/* LLM reasoning */}
              <p className="text-gray-600 leading-relaxed italic">
                "{result.reasoning}"
              </p>

              {/* Action hint */}
              <p className="text-[11px] text-gray-400">
                {t('priceSuggestion.editHint')}
              </p>
            </div>
          ) : (
            <p className="text-red-500">{t('priceSuggestion.analysisFailed')}</p>
          )}
        </div>
      )}
    </div>
  );
}
