import React, { useState, useEffect } from 'react';
import { Bot, Loader2, X } from 'lucide-react';
import { ReplyTemplate, ReplyTemplatesApi } from '../../api/reply-templates';

export function AiTemplateModal({ isOpen, onClose, onSaved }: { isOpen: boolean, onClose: () => void, onSaved: () => void }) {
  const [ads, setAds] = useState<any[]>([]);
  const [selectedAdId, setSelectedAdId] = useState<string>('');
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTemplates, setGeneratedTemplates] = useState<(Partial<ReplyTemplate> & { selected: boolean })[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAds();
      setGeneratedTemplates([]);
      setSelectedAdId('');
      setError('');
    }
  }, [isOpen]);

  const loadAds = async () => {
    setIsLoadingAds(true);
    try {
      const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/ads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAds(data.data);
      }
    } catch (e) {
      console.error('Failed to load ads for modal', e);
    } finally {
      setIsLoadingAds(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedAdId) return;
    
    const ad = ads.find(a => a.id === selectedAdId);
    if (!ad) return;

    setIsGenerating(true);
    setError('');
    
    try {
      const templates = await ReplyTemplatesApi.generateFromAd({
        title: ad.title,
        description: ad.description,
        price: ad.price,
        category: ad.category || 'Sonstiges',
      });
      
      // Select first 3 by default
      const withSelection = templates.map((t, index) => ({
        ...t,
        selected: index < 3
      }));
      setGeneratedTemplates(withSelection);
    } catch (e: any) {
      setError(e.message || 'Fehler bei der Generierung');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    const toSave = generatedTemplates.filter(t => t.selected).map(({ selected, ...rest }) => rest);
    if (toSave.length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      await ReplyTemplatesApi.saveGenerated(toSave);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSelection = (index: number) => {
    const next = [...generatedTemplates];
    next[index].selected = !next[index].selected;
    setGeneratedTemplates(next);
  };

  if (!isOpen) return null;

  const selectedCount = generatedTemplates.filter(t => t.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ka-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ka-gray-100">
          <h2 className="text-xl font-bold flex items-center gap-2 text-ka-gray-900">
            <Bot className="w-6 h-6 text-brand" /> 
            KI-Vorlagen generieren
          </h2>
          <button onClick={onClose} className="p-2 text-ka-gray-400 hover:text-ka-gray-600 rounded-full hover:bg-ka-gray-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 bg-red-50 text-red-600 p-3 rounded text-sm border border-red-200">
              {error}
            </div>
          )}

          {generatedTemplates.length === 0 ? (
            <div className="space-y-4">
              <p className="font-medium text-ka-gray-900">Schritt 1: Wähle eine deiner Anzeigen</p>
              
              {isLoadingAds ? (
                <div className="h-10 border rounded bg-gray-50 flex items-center px-3 text-sm text-gray-500">Lade Anzeigen...</div>
              ) : (
                <select 
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:border-brand focus:ring-brand text-sm"
                  value={selectedAdId}
                  onChange={(e) => setSelectedAdId(e.target.value)}
                >
                  <option value="">-- Anzeige auswählen --</option>
                  {ads.map(ad => (
                    <option key={ad.id} value={ad.id}>
                      {ad.title} ({ad.price}) - {ad.viewCount || 0} Aufrufe
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={handleGenerate}
                disabled={!selectedAdId || isGenerating}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-lg font-medium hover:bg-brand-dark transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Analysiere Anzeige...</>
                ) : (
                  'Generieren'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="font-medium text-ka-gray-900">Schritt 2: Wähle Vorlagen zum Speichern</p>
              
              <div className="space-y-3">
                {generatedTemplates.map((template, idx) => (
                  <div 
                    key={idx} 
                    className={`border rounded-lg p-4 cursor-pointer transition-colors flex gap-3 ${template.selected ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => toggleSelection(idx)}
                  >
                    <div className="pt-1">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-brand border-gray-300 rounded focus:ring-brand"
                        checked={template.selected}
                        onChange={() => {}} // handled by parent div click
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2 mb-1">
                        <span>{template.icon}</span> {template.title}
                      </h4>
                      <p className="text-sm text-gray-600 line-clamp-2">{template.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {generatedTemplates.length > 0 && (
          <div className="p-6 border-t border-ka-gray-100 bg-ka-gray-50 flex justify-end gap-3 rounded-b-xl">
            <button 
              onClick={() => setGeneratedTemplates([])}
              className="px-4 py-2 text-sm font-medium text-ka-gray-700 hover:bg-ka-gray-200 rounded-lg transition-colors"
            >
              Zurück
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving || selectedCount === 0}
              className="px-6 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Ausgewählte speichern ({selectedCount})
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
