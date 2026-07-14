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
  onCancelScheduledRepost?: (adId: string) => Promise<{ success: boolean; alreadyExecuting?: boolean }>;
  aiBlocked?: boolean;
  aiWarning?: boolean;
  repostRunningId?: string | null;
  repostQueuedIds?: string[];
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
  onCancelScheduledRepost,
  aiBlocked = false,
  aiWarning = false,
  repostRunningId = null,
  repostQueuedIds = [],
}: AdGridProps) {
  const repostBusy = repostRunningId !== null || repostQueuedIds.length > 0;
  return (
    <div className="space-y-3">
      {ads.map((ad) => {
        const repostState: 'idle' | 'running' | 'queued' =
          repostRunningId === ad.id ? 'running'
            : repostQueuedIds.includes(ad.id) ? 'queued'
            : 'idle';
        const queuePosition = repostQueuedIds.indexOf(ad.id); // -1 if not queued
        return (
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
            onCancelScheduledRepost={onCancelScheduledRepost}
            aiBlocked={aiBlocked}
            aiWarning={aiWarning}
            repostState={repostState}
            repostBusy={repostBusy}
            repostQueuePosition={queuePosition >= 0 ? queuePosition + 1 : 0}
          />
        );
      })}
    </div>
  );
}
