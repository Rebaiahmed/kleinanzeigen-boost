import { useState } from 'react';

interface LoginFormProps {
  onLoginSuccess: () => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!email) {
      setError('Bitte gib deine E-Mail-Adresse ein.');
      return;
    }
    
    setIsLoading(true);
    setError('');

    chrome.runtime.sendMessage({ type: 'FETCH_AND_LOGIN', payload: { email } }, (response) => {
      setIsLoading(false);
      if (response && response.success) {
        onLoginSuccess();
      } else {
        setError(response?.error || 'Fehler beim Verbinden. Bist du bei Kleinanzeigen eingeloggt?');
      }
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-brand-light p-4">
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-brand-dark mb-2 text-center">AnzeigenBoost</h1>
        <p className="text-sm text-gray-600 mb-6 text-center">Verbinde dein Kleinanzeigen-Konto automatisch.</p>
        
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-4 border border-red-200">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail-Adresse</label>
          <input 
            type="email" 
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand"
            placeholder="deine@email.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">Die E-Mail deines AnzeigenBoost-Kontos.</p>
        </div>

        <button 
          className={`w-full text-white py-2 rounded font-medium transition-colors flex justify-center items-center ${isLoading ? 'bg-gray-400' : 'bg-brand hover:bg-brand-dark'}`}
          onClick={handleConnect}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verbinden...
            </span>
          ) : (
            'Mit Kleinanzeigen verbinden'
          )}
        </button>
      </div>
    </div>
  );
}
