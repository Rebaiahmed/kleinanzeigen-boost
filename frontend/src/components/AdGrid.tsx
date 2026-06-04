import React from 'react';
import { AdCard } from './AdCard';

interface AdGridProps {
  ads: any[];
  onAction: (action: string, adId: string, successMsg: string) => void;
  onAIOptimize: (adId: string) => void;
  onPriceCheck: (adId: string) => void;
  onSchedule: (adId: string) => void;
  onVintedCrossPost: (adId: string, reserveAfterPost: boolean) => Promise<any>;
  onEbayCrossPost: (adId: string) => Promise<any>;
  onConnectVinted: () => void;
  onConnectEbay: () => void;
  isEbayConnected?: boolean;
  isVintedConnected?: boolean;
}

export function AdGrid({
  ads,
  onAction,
  onAIOptimize,
  onPriceCheck,
  onSchedule,
  onVintedCrossPost,
  onEbayCrossPost,
  onConnectVinted,
  onConnectEbay,
  isEbayConnected,
  isVintedConnected,
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
          onConnectVinted={onConnectVinted}
          onConnectEbay={onConnectEbay}
          isEbayConnected={isEbayConnected}
          isVintedConnected={isVintedConnected}
        />
      ))}
    </div>
  );
}
