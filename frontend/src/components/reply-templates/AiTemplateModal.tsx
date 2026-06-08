import React, { useState } from 'react';
import { X, Loader2, Wand2, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import { ReplyTemplatesApi } from '../../api/reply-templates';

const ALL_TOPICS = [
  { icon: '📦', key: 'Verfügbarkeit' },
  { icon: '📮', key: 'Versand' },
  { icon: '💰', key: 'Preis' },
  { icon: '📏', key: 'Details' },
  { icon: '🚚', key: 'Abholung' },
];

interface GeneratedTemplate {
  icon: string;
  title: string;
  content: string;
  isDuplicate: boolean;
  selected: boolean;
}

interface Props {
  existingTitles: string[];
  onClose: () => void;
  onSaved: () => void;
}

export function AiTemplateModal({ existingTitles, onClose, onSaved }: Props) {
  const [context, setContext] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>(ALL_TOPICS.map(t => t.key));

  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const toggleTopic = (key: string) => {
    setSelectedTopics(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleGenerate = async () => {
    if (selectedTopics.length === 0) return;
    setIsGenerating(true);
    setError(null);
    setGenerated(null);
    try {
      const templates = await ReplyTemplatesApi.generate(
        context.trim() || undefined,
        selectedTopics,
      );
      setGenerated(templates.map(t => ({
        icon: t.icon || '💬',
        title: t.title || '',
        content: t.content || '',
        isDuplicate: existingTitles.some(e => e.toLowerCase() === (t.title || '').toLowerCase()),
        selected: true,
      })));
    } catch (e: any) {
      setError(e.message || 'KI-Generierung fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleResultSelected = (idx: number) => {
    setGenerated(prev => prev!.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));
  };

  const handleSave = async () => {
    if (!generated) return;
    const toSave = generated.filter(t => t.selected);
    if (toSave.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      const saved = await ReplyTemplatesApi.saveGenerated(
        toSave.map(({ icon, title, content }) => ({ icon, title, content }))
      );
      if (saved.length < toSave.length) {
        // Partial save — plan limit hit
        setError(`Nur ${saved.length} von ${toSave.length} Vorlagen gespeichert — kostenloses Limit erreicht. Upgrade auf Pro für mehr.`);
        setIsSaving(false);
        onSaved(); // still reload the list
      } else {
        onSaved();
      }
    } catch (e: any) {
      setError(e.message || 'Speichern fehlgeschlagen.');
      setIsSaving(false);
    }
  };

  const selectedCount = generated?.filter(t => t.selected).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-[15px] font-bold text-gray-800 flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-[#A8C300]" />
            KI-Vorlagen generieren
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Step 1 — Topic selection (always visible until results) */}
          {!generated && (
            <>
              <div>
                <p className="text-[12px] font-semibold text-gray-600 mb-2">
                  1. Welche Vorlagen soll die KI erstellen?
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {ALL_TOPICS.map(t => {
                    const active = selectedTopics.includes(t.key);
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => toggleTopic(t.key)}
                        className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border-2 transition-colors text-center cursor-pointer ${
                          active
                            ? 'border-[#A8C300] bg-[#A8C300]/10 text-gray-800'
                            : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-xl">{t.icon}</span>
                        <span className="text-[10px] font-semibold leading-tight">{t.key}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedTopics.length === 0 && (
                  <p className="text-[11px] text-red-500 mt-1">Mindestens ein Thema auswählen</p>
                )}
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-gray-600 mb-1">
                  2. Was verkaufst du? <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !isGenerating && selectedTopics.length > 0 && handleGenerate()}
                  placeholder="z.B. Holzbett, Winterjacke, iPhone 13…"
                  className="w-full border border-gray-300 rounded px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#A8C300]"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Je spezifischer, desto passendere Vorlagen erstellt die KI.
                </p>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || selectedTopics.length === 0}
                className="w-full inline-flex justify-center items-center gap-2 bg-[#A8C300] hover:bg-[#96ae00] disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold py-2.5 px-4 rounded text-[13px] transition-colors"
              >
                {isGenerating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> KI generiert {selectedTopics.length} Vorlagen…</>
                  : <><Wand2 className="w-4 h-4" /> {selectedTopics.length} Vorlagen generieren</>
                }
              </button>
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-red-600 text-[12px] bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          {/* Step 3 — Results checklist */}
          {generated && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-semibold text-gray-600">
                  Welche Vorlagen möchtest du speichern? ({selectedCount}/{generated.length})
                </p>
                <button
                  onClick={() => setGenerated(prev => prev!.map(t => ({ ...t, selected: true })))}
                  className="text-[11px] text-[#A8C300] hover:underline font-medium"
                >
                  Alle wählen
                </button>
              </div>

              <div className="space-y-2">
                {generated.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleResultSelected(idx)}
                    className={`w-full text-left border rounded-lg p-3 transition-colors ${
                      t.selected ? 'border-[#A8C300] bg-green-50/50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0">
                        {t.selected
                          ? <CheckSquare className="w-4 h-4 text-[#A8C300]" />
                          : <Square className="w-4 h-4 text-gray-300" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-[13px] font-bold text-gray-800">{t.icon} {t.title}</span>
                          {t.isDuplicate && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-yellow-50 border border-yellow-300 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                              <AlertTriangle className="w-2.5 h-2.5" /> Duplikat
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-gray-500 line-clamp-2">{t.content}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => { setGenerated(null); setError(null); }}
                className="mt-3 text-[12px] text-gray-400 hover:text-gray-600 hover:underline w-full text-center"
              >
                ↺ Neue Vorlagen generieren
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {generated && (
          <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:text-gray-800"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={selectedCount === 0 || isSaving}
              className="inline-flex items-center gap-2 bg-[#A8C300] hover:bg-[#96ae00] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-2 px-5 rounded text-[13px] transition-colors"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {selectedCount} Vorlage{selectedCount !== 1 ? 'n' : ''} speichern
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
