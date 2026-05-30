import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Eye, Heart, MessageSquare, ChevronDown, CheckCircle2, Clock, PauseCircle, Edit2, Play, Trash2, Calendar, X, RefreshCw } from 'lucide-react';

const MOCK_ADS = [
  { 
    id: 1, 
    title: 'Apple iPhone 13 Pro 128GB Graphit - Top Zustand!', 
    category: 'Elektronik - Smartphones',
    price: '650 €', 
    interval: 'Täglich', 
    next: 'Heute 18:00', 
    status: 'Aktiv',
    views: 142,
    favorites: 12,
    messages: 3,
    date: 'Heute, 10:24',
    location: '10115 Berlin - Mitte',
    image: 'https://via.placeholder.com/150/f5f5f5/a0a0a0?text=iPhone'
  },
  { 
    id: 2, 
    title: 'IKEA Bekant Schreibtisch 160x80cm Weiß', 
    category: 'Familie, Kind & Baby - Möbel',
    price: '120 € VB', 
    interval: 'Alle 3 Tage', 
    next: 'Morgen 10:00', 
    status: 'Reserviert',
    views: 45,
    favorites: 2,
    messages: 1,
    date: 'Gestern, 14:30',
    location: '20354 Hamburg - Altstadt',
    image: 'https://via.placeholder.com/150/f5f5f5/a0a0a0?text=Desk'
  },
  { 
    id: 3, 
    title: 'Winterreifen Michelin 205/55 R16 auf Stahlfelgen', 
    category: 'Auto, Rad & Boot - Autoteile & Reifen',
    price: '180 €', 
    interval: 'Wöchentlich', 
    next: 'In 4 Tagen', 
    status: 'Pausiert',
    views: 8,
    favorites: 0,
    messages: 0,
    date: '12.05.2026',
    location: '80331 München - Altstadt-Lehel',
    image: 'https://via.placeholder.com/150/f5f5f5/a0a0a0?text=Tires'
  },
];

export function Ads() {
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [scheduleModalAd, setScheduleModalAd] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const toggleDropdown = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenDropdown(openDropdown === id ? null : id);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown !== null && dropdownRefs.current[openDropdown]) {
        if (!dropdownRefs.current[openDropdown]?.contains(event.target as Node)) {
          setOpenDropdown(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleModalAd(null);
    setToastMessage('Zeitplan wurde erfolgreich aktualisiert');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    // Mock backend sync
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSyncing(false);
    setToastMessage('Anzeigen wurden erfolgreich synchronisiert');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="w-full relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#333]">Meine Anzeigen</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-[#f2f2f2] hover:bg-[#e6e6e6] border border-[#ccc] text-[#333] font-medium py-1.5 px-3 rounded-sm transition-colors text-[13px] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Synchronisieren</span>
          </button>
          <button className="bg-[#A8C300] hover:bg-[#96ae00] text-white font-medium py-1.5 px-3 rounded-sm transition-colors text-[13px]">
            Anzeige aufgeben
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {MOCK_ADS.map((ad) => (
          <div key={ad.id} className="bg-white border border-[#e5e5e5] flex flex-col md:flex-row hover:shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-shadow">
            
            {/* Left side: Image & Metadata */}
            <div className="flex flex-col sm:flex-row flex-1 p-3 gap-3 border-b md:border-b-0 border-[#e5e5e5]">
              <div className="shrink-0 w-full sm:w-[130px] h-[100px] bg-[#f5f5f5] flex items-center justify-center overflow-hidden">
                <img src={ad.image} alt={ad.title} className="w-full h-full object-cover mix-blend-multiply" />
              </div>
              
              <div className="flex flex-col justify-between flex-1">
                <div>
                  <h3 className="text-[16px] font-semibold text-[#333] hover:underline cursor-pointer leading-tight mb-1">{ad.title}</h3>
                  <div className="text-[13px] text-[#666] mb-1">{ad.category}</div>
                  <div className="text-[13px] text-[#666] mb-1">{ad.location}</div>
                  <div className="text-[13px] text-[#666] mb-2">{ad.date}</div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[13px] font-medium text-[#666]">
                  <div className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {ad.views}</div>
                  <div className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {ad.favorites}</div>
                  <div className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> {ad.messages}</div>
                  
                  <div className="ml-auto">
                    {ad.status === 'Aktiv' && <span className="flex items-center gap-1 text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> Aktiv</span>}
                    {ad.status === 'Reserviert' && <span className="flex items-center gap-1 text-orange-600"><Clock className="w-3.5 h-3.5" /> Reserviert</span>}
                    {ad.status === 'Pausiert' && <span className="flex items-center gap-1 text-[#666]"><PauseCircle className="w-3.5 h-3.5" /> Pausiert</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Options & Actions */}
            <div className="w-full md:w-[260px] bg-[#fdfdfd] md:border-l border-[#e5e5e5] p-3 flex flex-col justify-between shrink-0">
              
              <div className="mb-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[13px] font-semibold text-[#333] uppercase">Optionen</span>
                  <span className="text-[16px] font-bold text-[#333]">{ad.price}</span>
                </div>
                <label className="flex items-start gap-2 cursor-pointer group mt-2">
                  <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 text-ka-green border-[#ccc] rounded-sm focus:ring-ka-green cursor-pointer" defaultChecked={ad.status !== 'Pausiert'} />
                  <div className="text-[13px]">
                    <span className="block font-medium text-[#333] group-hover:text-ka-green-dark transition-colors">Auto-Repost</span>
                    <span className="text-[12px] text-[#666] block">Nächster: {ad.next}</span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-1.5 mt-auto">
                <button className="flex justify-center items-center gap-1 text-[13px] font-medium text-[#333] bg-[#f2f2f2] border border-[#ccc] hover:bg-[#e6e6e6] rounded-sm py-1 transition-colors">
                  <Edit2 className="w-3 h-3" /> Bearbeiten
                </button>
                {ad.status === 'Pausiert' ? (
                  <button className="flex justify-center items-center gap-1 text-[13px] font-medium text-[#333] bg-[#f2f2f2] border border-[#ccc] hover:bg-[#e6e6e6] rounded-sm py-1 transition-colors">
                    <Play className="w-3 h-3" /> Aktivieren
                  </button>
                ) : (
                  <button className="flex justify-center items-center gap-1 text-[13px] font-medium text-[#333] bg-[#f2f2f2] border border-[#ccc] hover:bg-[#e6e6e6] rounded-sm py-1 transition-colors">
                    <PauseCircle className="w-3 h-3" /> Pausieren
                  </button>
                )}
                <button className="flex justify-center items-center gap-1 text-[13px] font-medium text-[#333] bg-[#f2f2f2] border border-[#ccc] hover:bg-[#e6e6e6] rounded-sm py-1 transition-colors">
                  <Trash2 className="w-3 h-3" /> Löschen
                </button>
                
                {/* Mehr Dropdown Wrapper */}
                <div 
                  className="relative" 
                  ref={(el) => dropdownRefs.current[ad.id] = el}
                >
                  <button 
                    onClick={(e) => toggleDropdown(ad.id, e)}
                    className="w-full flex justify-center items-center gap-1 text-[13px] font-medium text-[#333] bg-[#f2f2f2] border border-[#ccc] hover:bg-[#e6e6e6] rounded-sm py-1 transition-colors"
                  >
                    Mehr <ChevronDown className="w-3 h-3" />
                  </button>

                  {openDropdown === ad.id && (
                    <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-[#ccc] rounded-sm shadow-lg z-50 py-1">
                      {/* Standard Actions */}
                      <button className="w-full text-left px-3 py-1.5 text-[13px] text-[#333] hover:bg-[#f5f5f5] border-l-2 border-transparent">
                        Statistik ansehen
                      </button>
                      <button className="w-full text-left px-3 py-1.5 text-[13px] text-[#333] hover:bg-[#f5f5f5] border-l-2 border-transparent">
                        Als reserviert markieren
                      </button>
                      
                      <div className="my-1 border-t border-[#eee]"></div>
                      
                      {/* AI & Scheduling Actions */}
                      <button className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] font-semibold text-[#7C3AED] hover:bg-purple-50 hover:text-purple-800 transition-colors border-l-2 border-transparent hover:border-[#7C3AED]">
                        <Sparkles className="w-3 h-3" /> KI-Optimierung
                      </button>
                      <button className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] font-semibold text-[#7C3AED] hover:bg-purple-50 hover:text-purple-800 transition-colors border-l-2 border-transparent hover:border-[#7C3AED]">
                        <Sparkles className="w-3 h-3" /> Preis prüfen
                      </button>
                      <button 
                        onClick={() => { setScheduleModalAd(ad.id); setOpenDropdown(null); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] font-semibold text-[#7C3AED] hover:bg-purple-50 hover:text-purple-800 transition-colors border-l-2 border-transparent hover:border-[#7C3AED]"
                      >
                        <Calendar className="w-3 h-3" /> Zeitplan
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>

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
                <input type="time" defaultValue="18:00" className="w-full border border-[#ccc] rounded-sm px-3 py-2 text-[13px] focus:outline-none focus:border-[#7C3AED]" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setScheduleModalAd(null)} className="px-3 py-1.5 text-[13px] font-medium text-[#333] bg-[#f2f2f2] border border-[#ccc] hover:bg-[#e6e6e6] rounded-sm transition-colors">
                  Abbrechen
                </button>
                <button type="submit" className="px-3 py-1.5 text-[13px] font-medium text-white bg-[#7C3AED] hover:bg-purple-700 rounded-sm transition-colors">
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#333] text-white px-5 py-2.5 rounded-sm shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <CheckCircle2 className="w-4 h-4 text-[#A8C300]" />
          <span className="text-[13px] font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
