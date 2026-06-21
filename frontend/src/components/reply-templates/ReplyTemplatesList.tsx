import React, { useState, useEffect, useCallback } from 'react';
import { ReplyTemplate, ReplyTemplatesApi } from '../../api/reply-templates';
import { Copy, Plus, Trash2, Edit2, CheckCircle2, Loader2, X, Wand2 } from 'lucide-react';
import { AiTemplateModal } from './AiTemplateModal';

// AI template generation is on by default; set VITE_FEATURE_AI_TEMPLATES=false to
// hide it. (Previously required ===  'true', which silently disabled the button in
// any build where the env var didn't reach Vite — e.g. the VPS build, which only
// injects VITE_API_URL. Default-on avoids that footgun.)
const AI_TEMPLATES_ENABLED = (import.meta as any).env.VITE_FEATURE_AI_TEMPLATES !== 'false';

const STARTER_TEMPLATES = [
  { icon: '📦', title: 'Verfügbarkeit', content: 'Ja, der Artikel ist noch verfügbar! Bei Interesse gerne melden.' },
  { icon: '📮', title: 'Versand', content: 'Versand ist möglich. Die Versandkosten trägt der Käufer. Zahlung per PayPal oder Überweisung.' },
  { icon: '💰', title: 'Preis', content: 'Der Preis ist mein letztes Wort — der Artikel ist den Preis wert. Bitte keine weiteren Preisanfragen.' },
  { icon: '📏', title: 'Details', content: 'Der Artikel ist in gutem Zustand, wie auf den Fotos zu sehen. Alle weiteren Details gerne auf Anfrage.' },
  { icon: '🚚', title: 'Abholung', content: 'Abholung nach Absprache möglich. Bitte vor dem Vorbeikommen eine kurze Nachricht schicken.' },
];

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

function getToken() {
  return localStorage.getItem('kb_session') || localStorage.getItem('token');
}

const ICON_OPTIONS = ['💬', '📦', '📮', '💰', '📏', '🚚', '✅', '🙏', '⏰', '🔔'];

export function ReplyTemplatesList() {
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAddingStarter, setIsAddingStarter] = useState(false);

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ icon: '💬', title: '', content: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await ReplyTemplatesApi.getAll();
      setTemplates(data);
    } catch (e) {
      console.error('Failed to load templates:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);


  const openCreate = () => {
    setEditingId(null);
    setFormData({ icon: '💬', title: '', content: '' });
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (t: ReplyTemplate) => {
    setEditingId(t.id || null);
    setFormData({ icon: t.icon, title: t.title, content: t.content });
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormError(null);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) return;
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        await ReplyTemplatesApi.update(editingId, formData);
      } else {
        await ReplyTemplatesApi.create(formData);
      }
      closeForm();
      await load();
    } catch (e: any) {
      setFormError(e.message || 'Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Vorlage wirklich löschen?')) return;
    try {
      await ReplyTemplatesApi.delete(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  const handleAddStarters = async () => {
    setIsAddingStarter(true);
    try {
      for (const t of STARTER_TEMPLATES) {
        await ReplyTemplatesApi.create(t);
      }
      await load();
    } catch (e) {
      console.error('Failed to add starter templates:', e);
    } finally {
      setIsAddingStarter(false);
    }
  };

  const handleCopy = async (template: ReplyTemplate) => {
    try {
      await navigator.clipboard.writeText(template.content);
      setCopiedId(template.id || null);
      setTimeout(() => setCopiedId(null), 2000);
      if (template.id) ReplyTemplatesApi.copy(template.id).catch(() => {});
    } catch {}
  };

  return (
    <div className="bg-white border border-[#e5e5e5] rounded-lg shadow-sm p-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#333] flex items-center gap-2">
            📋 Meine Antwort-Vorlagen
          </h2>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Kopiere eine Vorlage und füge sie direkt im Kleinanzeigen-Chat ein.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {AI_TEMPLATES_ENABLED && (
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="inline-flex items-center gap-2 border border-[#A8C300] text-[#A8C300] hover:bg-[#A8C300] hover:text-white font-semibold py-2 px-4 rounded text-[13px] transition-colors"
            >
              <Wand2 className="w-4 h-4" />
              KI-Vorlagen
            </button>
          )}
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-[#A8C300] hover:bg-[#96ae00] text-white font-semibold py-2 px-4 rounded text-[13px] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Neue Vorlage
          </button>
        </div>
      </div>


      {/* Inline create/edit form */}
      {isFormOpen && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[14px] font-bold text-gray-800">
              {editingId ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
            </h3>
            <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Icon picker */}
          <div className="mb-3">
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, icon }))}
                  className={`w-8 h-8 rounded text-base flex items-center justify-center transition-colors ${
                    formData.icon === icon
                      ? 'bg-[#A8C300]/20 border-2 border-[#A8C300]'
                      : 'border border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="mb-3">
            <label className="block text-[12px] font-semibold text-gray-600 mb-1">Titel</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
              placeholder="z.B. Verfügbarkeit, Versand, Preis…"
              maxLength={60}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#A8C300]"
            />
          </div>

          {/* Content */}
          <div className="mb-4">
            <label className="block text-[12px] font-semibold text-gray-600 mb-1">Text (wird kopiert)</label>
            <textarea
              value={formData.content}
              onChange={e => setFormData(f => ({ ...f, content: e.target.value }))}
              placeholder="Ja, der Artikel ist noch verfügbar! Bei Interesse gerne melden."
              rows={4}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#A8C300] resize-none"
            />
          </div>

          {formError && (
            <p className="text-red-600 text-[12px] mb-3">{formError}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={closeForm}
              className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={!formData.title.trim() || !formData.content.trim() || isSaving}
              className="inline-flex items-center gap-2 bg-[#A8C300] hover:bg-[#96ae00] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-2 px-4 rounded text-[13px] transition-colors"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Speichern
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-gray-100 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-full mb-2" />
              <div className="h-3 bg-gray-100 rounded w-3/4 mb-4" />
              <div className="h-8 bg-gray-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        // While the create form is open, hide the quick-start so the two paths
        // don't compete (avoids decision paralysis on an empty page).
        isFormOpen ? null : (
        <div className="space-y-4">
          {/* Starter templates CTA */}
          <div className="border border-dashed border-[#A8C300]/50 bg-green-50/30 rounded-lg p-5">
            <p className="text-[14px] font-semibold text-gray-700 mb-1">🚀 Schnellstart mit 5 fertigen Vorlagen</p>
            <p className="text-[13px] text-gray-500 mb-4">
              Verfügbarkeit, Versand, Preis, Details & Abholung — sofort einsatzbereit, jederzeit anpassbar.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-4">
              {STARTER_TEMPLATES.map(t => (
                <div key={t.title} className="bg-white border border-gray-200 rounded px-2 py-1.5 text-center">
                  <p className="text-base">{t.icon}</p>
                  <p className="text-[11px] font-semibold text-gray-600">{t.title}</p>
                </div>
              ))}
            </div>
            <button
              onClick={handleAddStarters}
              disabled={isAddingStarter}
              className="inline-flex items-center gap-2 bg-[#A8C300] hover:bg-[#96ae00] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-2 px-5 rounded text-[13px] transition-colors"
            >
              {isAddingStarter ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird hinzugefügt…</> : '+ Alle 5 Vorlagen hinzufügen'}
            </button>
          </div>

          <div className="text-center py-4 text-[13px] text-gray-400">
            oder <button onClick={openCreate} className="text-[#A8C300] hover:underline font-medium">eigene Vorlage erstellen</button>
          </div>
        </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <div
              key={template.id}
              className="border border-[#e5e5e5] rounded-lg p-4 hover:shadow-sm transition-shadow bg-white relative group flex flex-col"
            >
              {/* Card header */}
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-[14px] font-bold text-gray-800 flex items-center gap-1.5">
                  <span>{template.icon}</span>
                  {template.title}
                </h4>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(template)}
                    title="Bearbeiten"
                    className="p-1.5 text-gray-400 hover:text-[#A8C300] hover:bg-green-50 rounded transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id!)}
                    title="Löschen"
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Content preview */}
              <p className="text-[13px] text-gray-600 line-clamp-3 flex-1 mb-4 whitespace-pre-wrap">
                {template.content}
              </p>

              {/* Copy button */}
              <button
                onClick={() => handleCopy(template)}
                className={`w-full flex justify-center items-center gap-2 py-2 px-3 rounded text-[13px] font-semibold transition-colors ${
                  copiedId === template.id
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {copiedId === template.id ? (
                  <><CheckCircle2 className="w-4 h-4" /> Kopiert!</>
                ) : (
                  <><Copy className="w-4 h-4" /> Kopieren</>
                )}
              </button>

              {/* Copy count badge */}
              {template.copyCount > 0 && (
                <p className="text-[10px] text-gray-400 text-center mt-1.5">
                  {template.copyCount}× verwendet
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer tip */}
      {templates.length > 0 && (
        <p className="text-[12px] text-gray-400 mt-5 text-center">
          Klicke auf <strong>Kopieren</strong> und füge den Text mit <kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 font-mono text-[11px]">Strg+V</kbd> direkt im Kleinanzeigen-Chat ein.
        </p>
      )}

      {/* Plan counter for free users */}

      {/* AI generation modal */}
      {isAiModalOpen && (
        <AiTemplateModal
          existingTitles={templates.map(t => t.title)}
          onClose={() => setIsAiModalOpen(false)}
          onSaved={() => { setIsAiModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}
