import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Verifiziere sichere Sitzung...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const exchangeToken = async () => {
      const token = searchParams.get('token');
      if (!token) {
        setError('Kein Token in der URL gefunden.');
        return;
      }

      try {
        // Exchange the temporary handshake token
        setStatus('Tausche Token gegen Sitzung...');
        
        // Remove token from URL immediately for security (prevent replay if copied)
        window.history.replaceState({}, document.title, '/auth/callback');

        const apiUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
        
        const exchangeRes = await axios.post(`${apiUrl}/auth/exchange-token`, { token }, {
          withCredentials: true
        });

        if (exchangeRes.data.success) {
          localStorage.setItem('kb_session', exchangeRes.data.accessToken);
          localStorage.setItem('token', exchangeRes.data.accessToken);
          setStatus('Sitzung erfolgreich verknüpft! Synchronisiere Anzeigen...');
          
          // Trigger initial ad sync securely
          try {
            await axios.post(`${apiUrl}/ads/sync`, {}, {
              withCredentials: true
            });
          } catch (syncErr) {
            console.warn('Initial sync failed, but login succeeded.', syncErr);
          }

          // Redirect to the dashboard
          navigate('/m-meine-anzeigen', { replace: true });
        }
      } catch (err: any) {
        console.error('Handshake error:', err);
        setError(err.response?.data?.message || err.message || 'Fehler beim Token-Austausch.');
      }
    };

    exchangeToken();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-brand-dark mb-4">AnzeigenBoost</h1>
        {error ? (
          <div>
            <div className="bg-red-50 text-red-600 p-4 rounded mb-4">
              {error}
            </div>
            <button 
              onClick={() => navigate('/auth')}
              className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-dark"
            >
              Zurück zum Login
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <svg className="animate-spin h-10 w-10 text-brand mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-700 font-medium">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
