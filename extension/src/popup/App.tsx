import { useState } from 'react';

function App() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState('');

  const initiateHandshake = () => {
    setIsInitializing(true);
    setError('');
    
    chrome.runtime.sendMessage({ type: 'INIT_HANDSHAKE' }, (response) => {
      setIsInitializing(false);
      
      if (chrome.runtime.lastError) {
        setError('Erweiterungsfehler: ' + chrome.runtime.lastError.message);
        return;
      }
      
      if (response?.success) {
        // Redirection to Web App happens in the background script automatically.
        window.close(); // Close the popup since we redirected them to the web app
      } else {
        setError(response?.error || 'Unbekannter Fehler beim Handshake.');
      }
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-brand-light p-4">
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-brand-dark mb-2">AnzeigenBoost</h1>
        <p className="text-sm text-gray-600 mb-6">Verknüpfe deine aktuelle Kleinanzeigen.de Sitzung mit dem Web-Dashboard.</p>
        
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-4 border border-red-200">
            {error}
          </div>
        )}

        <button 
          className={`w-full text-white py-3 rounded font-medium transition-colors flex justify-center items-center ${isInitializing ? 'bg-gray-400' : 'bg-brand hover:bg-brand-dark'}`}
          onClick={initiateHandshake}
          disabled={isInitializing}
        >
          {isInitializing ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sitzung wird übertragen...
            </span>
          ) : (
            'Sitzung an Web App übertragen'
          )}
        </button>
      </div>
    </div>
  );
}

export default App;
