import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { WettbewerbSearch } from '../../hooks/useWettbewerbSearches';
import { CHECK_INTERVAL_OPTIONS } from '../../config/wettbewerbConstants';

interface SavedSearchCardProps {
  search: WettbewerbSearch;
  onDelete: (searchId: string) => void;
  onApplyPrice: (searchId: string, adId: string) => Promise<{ success: boolean; message?: string }>;
  onRepost: (searchId: string, adId: string) => Promise<{ success: boolean; message?: string }>;
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  const diffD = Math.round(diffH / 24);
  return `vor ${diffD} Tag${diffD === 1 ? '' : 'en'}`;
}

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center text-[11px] font-medium bg-[#f5f5f5] text-[#666] px-2 py-0.5 rounded-full border border-[#e0e0e0]">
    {children}
  </span>
);

export function SavedSearchCard({ search, onDelete, onApplyPrice, onRepost }: SavedSearchCardProps) {
  const [actionPending, setActionPending] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const snapshot = search.latestSnapshot;
  const intervalLabel = CHECK_INTERVAL_OPTIONS.find((o) => o.value === search.checkIntervalDays)?.label || '';

  const hasVerdict = !!snapshot && snapshot.priceRangeLow != null && snapshot.priceRangeHigh != null;
  const rankBadgeText = snapshot?.userAdRank != null ? `Platz ${snapshot.userAdRank} von ${snapshot.totalResultsFound}` : 'Nicht platziert';

  const runAction = async (fn: () => Promise<{ success: boolean; message?: string }>) => {
    setActionPending(true);
    setActionMessage(null);
    const res = await fn();
    setActionMessage(res.success ? 'Erledigt.' : res.message || 'Aktion fehlgeschlagen.');
    setActionPending(false);
  };

  return (
    <div className="bg-white border border-[#e5e5e5] rounded-sm shadow-sm p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="text-[15px] font-semibold text-[#333]">
            {search.keyword} · {search.plz}
          </span>
          <div className="flex gap-1.5 mt-1">
            <Tag>{search.radiusKm === 0 ? 'Nur PLZ' : `${search.radiusKm} km`}</Tag>
            <Tag>{intervalLabel}</Tag>
          </div>
          <div className="text-[12px] text-[#888] mt-1">
            {search.lastCheckedAt ? `Zuletzt geprüft: ${formatRelative(search.lastCheckedAt)}` : 'Erste Prüfung läuft…'}
          </div>
        </div>
        <button onClick={() => onDelete(search.id)} title="Suche löschen" className="text-[#999] hover:text-red-600">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {hasVerdict && snapshot && (
        <div className="bg-amber-50 border border-amber-200 rounded-sm p-3 mb-3">
          <span className="inline-block text-[11px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full mb-1.5">
            {rankBadgeText}
          </span>
          <p className="text-[13px] text-amber-900">
            Preise liegen zwischen {snapshot.priceRangeLow}€–{snapshot.priceRangeHigh}€.
            {snapshot.suggestedPriceLow != null && snapshot.suggestedPriceHigh != null && (
              <> Für Platz 1–2 empfehlen wir {snapshot.suggestedPriceLow}€–{snapshot.suggestedPriceHigh}€.</>
            )}
          </p>
          {snapshot.userAdId && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => runAction(() => onApplyPrice(search.id, snapshot.userAdId!))}
                disabled={actionPending}
                className="px-2.5 py-1 text-[12px] font-medium text-white bg-[#A8C300] hover:bg-[#96ae00] disabled:opacity-50 rounded-sm transition-colors"
              >
                Preis übernehmen
              </button>
              <button
                onClick={() => runAction(() => onRepost(search.id, snapshot.userAdId!))}
                disabled={actionPending}
                className="px-2.5 py-1 text-[12px] font-medium text-[#333] bg-white border border-[#ccc] hover:bg-[#f5f5f5] disabled:opacity-50 rounded-sm transition-colors"
              >
                Jetzt neu inserieren
              </button>
            </div>
          )}
          {actionMessage && <p className="text-[11px] text-amber-800 mt-1.5">{actionMessage}</p>}
        </div>
      )}

      {snapshot && !hasVerdict && snapshot.totalResultsFound > 0 && (
        <p className="text-[12px] text-[#888] mb-3">Nicht genügend vergleichbare Preise für eine Einschätzung.</p>
      )}
      {snapshot && snapshot.totalResultsFound === 0 && (
        <p className="text-[12px] text-[#888] mb-3">Keine vergleichbaren Angebote in deiner Region gefunden.</p>
      )}
      {search.lastCheckError && <p className="text-[12px] text-red-600 mb-3">{search.lastCheckError}</p>}

      {snapshot && snapshot.topCompetitors.length > 0 && (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[#999] text-left">
              <th className="font-medium pb-1 w-10">Platz</th>
              <th className="font-medium pb-1">Titel</th>
              <th className="font-medium pb-1 w-20">Preis</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.topCompetitors.map((row) => (
              <tr key={row.adId} className={row.isOwn ? 'bg-green-50' : ''}>
                <td className="py-1 text-[#666]">{row.rank}</td>
                <td className="py-1 truncate max-w-[220px]">
                  {row.title}
                  {row.isOwn && (
                    <span className="ml-1.5 inline-flex items-center text-[10px] font-bold bg-[#A8C300] text-white px-1.5 py-0.5 rounded-full align-middle">
                      DU
                    </span>
                  )}
                </td>
                <td className="py-1 text-[#333]">{row.priceEUR != null ? `${row.priceEUR} €` : 'VB'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {snapshot && snapshot.userAdRank != null && snapshot.userAdRank > 5 && (
        <p className="text-[12px] text-[#666] mt-2">
          Deine Anzeige: Platz {snapshot.userAdRank} von {snapshot.totalResultsFound}
        </p>
      )}
      {snapshot && snapshot.userAdRank == null && snapshot.totalResultsFound > 0 && (
        <p className="text-[12px] text-[#999] mt-2">Deine Anzeige wurde in den Ergebnissen nicht gefunden.</p>
      )}
    </div>
  );
}
