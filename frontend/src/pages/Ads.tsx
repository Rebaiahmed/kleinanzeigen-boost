import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, X, RefreshCw, Sparkles } from 'lucide-react';
import { useAdsActions } from '../hooks/useAdsActions';
import { AdGrid } from '../components/AdGrid';
import { Toast } from '../components/Toast';

export function Ads() {
  const navigate = useNavigate();
  const [ads, setAds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scheduleModalAd, setScheduleModalAd] = useState<string | null>(null);

  const {
    fetchAds,
    syncAds,
    handleAction,
    handleAIOptimize,
    handlePriceCheck,
    handleVintedCrossPost,
    handleEbayCrossPost,
    isSyncing,
    toastMessage,
    toastType,
  } = useAdsActions();

  useEffect(() => {
    fetchAds().then((result) => {
      if (result !== undefined) setAds(result);
      setIsLoading(false);
    });
  }, [fetchAds]);

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleModalAd(null);
  };

  const refreshAds = () =>
    fetchAds().then((result) => {
      if (result !== undefined) setAds(result);
    });

  return (
    <div className="w-full relative">
      {/* Top bar */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#333]">Meine Anzeigen</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => syncAds(setAds)}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-[#f2f2f2] hover:bg-[#e6e6e6] border border-[#ccc] text-[#333] font-medium py-1.5 px-3 rounded-sm transition-colors text-[13px] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Synchronisieren</span>
          </button>
          <button
            onClick={() => navigate('/create-with-ai')}
            className="bg-[#A8C300] hover:bg-[#96ae00] text-white font-medium py-1.5 px-3 rounded-sm transition-colors text-[13px] flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Neue Anzeige mit KI erstellen</span>
          </button>
          <button className="bg-[#A8C300] hover:bg-[#96ae00] text-white font-medium py-1.5 px-3 rounded-sm transition-colors text-[13px]">
            Anzeige aufgeben
          </button>
        </div>
      </div>

      {/* Ad list */}
      {isLoading ? (
        <div className="text-center py-12 text-[#666]">Lade Anzeigen...</div>
      ) : ads.length === 0 ? (
        <div className="text-center py-12 text-[#666]">
          Keine Anzeigen gefunden. Klicke auf &quot;Synchronisieren&quot;, um deine Anzeigen von Kleinanzeigen abzurufen.
        </div>
      ) : (
        <AdGrid
          ads={ads}
          onAction={(action, adId, successMsg) => {
            handleAction(action, adId, successMsg, refreshAds);
          }}
          onAIOptimize={(adId) => {
            handleAIOptimize(adId);
          }}
          onPriceCheck={(adId) => {
            handlePriceCheck(adId);
          }}
          onSchedule={(adId) => {
            setScheduleModalAd(adId);
          }}
          onVintedCrossPost={(adId) => {
            handleVintedCrossPost(adId);
          }}
          onEbayCrossPost={(adId) => {
            handleEbayCrossPost(adId);
          }}
        />
      )}

      {/* Schedule Modal */}
      {scheduleModalAd !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#333] bg-opacity-50">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-3 border-b border-[#e5e5e5] flex justify-between items-center">
              <h3 className="text-[16px] font-semibold text-[#333] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#7C3AED]" /> Zeitplan
              </h3>
              <button onClick={() => setScheduleModalAd(null)} className="text-[#666] hover:text-[#333]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSchedule} className="p-5 space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#333] mb-1">Intervall</label>
                <select className="w-full border border-[#ccc] rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-[#7C3AED]">
                  <option>Täglich</option>
                  <option>Alle 3 Tage</option>
                  <option>Wöchentlich</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#333] mb-1">Wann?</label>
                <input
                  type="time"
                  defaultValue="18:00"
                  className="w-full border border-[#ccc] rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-[#7C3AED]"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleModalAd(null)}
                  className="px-3 py-1.5 text-[13px] font-medium text-[#333] bg-[#f2f2f2] border border-[#ccc] hover:bg-[#e6e6e6] rounded-sm transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-[13px] font-medium text-white bg-[#7C3AED] hover:bg-purple-700 rounded-sm transition-colors"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      <Toast message={toastMessage} type={toastType} />
    </div>
  );
}
