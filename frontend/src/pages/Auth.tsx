import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock login success
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-ka-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-bold text-ka-gray-900">
          Einloggen
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-ka-gray-200">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ka-gray-700">
                E-Mail
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-ka-gray-200 rounded-md shadow-sm placeholder-ka-gray-400 focus:outline-none focus:ring-ka-gray-700 focus:border-ka-gray-700 sm:text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ka-gray-700">
                Passwort
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-ka-gray-200 rounded-md shadow-sm placeholder-ka-gray-400 focus:outline-none focus:ring-ka-gray-700 focus:border-ka-gray-700 sm:text-sm transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-ka-green-dark focus:ring-ka-green border-ka-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-ka-gray-900">
                  Angemeldet bleiben
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-ka-green-dark hover:text-ka-green">
                  Passwort vergessen?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-ka-green hover:bg-ka-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ka-green transition-colors"
              >
                Anmelden
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ka-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-ka-gray-600">
                  Noch kein Konto?
                </span>
              </div>
            </div>

            <div className="mt-6">
              <a
                href="#"
                className="w-full flex justify-center py-2.5 px-4 border border-ka-gray-300 rounded-md shadow-sm text-sm font-medium text-ka-gray-700 bg-white hover:bg-ka-gray-50 transition-colors"
              >
                Registrieren
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
