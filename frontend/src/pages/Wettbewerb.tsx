import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';
import { useWettbewerbSearches } from '../hooks/useWettbewerbSearches';
import { useWettbewerbUsage } from '../hooks/useWettbewerbUsage';
import { useWettbewerbActions } from '../hooks/useWettbewerbActions';
import { SearchForm } from '../components/wettbewerb/SearchForm';
import { SavedSearchCard } from '../components/wettbewerb/SavedSearchCard';
import { WettbewerbGuideModal } from '../components/wettbewerb/WettbewerbGuideModal';
import { EmptyStateUpsellCard } from '../components/wettbewerb/EmptyStateUpsellCard';
import { Toast } from '../components/Toast';
import type { ToastType } from '../hooks/useAdsActions';

export function Wettbewerb() {
  const { t } = useTranslation();
  const { searches, isLoading } = useWettbewerbSearches();
  const { freeSearchUsed, freeLimit, additionalCost, hasSeenWettbewerb, isPlaceholderData: usageIsPlaceholder } =
    useWettbewerbUsage();
  const { createSavedSearch, deleteSavedSearch, applySuggestedPrice, triggerRepost, markGuideSeen, markSearchViewed, isCreating } =
    useWettbewerbActions();

  const [guideOpen, setGuideOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<ToastType>(null);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Must wait for real (non-placeholder) usage data — acting on the
    // placeholder default (hasSeenWettbewerb: false) would reopen the guide
    // for a returning user on every page load, before the real value loads.
    if (usageIsPlaceholder || hasAutoOpened) return;
    setHasAutoOpened(true);
    if (!hasSeenWettbewerb) {
      setGuideOpen(true);
      void markGuideSeen();
    }
  }, [usageIsPlaceholder, hasSeenWettbewerb, hasAutoOpened, markGuideSeen]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
      setToastType(null);
    }, 3000);
  };

  const handleCreateSearch = async (input: Parameters<typeof createSavedSearch>[0]) => {
    const res = await createSavedSearch(input);
    showToast(res.success ? t('wettbewerb.searchSaved') : res.message || t('wettbewerb.searchSaveFailed'), res.success ? 'success' : 'error');
  };

  const handleDelete = async (searchId: string) => {
    const res = await deleteSavedSearch(searchId);
    showToast(res.success ? t('wettbewerb.searchDeleted') : res.message || t('wettbewerb.searchDeleteFailed'), res.success ? 'success' : 'error');
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const usagePillText = t('wettbewerb.usagePill', { used: freeSearchUsed ? freeLimit : 0, limit: freeLimit });
  const quotaReached = freeSearchUsed && searches.length >= freeLimit;

  return (
    <div className="w-full relative">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#333]">{t('wettbewerb.title')}</h1>
        <p className="text-[13px] text-[#666] mt-1">
          {t('wettbewerb.subtitle')}
        </p>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <button
          onClick={() => setGuideOpen(true)}
          className="inline-flex items-center gap-1 text-[13px] text-[#A8C300] hover:text-[#96ae00] font-medium"
        >
          <HelpCircle className="w-3.5 h-3.5" /> {t('wettbewerb.howItWorks')}
        </button>
        <span className="inline-flex items-center text-[12px] font-medium bg-[#f2f7e6] text-[#6f8f00] px-2.5 py-1 rounded-full border border-[#d4e39a]">
          {usagePillText}
        </span>
      </div>

      {/* The form itself is always the real submission mechanism — even once
          the free quota is used, submitting still calls the backend, which
          gates additional searches on credits (stubbed for now). The upsell
          card below just points back here rather than submitting blank
          data on the user's behalf. */}
      <div ref={formRef}>
        <SearchForm onSubmit={handleCreateSearch} isSubmitting={isCreating} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white border border-[#e5e5e5] h-[120px] rounded-sm animate-pulse" />
          ))}
        </div>
      ) : searches.length === 0 ? (
        <EmptyStateUpsellCard
          variant={quotaReached ? 'quota-used' : 'first-time'}
          additionalCost={additionalCost}
          onAddSearch={scrollToForm}
          isSubmitting={isCreating}
        />
      ) : (
        <div className="space-y-3">
          {searches.map((search) => (
            <SavedSearchCard
              key={search.id}
              search={search}
              onDelete={handleDelete}
              onApplyPrice={applySuggestedPrice}
              onRepost={triggerRepost}
              onMarkViewed={markSearchViewed}
            />
          ))}
          {quotaReached && (
            <EmptyStateUpsellCard
              variant="quota-used"
              additionalCost={additionalCost}
              onAddSearch={scrollToForm}
              isSubmitting={isCreating}
            />
          )}
        </div>
      )}

      <WettbewerbGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <Toast message={toastMessage} type={toastType} />
    </div>
  );
}
