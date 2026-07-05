import React from 'react';
import { Trash2, ExternalLink } from 'lucide-react';
import { useDraftThumbnail } from '../hooks/useDraftThumbnail';

const VintedLogo = () => (
  <svg viewBox="0 0 100 100" className="w-3 h-3 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 15 L45 80 L55 80 L80 15" stroke="#09B1BA" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface DraftCardProps {
  ad: any;
  onOpen: (adId: string) => void;
  onDelete: (adId: string) => void;
}

export function DraftCard({ ad, onOpen, onDelete }: DraftCardProps) {
  const thumbnail = useDraftThumbnail(ad.id);

  return (
    <div className="bg-white border border-[#e5e5e5] rounded-sm shadow-sm flex flex-col md:flex-row overflow-hidden">
      <div className="flex gap-3 p-3 flex-1 min-w-0">
        <div className="w-[100px] h-[100px] shrink-0 bg-[#f5f5f5] rounded-sm overflow-hidden flex items-center justify-center">
          {thumbnail ? (
            <img src={thumbnail} alt={ad.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <span className="text-[#bbb] text-[11px]">Kein Bild</span>
          )}
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[15px] font-semibold text-[#333] leading-snug mb-1 line-clamp-2">{ad.title || 'Unbenannter Entwurf'}</span>
          <div className="text-[12px] text-[#888] mb-0.5">{ad.category}</div>
          <div className="text-[12px] text-[#888] mb-2">{ad.date}</div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-200">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> Entwurf
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#f2f7e6] text-[#6f8f00] px-2 py-0.5 rounded-full border border-[#d4e39a]">
              kleinanzeigen
            </span>
            {ad.vinted && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#e6f7f8] text-[#09B1BA] px-2 py-0.5 rounded-full border border-[#b8e8ea]">
                <VintedLogo /> Vinted
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="w-full md:w-[160px] bg-[#fdfdfd] md:border-l border-t md:border-t-0 border-[#e5e5e5] p-2.5 flex md:flex-col gap-2 shrink-0 justify-end">
        <button
          onClick={() => onOpen(ad.id)}
          className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold text-white bg-[#A8C300] hover:bg-[#96ae00] rounded-sm py-2 px-3 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Öffnen
        </button>
        <button
          onClick={() => onDelete(ad.id)}
          className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold text-red-600 border border-red-200 bg-white hover:bg-red-50 rounded-sm py-2 px-3 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Löschen
        </button>
      </div>
    </div>
  );
}
