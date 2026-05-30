import React, { useEffect, useState } from 'react';

interface SupportConfig {
  paypalDonateUrl?: string;
  githubUrl?: string;
  kofiUrl?: string;
  message?: string;
}

export function SupportMe() {
  const [config, setConfig] = useState<SupportConfig | null>(null);

  useEffect(() => {
    // In a real implementation this uses Axios or React Query
    fetch('http://localhost:3000/support/config')
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error('Failed to fetch support config', err));
  }, []);

  if (!config) return null;

  return (
    <div className="bg-[#FFFDF5] border-2 border-dashed border-ka-gray-200 rounded-xl p-8 max-w-2xl mx-auto text-center shadow-sm">
      <h2 className="text-2xl font-bold text-ka-gray-900 mb-4 flex items-center justify-center gap-2">
        <span role="img" aria-label="Coffee">☕</span> Dieses Tool unterstützen
      </h2>
      <p className="text-ka-gray-600 mb-6 max-w-lg mx-auto">
        {config.message || 'AnzeigenBoost ist ein Seitenprojekt das ich in meiner Freizeit entwickle. Wenn es dir hilft, freue ich mich sehr über eine kleine Unterstützung!'}
      </p>

      <div className="flex flex-wrap justify-center gap-4 mb-4">
        {config.paypalDonateUrl && (
          <a
            href={config.paypalDonateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#003087] hover:bg-[#002260] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
               <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"/>
            </svg>
            Mit PayPal unterstützen
          </a>
        )}

        {config.kofiUrl && (
          <a
            href={config.kofiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#FF5E5B] hover:bg-[#E0504D] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <span role="img" aria-label="Coffee">☕</span> Kaffee ausgeben
          </a>
        )}

        {config.githubUrl && (
          <a
            href={config.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-ka-gray-900 hover:bg-ka-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <span role="img" aria-label="Star">⭐</span> Auf GitHub geben
          </a>
        )}
      </div>

      <p className="text-xs text-ka-gray-400">
        Du wirst zu PayPal/Ko-fi weitergeleitet. Keine Daten werden an Dritte weitergegeben.<br />
        Sicher & anonym • Jeder Betrag hilft
      </p>
    </div>
  );
}
