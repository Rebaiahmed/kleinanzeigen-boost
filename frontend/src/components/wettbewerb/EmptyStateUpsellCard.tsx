import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

interface EmptyStateUpsellCardProps {
  variant: 'first-time' | 'quota-used';
  additionalCost: number;
  onAddSearch: () => void;
  isSubmitting: boolean;
}

export function EmptyStateUpsellCard({ variant, additionalCost, onAddSearch, isSubmitting }: EmptyStateUpsellCardProps) {
  const { t } = useTranslation();

  if (variant === 'first-time') {
    return (
      <div className="text-center py-12 text-[#666]">
        <p className="mb-3">{t('wettbewerb.empty.firstTimeTitle')}</p>
        <p className="text-[13px] text-[#999]">
          {t('wettbewerb.empty.firstTimeText')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#e5e5e5] rounded-sm shadow-sm p-5 text-center">
      <p className="text-[13px] text-[#555] mb-3">{t('wettbewerb.empty.quotaUsedText')}</p>
      <button
        onClick={onAddSearch}
        disabled={isSubmitting}
        className="inline-flex items-center gap-1.5 bg-[#f2f2f2] hover:bg-[#e6e6e6] disabled:opacity-50 text-[#333] font-medium py-1.5 px-3 rounded-sm text-[13px] transition-colors border border-[#ccc]"
      >
        <Plus className="w-3.5 h-3.5" />
        {t('wettbewerb.empty.addSearch', { cost: additionalCost })}
      </button>
    </div>
  );
}
