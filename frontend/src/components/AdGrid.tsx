import React from 'react';
import { AdCard } from './AdCard';

interface AdGridProps {
  ads: any[];
  onAction: (action: string, adId: string, successMsg: string) => void;
  onAIOptimize: (adId: string) => void;
  onPriceCheck: (adId: string, title: string) => Promise<{ suggestedPrice: number; reasoning: string } | null>;
  onSchedule: (adId: string) => void;
  onVintedCrossPost: (adId: string, reserveAfterPost: boolean) => Promise<any>;
  onEbayCrossPost: (adId: string) => Promise<any>;
  onConnectVinted: () => void;
  onConnectEbay: () => void;
  isEbayConnected?: boolean;
  isVintedConnected?: boolean;
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
  onVintedCrossPost,
  onEbayCrossPost,
  onConnectVinted,
  onConnectEbay,
  isEbayConnected,
  isVintedConnected,
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
          onVintedCrossPost={onVintedCrossPost}
          onEbayCrossPost={onEbayCrossPost}
          onConnectVinted={onConnectVinted}
          onConnectEbay={onConnectEbay}
          isEbayConnected={isEbayConnected}
          isVintedConnected={isVintedConnected}
          onUpdateFields={onUpdateFields}
          aiBlocked={aiBlocked}
          aiWarning={aiWarning}
        />
      ))}
    </div>
  );
}
