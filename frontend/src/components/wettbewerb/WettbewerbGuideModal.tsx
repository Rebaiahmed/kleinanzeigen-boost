import React from 'react';
import { HelpCircle, X } from 'lucide-react';

interface WettbewerbGuideModalProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    n: 1,
    title: 'Suchbegriff + PLZ eingeben',
    text: 'Gib ein, wonach du suchst, und in welcher Postleitzahl-Region du vergleichen möchtest. Wir finden ähnliche Anzeigen in deiner Nähe.',
  },
  {
    n: 2,
    title: 'Wir vergleichen automatisch alle 2 Tage',
    text: 'Ab jetzt prüfen wir regelmäßig für dich, was vergleichbare Anzeigen in deiner Region kosten — du musst nichts weiter tun.',
  },
  {
    n: 3,
    title: 'Handeln mit einem Klick',
    text: 'Sobald sich eine bessere Preisspanne zeigt, kannst du deinen Preis direkt übernehmen oder deine Anzeige mit einem Klick neu inserieren.',
  },
];

// No onClick on the backdrop by design — this age group can lose the modal
// accidentally via click-outside-to-close, so the ✕ button and "Verstanden"
// are the only two ways to dismiss it.
export function WettbewerbGuideModal({ open, onClose }: WettbewerbGuideModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#333] bg-opacity-50">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-3 border-b border-[#e5e5e5] flex justify-between items-center">
          <h3 className="text-[16px] font-semibold text-[#333] flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[#A8C300]" /> Wie funktioniert das?
          </h3>
          <button onClick={onClose} className="text-[#666] hover:text-[#333]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {STEPS.map((step) => (
            <div key={step.n} className="flex gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-[#f2f7e6] border border-[#d4e39a] text-[#6f8f00] text-[12px] font-bold flex items-center justify-center">
                {step.n}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#333]">{step.title}</p>
                <p className="text-[12px] text-[#666] mt-0.5">{step.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[#e5e5e5] flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] font-medium text-white bg-[#A8C300] hover:bg-[#96ae00] rounded-sm transition-colors"
          >
            Verstanden
          </button>
        </div>
      </div>
    </div>
  );
}
