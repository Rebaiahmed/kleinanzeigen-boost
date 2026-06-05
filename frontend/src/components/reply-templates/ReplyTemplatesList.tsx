import React, { useState, useEffect } from 'react';
import { ReplyTemplate, ReplyTemplatesApi } from '../../api/reply-templates';
import { Copy, Plus, Trash2, Edit2, Bot, CheckCircle2 } from 'lucide-react';
import { AiTemplateModal } from './AiTemplateModal';
import { Toast } from '../Toast';

export function ReplyTemplatesList() {
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Manual template form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ icon: '💬', title: '', content: '' });

  const loadTemplates = async () => {
    try {
      const data = await ReplyTemplatesApi.getAll();
      setTemplates(data);
    } catch (e) {
      console.error('Failed to load templates:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification('✅ Kopiert!');
  };

  const handleCopy = async (template: ReplyTemplate) => {
    try {
      copyToClipboard(template.content);
      setCopiedId(template.id || null);
      if (template.id) {
        ReplyTemplatesApi.copy(template.id).catch(console.error); // Track copy async
      }
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Vorlage wirklich löschen?')) return;
    try {
      await ReplyTemplatesApi.delete(id);
      await loadTemplates();
    } catch (e) {
      console.error('Failed to delete template:', e);
    }
  };

  const handleSaveForm = async () => {
    try {
      if (editingId) {
        await ReplyTemplatesApi.update(editingId, formData);
      } else {
        await ReplyTemplatesApi.create(formData);
      }
      setIsFormOpen(false);
      setEditingId(null);
      setFormData({ icon: '💬', title: '', content: '' });
      await loadTemplates();
    } catch (e) {
      console.error('Failed to save template:', e);
    }
  };

  const openEdit = (t: ReplyTemplate) => {
    setEditingId(t.id || null);
    setFormData({ icon: t.icon, title: t.title, content: t.content });
    setIsFormOpen(true);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-ka-gray-100 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2 text-ka-gray-900">
          📋 Meine Antwort-Vorlagen
        </h2>
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            onClick={() => { setIsFormOpen(true); setEditingId(null); setFormData({ icon: '💬', title: '', content: '' }); }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-ka-gray-300 rounded-md text-sm font-medium text-ka-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> Manuelle Vorlage
          </button>
          <button 
            onClick={() => setIsAiModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-brand text-white rounded-md text-sm font-medium hover:bg-brand-dark transition-colors shadow-sm"
          >
            <Bot className="w-4 h-4" /> KI-Vorlagen generieren
          </button>
        </div>
      </div>

      {isFormOpen && (
        <div className="mb-6 bg-ka-gray-50 p-4 rounded-lg border border-ka-gray-200">
          <h3 className="font-semibold mb-4">{editingId ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}</h3>
          <div className="grid grid-cols-12 gap-4 mb-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Icon</label>
              <input 
                type="text" 
                value={formData.icon} 
                onChange={(e) => setFormData({...formData, icon: e.target.value})}
                className="w-full rounded border-gray-300 shadow-sm p-2 text-center" 
                placeholder="📦"
              />
            </div>
            <div className="col-span-10 sm:col-span-11">
              <label className="block text-xs font-medium text-gray-500 mb-1">Titel</label>
              <input 
                type="text" 
                value={formData.title} 
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full rounded border-gray-300 shadow-sm p-2" 
                placeholder="Verfügbarkeit..."
              />
            </div>
            <div className="col-span-12">
              <label className="block text-xs font-medium text-gray-500 mb-1">Text (wird kopiert)</label>
              <textarea 
                value={formData.content} 
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                className="w-full rounded border-gray-300 shadow-sm p-2 min-h-[80px]" 
                placeholder="Ja, der Artikel ist noch da!..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
            >
              Abbrechen
            </button>
            <button 
              onClick={handleSaveForm}
              className="px-4 py-2 text-sm font-medium bg-brand text-white hover:bg-brand-dark rounded"
              disabled={!formData.title || !formData.content}
            >
              Speichern
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="text-gray-500 text-sm">Lade Vorlagen...</p>
        ) : templates.length === 0 ? (
          <p className="text-gray-500 text-sm col-span-full">
            Noch keine Vorlagen vorhanden. Erstelle eine manuell oder nutze die KI!
          </p>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="border border-ka-gray-200 rounded-lg p-4 hover:border-brand/30 transition-colors bg-white relative group">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-ka-gray-900 flex items-center gap-2">
                  <span className="text-xl">{template.icon}</span> {template.title}
                </h4>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(template)} className="p-1.5 text-gray-400 hover:text-brand bg-gray-50 hover:bg-green-50 rounded">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(template.id!)} className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4 line-clamp-3 min-h-[60px] whitespace-pre-wrap">
                {template.content}
              </p>
              
              <button
                onClick={() => handleCopy(template)}
                className={`w-full flex justify-center items-center gap-2 py-2 px-4 rounded text-sm font-medium transition-colors ${
                  copiedId === template.id
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-ka-gray-50 text-ka-gray-700 hover:bg-gray-100 border border-ka-gray-200'
                }`}
              >
                {copiedId === template.id ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> ✅ Kopiert!
                  </>
                ) : (
                  <>
                    📋 Kopieren
                  </>
                )}
              </button>
            </div>
          ))
        )}
      </div>
      
      <p className="text-xs text-gray-500 mt-6 flex items-center gap-1.5">
        <span className="inline-block px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200 text-gray-600 font-mono">Tipp</span>
        Klicke auf Kopieren und füge den Text mit Strg+V direkt im Kleinanzeigen-Chat ein.
      </p>

      <AiTemplateModal 
        isOpen={isAiModalOpen} 
        onClose={() => setIsAiModalOpen(false)} 
        onSaved={loadTemplates}
      />

      <Toast message={toastMessage} type={null} />
    </div>
  );
}
