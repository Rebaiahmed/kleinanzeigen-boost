import React from 'react';
import { AdCard } from './AdCard';

interface AdGridProps {
  ads: any[];
  onAction: (action: string, adId: string, successMsg: string) => void;
  onAIOptimize: (adId: string) => void;
  onPriceCheck: (adId: string) => void;
  onSchedule: (adId: string) => void;
  onVintedCrossPost: (adId: string) => void;
  onEbayCrossPost: (adId: string) => void;
}

export function AdGrid({
  ads,
  onAction,
  onAIOptimize,
  onPriceCheck,
  onSchedule,
  onVintedCrossPost,
  onEbayCrossPost,
}: AdGridProps) {
  return (
    <div className="space-y-3">
      {ads.map((ad) => (
        <AdCard
          key={ad.id}
          ad={ad}
          onAction={onAction}
          onAIOptimize={onAIOptimize}
          onPriceCheck={onPriceCheck}
          onSchedule={onSchedule}
          onVintedCrossPost={onVintedCrossPost}
          onEbayCrossPost={onEbayCrossPost}
        />
      ))}
    </div>
  );
}
