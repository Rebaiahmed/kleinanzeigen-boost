import React, { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

export function EbaySuccess() {
  useEffect(() => {
    // Post message to the opener window (the main dashboard)
    if (window.opener) {
      window.opener.postMessage({ type: 'EBAY_CONNECTED' }, '*');
    }
    // Close this popup after a short delay
    const timer = setTimeout(() => {
      window.close();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-md shadow-md flex flex-col items-center text-center max-w-sm">
        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Erfolgreich verbunden!</h1>
        <p className="text-gray-600 mb-6">
          Dein eBay-Konto wurde erfolgreich verknüpft. Dieses Fenster schließt sich automatisch.
        </p>
        <button
          onClick={() => window.close()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-sm transition-colors"
        >
          Fenster schließen
        </button>
      </div>
    </div>
  );
}
