import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PhotoFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  feedback: any;
  photos: string[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function PhotoFeedbackModal({
  isOpen,
  onClose,
  feedback,
  photos: initialPhotos,
  isLoading,
  error,
  onRetry,
}: PhotoFeedbackModalProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const photos = (initialPhotos || []).filter(p => p && typeof p === 'string');

  const dimensionNames: Record<string, string> = {
    lighting: 'Beleuchtung',
    clarity: 'Schärfe',
    background: 'Hintergrund',
    composition: 'Anordnung',
    coverage: 'Abdeckung',
  };


  if (!isOpen) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const overallColor = getScoreColor(feedback?.overall || 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">Foto-Analyse</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-600 mb-3" />
              <p className="text-xs text-gray-600">Wird analysiert…</p>
            </div>
          ) : error ? (
            <div className="bg-gray-50 border border-gray-200 rounded p-2 mb-4">
              <p className="text-gray-700 text-xs leading-relaxed">{error}</p>
            </div>
          ) : feedback ? (
            <>
              {/* Photo Carousel */}
              {photos.length > 0 ? (
                <div className="mb-4">
                  <div className="relative bg-gray-100 rounded overflow-hidden" style={{ paddingBottom: '100%' }}>
                    <img
                      key={`photo-${currentPhotoIndex}`}
                      src={photos[currentPhotoIndex]}
                      alt={`Foto ${currentPhotoIndex + 1}`}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  {photos.length > 1 && (
                    <div className="flex items-center justify-between mt-2 px-2">
                      <button
                        onClick={() => setCurrentPhotoIndex((i) => (i > 0 ? i - 1 : photos.length - 1))}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Vorheriges Foto"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                      </button>
                      <span className="text-xs text-gray-600">
                        {currentPhotoIndex + 1} von {photos.length}
                      </span>
                      <button
                        onClick={() => setCurrentPhotoIndex((i) => (i < photos.length - 1 ? i + 1 : 0))}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Nächstes Foto"
                      >
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-4 p-3 bg-gray-50 rounded text-xs text-gray-600 text-center">
                  Keine Fotos
                </div>
              )}

              {/* Overall Score */}
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Gesamt</span>
                  <span className={`text-2xl font-bold ${overallColor}`}>
                    {feedback.overall}
                  </span>
                </div>
              </div>

              {/* Dimension Scores */}
              <div className="mb-4 space-y-2">
                {Object.entries(feedback.scores || {}).map(([dimension, score]: [string, any]) => (
                  <div key={dimension} className="flex items-center justify-between text-xs">
                    <span className="text-gray-800 font-medium w-24">{dimensionNames[dimension] || dimension}</span>
                    <div className="flex-1 mx-2 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gray-600 rounded-full"
                        style={{ width: `${Math.min(score, 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-700 font-medium w-6 text-right">{score}</span>
                  </div>
                ))}
              </div>

              {/* Strengths & Suggestions */}
              {feedback.strengths && feedback.strengths.length > 0 && (
                <div className="mb-3 text-xs">
                  <p className="font-medium text-gray-800 mb-1">✓ Stärken</p>
                  <ul className="space-y-0.5">
                    {feedback.strengths.map((s: string, i: number) => (
                      <li key={i} className="text-gray-700">• {s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {feedback.suggestions && feedback.suggestions.length > 0 && (
                <div className="text-xs">
                  <p className="font-medium text-gray-800 mb-1">Verbesserungen</p>
                  <ul className="space-y-0.5">
                    {feedback.suggestions.slice(0, 2).map((s: string, i: number) => (
                      <li key={i} className="text-gray-700">• {s.split(':')[0]}</li>
                    ))}
                  </ul>
                </div>
              )}

              {onRetry && (
                <button
                  onClick={onRetry}
                  className="w-full mt-4 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded hover:bg-gray-50 transition-colors"
                >
                  Neu analysieren
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
