import React from 'react';
import { AdCard } from './AdCard';

interface AdGridProps {
  ads: any[];
  onAction: (action: string, adId: string, successMsg: string) => void;
  onAIOptimize: (adId: string) => void;
  onPriceCheck: (adId: string, title: string) => Promise<{ suggestedPrice: number; reasoning: string } | null>;
  onSchedule: (adId: string) => void;
  onEbayCrossPost: (adId: string) => Promise<any>;
  onConnectEbay: () => void;
  isEbayConnected?: boolean;
  onUpdateFields: (adId: string, fields: any) => Promise<boolean>;
  aiBlocked?: boolean;
  aiWarning?: boolean;
}

export function AdGrid({
  ads,
  onAction,
  onAIOptimize,
  onPriceCheck,
  onSchedule,
  onEbayCrossPost,
  onConnectEbay,
  isEbayConnected,
  onUpdateFields,
  aiBlocked = false,
  aiWarning = false,
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
          onEbayCrossPost={onEbayCrossPost}
          onConnectEbay={onConnectEbay}
          isEbayConnected={isEbayConnected}
          onUpdateFields={onUpdateFields}
          aiBlocked={aiBlocked}
          aiWarning={aiWarning}
        />
      ))}
    </div>
  );
}
