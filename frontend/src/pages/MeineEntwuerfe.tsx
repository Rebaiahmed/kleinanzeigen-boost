import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, Trash2, X } from 'lucide-react';
import { useAds } from '../hooks/useAds';
import { useAdsActions } from '../hooks/useAdsActions';
import { DraftCard } from '../components/DraftCard';
import { Toast } from '../components/Toast';
import { deleteDraftPhotos } from '../lib/draftPhotoStore';

export function MeineEntwuerfe() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ads, isLoading, invalidateAds } = useAds();
  const { deleteDraft, toastMessage, toastType } = useAdsActions();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const drafts = ads.filter((a: any) => a.status === 'pending');

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    const ok = await deleteDraft(deleteTargetId);
    if (ok) await deleteDraftPhotos(deleteTargetId);
    setIsDeleting(false);
    setDeleteTargetId(null);
    if (ok) invalidateAds();
  };

  return (
    <div className="w-full relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[#333]">{t('drafts.title')}</h1>
        <button
          onClick={() => navigate('/neue-anzeige-mit-ki-erstellen')}
          className="bg-[#A8C300] hover:bg-[#96ae00] text-white font-medium py-1.5 px-3 rounded-sm transition-colors text-[13px] flex items-center gap-1"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t('drafts.createWithAi')}</span>
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-white border border-[#e5e5e5] h-[120px] rounded-sm animate-pulse" />
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-12 text-[#666]">
          <p className="mb-3">{t('drafts.empty')}</p>
          <p className="text-[13px] text-[#999]">
            {t('drafts.emptyHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((ad: any) => (
            <DraftCard
              key={ad.id}
              ad={ad}
              onOpen={(adId) => navigate(`/neue-anzeige-mit-ki-erstellen?draftId=${encodeURIComponent(adId)}`)}
              onDelete={(adId) => setDeleteTargetId(adId)}
            />
          ))}
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#333] bg-opacity-50">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-3 border-b border-[#e5e5e5] flex justify-between items-center">
              <h3 className="text-[16px] font-semibold text-[#333] flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-600" /> {t('drafts.deleteConfirmTitle')}
              </h3>
              <button onClick={() => setDeleteTargetId(null)} className="text-[#666] hover:text-[#333]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-[13px] text-[#555] mb-5">
                {t('drafts.deleteConfirmText')}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteTargetId(null)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-[13px] font-medium text-[#333] bg-[#f2f2f2] border border-[#ccc] hover:bg-[#e6e6e6] rounded-sm transition-colors disabled:opacity-50"
                >
                  {t('drafts.cancel')}
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-[13px] font-medium text-white bg-red-600 hover:bg-red-700 rounded-sm transition-colors disabled:opacity-50"
                >
                  {isDeleting ? t('drafts.deleting') : t('drafts.deleteForever')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMessage} type={toastType} />
    </div>
  );
}
