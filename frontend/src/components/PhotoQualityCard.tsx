import React, { useState } from 'react';
import { X } from 'lucide-react';

interface PhotoQualityCardProps {
  onDismiss?: () => void;
}

export function PhotoQualityCard({ onDismiss }: PhotoQualityCardProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-lg shadow-md border border-blue-200">
      {/* Gradient Border */}
      <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-400" />

      {/* Content */}
      <div className="bg-white p-6 relative">
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4 pr-8">
          {/* Icon */}
          <div className="text-5xl flex-shrink-0">📷</div>

          {/* Text Content */}
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              Foto-Qualität verbessern
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              Deine Fotos sind entscheidend für Verkaufserfolg! Analysiere sie mit KI und erhalte
              konkrete, sofort umsetzbare Verbesserungsvorschläge.
            </p>

            {/* Value Proposition */}
            <div className="grid grid-cols-3 gap-3 mb-5 bg-gray-50 p-3 rounded">
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600">5</div>
                <div className="text-xs text-gray-600">Kategorien</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600">∞</div>
                <div className="text-xs text-gray-600">Alle Fotos</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600">⚡</div>
                <div className="text-xs text-gray-600">Sofort</div>
              </div>
            </div>

            {/* Info Text */}
            <p className="text-xs text-gray-600">
              👇 Scrolle nach unten und klicke auf „Foto-Check" bei einer deiner Anzeigen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
