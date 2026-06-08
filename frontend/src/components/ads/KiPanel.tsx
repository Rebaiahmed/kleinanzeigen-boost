import React from 'react';
import { X, Sparkles, RefreshCw, Check, Loader2, AlertCircle } from 'lucide-react';
import { PriceSuggestion } from './PriceSuggestion';

interface KiPanelProps {
  optimizePanelAdId: string | null;
  panelAd: any | null;
  isPanelLoading: boolean;
  panelData: {
    improvedTitle: string;
    improvedDescription: string;
    improvementSummary: string;
  } | null;
  panelError: { status: number; message: string } | null;
  loadedFromCache: boolean;
  appliedTitle: boolean;
  appliedDescription: boolean;
  isApplyingTitle: boolean;
  isApplyingDescription: boolean;
  isApplyingAll: boolean;
  geminiHealth: 'unknown' | 'ok' | 'error';
  isBlocked: boolean;
  isWarning: boolean;
  callsCount: number;
  limit: number;
  remaining: number;
  pct: number;
  onClose: () => void;
  onStartOptimization: (ad: any, forceRefresh?: boolean) => void;
  onApplyTitle: () => void;
  onApplyDescription: () => void;
  onApplyAll: () => void;
  onPriceCheck: (adId: string, title: string) => Promise<{ suggestedPrice: number; reasoning: string } | null>;
}

export function KiPanel({
  optimizePanelAdId,
  panelAd,
  isPanelLoading,
  panelData,
  panelError,
  loadedFromCache,
  appliedTitle,
  appliedDescription,
  isApplyingTitle,
  isApplyingDescription,
  isApplyingAll,
  geminiHealth,
  isBlocked,
  isWarning,
  callsCount,
  limit,
  remaining,
  pct,
  onClose,
  onStartOptimization,
  onApplyTitle,
  onApplyDescription,
  onApplyAll,
  onPriceCheck,
}: KiPanelProps) {
  return (
    <div
      className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-[60] transition-transform duration-300 ease-in-out border-l border-[#e5e5e5] flex flex-col ${
        optimizePanelAdId ? 'translate-x-0' : 'translate-x-full'
      } w-full md:w-[380px]`}
    >
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-[#e5e5e5] flex justify-between items-center bg-[#F9FAFB]">
        <div className="flex items-center gap-2 text-green-700 font-bold text-[16px]">
          <Sparkles className="w-5 h-5 text-green-600 animate-pulse" />
          <span>KI-Optimierung</span>
          <span
            title={geminiHealth === 'ok' ? 'Gemini verbunden' : geminiHealth === 'error' ? 'Gemini nicht erreichbar' : 'Verbindung wird geprüft...'}
            className={`w-2.5 h-2.5 rounded-full ml-1 transition-colors ${
              geminiHealth === 'ok' ? 'bg-green-400' :
              geminiHealth === 'error' ? 'bg-red-400 animate-pulse' :
              'bg-gray-300'
            }`}
          />
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center border border-transparent hover:border-red-200"
          aria-label="Schließen"
          title="Schließen"
        >
          <X className="w-[20px] h-[20px]" />
        </button>
      </div>

      {/* AI Usage Bar */}
      <div className={`px-5 py-2 border-b text-[12px] flex items-center gap-3 ${
        isBlocked ? 'bg-red-50 border-red-200' :
        isWarning ? 'bg-yellow-50 border-yellow-200' :
        'bg-gray-50 border-[#e5e5e5]'
      }`}>
        <span className={`font-medium whitespace-nowrap ${isBlocked ? 'text-red-600' : isWarning ? 'text-yellow-700' : 'text-gray-500'}`}>
          {isBlocked ? '🚫 Limit erreicht' : isWarning ? `⚠️ Noch ${remaining} übrig` : `✨ ${remaining} von ${limit} verfügbar`}
        </span>
        <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isBlocked ? 'bg-red-500' : isWarning ? 'bg-yellow-400' : 'bg-green-400'}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <span className="text-gray-400 font-mono whitespace-nowrap">{callsCount}/{limit}</span>
      </div>

      {/* Panel Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {loadedFromCache && panelData && !isPanelLoading && (
          <div className="bg-blue-50 border border-blue-200 text-blue-850 text-[12px] p-2.5 rounded-sm flex items-center justify-between gap-2 shadow-xxs">
            <span>KI-Vorschlag aus Cache geladen.</span>
            <button
              onClick={() => panelAd && onStartOptimization(panelAd, true)}
              className="text-blue-700 hover:text-blue-900 font-bold hover:underline shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Neu generieren</span>
            </button>
          </div>
        )}

        {/* Ad Context (Thumbnail + Title) */}
        {panelAd && (
          <div className="flex gap-3 p-3 bg-gray-50 border border-gray-200 rounded-sm">
            <div className="shrink-0 w-[60px] h-[50px] bg-white border border-gray-100 flex items-center justify-center overflow-hidden">
              <img
                src={panelAd.image}
                alt={panelAd.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-[13px] font-semibold text-gray-700 truncate"
                dangerouslySetInnerHTML={{ __html: panelAd.title }}
              />
              <div className="text-[11px] text-gray-500 font-medium">
                {panelAd.category}
              </div>
            </div>
          </div>
        )}

        {/* Skeleton Loader while optimization API runs */}
        {isPanelLoading ? (
          <div className="space-y-6 animate-pulse">
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded-sm w-1/3" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded-sm w-1/2" />
                  <div className="h-8 bg-gray-100 rounded-sm" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded-sm w-1/2" />
                  <div className="h-8 bg-gray-200 rounded-sm" />
                </div>
              </div>
              <div className="h-8 bg-gray-200 rounded-sm w-full mt-2" />
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded-sm w-1/3" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded-sm w-1/2" />
                  <div className="h-20 bg-gray-100 rounded-sm" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded-sm w-1/2" />
                  <div className="h-20 bg-gray-200 rounded-sm" />
                </div>
              </div>
              <div className="h-8 bg-gray-200 rounded-sm w-full mt-2" />
            </div>
            <div className="h-10 bg-gray-100 rounded-sm w-full" />
          </div>
        ) : panelError ? (
          <div className="flex flex-col items-center text-center py-6 gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <div className="px-4">
              <p className="text-[14px] font-semibold text-gray-800 mb-1">
                KI-Optimierung fehlgeschlagen
              </p>
              <p className="text-[12px] text-gray-500 leading-relaxed">
                Der Server ist ausgelastet. Bitte klicke auf 'Erneut versuchen' oder passe deine Beschreibung an.
              </p>
            </div>
            <button
              onClick={() => panelAd && onStartOptimization(panelAd)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#A8C300] hover:bg-[#96ae00] text-white font-semibold text-[13px] rounded-sm transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Erneut versuchen
            </button>
          </div>
        ) : (
          panelData && (
            <>
              {/* Section One: Title Comparison */}
              <div className="space-y-3">
                <h4 className="text-[13px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-1">
                  Anzeigentitel
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="inline-block text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-sm uppercase">
                      Aktuell
                    </span>
                    <p
                      className="text-[12px] text-gray-500 break-words leading-snug line-clamp-4"
                      dangerouslySetInnerHTML={{ __html: panelAd?.title }}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="inline-block text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-sm uppercase">
                      KI-Vorschlag
                    </span>
                    <p className="text-[12px] font-semibold text-gray-800 break-words leading-snug">
                      {panelData.improvedTitle}
                    </p>
                  </div>
                </div>

                {appliedTitle ? (
                  <div className="w-full flex items-center justify-center gap-1.5 bg-green-50 border border-green-200 text-green-700 py-1.5 rounded-sm text-[13px] font-medium">
                    <Check className="w-4 h-4" />
                    <span>Kopiert!</span>
                  </div>
                ) : (
                  <button
                    onClick={onApplyTitle}
                    disabled={isApplyingTitle}
                    className="w-full bg-[#f2f2f2] hover:bg-[#e6e6e6] border border-[#ccc] text-[#333] font-semibold py-1.5 rounded-sm text-[13px] transition-colors flex items-center justify-center gap-1"
                  >
                    {isApplyingTitle && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>📋 Kopieren</span>
                  </button>
                )}
              </div>

              {/* Section Two: Description Comparison */}
              <div className="space-y-3">
                <h4 className="text-[13px] font-bold text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-1">
                  Beschreibung
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="inline-block text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-sm uppercase">
                      Aktuell
                    </span>
                    <div className="text-[11px] text-gray-500 leading-relaxed overflow-y-auto max-h-[140px] break-words pr-1">
                      {panelAd?.description || 'Keine Beschreibung vorhanden'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="inline-block text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-sm uppercase">
                      KI-Vorschlag
                    </span>
                    <div className="text-[11px] font-medium text-gray-800 leading-relaxed overflow-y-auto max-h-[140px] break-words pr-1">
                      {panelData.improvedDescription}
                    </div>
                  </div>
                </div>

                {appliedDescription ? (
                  <div className="w-full flex items-center justify-center gap-1.5 bg-green-50 border border-green-200 text-green-700 py-1.5 rounded-sm text-[13px] font-medium">
                    <Check className="w-4 h-4" />
                    <span>Kopiert!</span>
                  </div>
                ) : (
                  <button
                    onClick={onApplyDescription}
                    disabled={isApplyingDescription}
                    className="w-full bg-[#f2f2f2] hover:bg-[#e6e6e6] border border-[#ccc] text-[#333] font-semibold py-1.5 rounded-sm text-[13px] transition-colors flex items-center justify-center gap-1"
                  >
                    {isApplyingDescription && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>📋 Kopieren</span>
                  </button>
                )}
              </div>

              {/* Improvement Summary */}
              <div className="p-3 bg-green-50/50 border border-green-100 rounded-sm flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-green-600 shrink-0 mt-0.5 animate-pulse" />
                <p className="text-[12px] text-green-800 font-medium leading-normal">
                  {panelData.improvementSummary}
                </p>
              </div>

              {/* Price Suggestion — inline in the KI panel */}
              {panelAd && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-[12px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                    💶 Preisvorschlag
                  </p>
                  <PriceSuggestion
                    adId={panelAd.id}
                    adTitle={panelAd.title}
                    currentPrice={panelAd.price}
                    onCheck={onPriceCheck}
                    aiBlocked={isBlocked}
                  />
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* Footer Actions (Sticky) */}
      {panelData && !isPanelLoading && (
        <div className="p-4 border-t border-[#e5e5e5] bg-gray-50 flex flex-col gap-2">
          <button
            onClick={onApplyAll}
            disabled={isApplyingAll}
            className="w-full bg-[#A8C300] hover:bg-[#96ae00] text-white font-bold py-2 rounded-sm text-[13px] transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            {isApplyingAll && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>📋 Alles kopieren (Titel + Beschreibung)</span>
          </button>
          <button
            onClick={() => panelAd && onStartOptimization(panelAd, true)}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold py-2 rounded-sm text-[13px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
            <span>Neu generieren</span>
          </button>
        </div>
      )}
    </div>
  );
}
