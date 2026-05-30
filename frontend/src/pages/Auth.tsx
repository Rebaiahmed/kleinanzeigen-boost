import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export function Auth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [errors, setErrors] = useState<{ email?: string; password?: string; top?: string }>({});

  const validate = () => {
    const newErrors: any = {};
    if (!email) {
      newErrors.email = 'Bitte gib eine gültige E-Mail-Adresse ein.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Die E-Mail-Adresse ist ungültig.';
    }
    if (!password) {
      newErrors.password = 'Bitte gib dein Passwort ein.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setErrors({});

    try {
      // Stub integration to the real endpoint
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error('Deine Zugangsdaten sind nicht korrekt.');
      }

      // If success, global state update would happen here (e.g., via Zustand or Context)
      // For now, redirect directly:
      navigate('/m-meine-anzeigen');
    } catch (error: any) {
      setErrors({ top: error.message || 'Ein Fehler ist aufgetreten.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-[400px]">
        <h2 className="text-center text-[24px] font-bold text-[#333] mb-6">
          Anmelden
        </h2>
        
        {errors.top && (
          <div className="mb-4 bg-[#fde8e8] border border-[#f8b4b4] text-[#c53030] text-[14px] px-4 py-3 rounded-sm">
            {errors.top}
          </div>
        )}

        <div className="bg-white py-8 px-6 border border-[#dcdcdc] rounded-sm">
          <form className="flex flex-col gap-y-4" onSubmit={handleSubmit}>
            
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-[14px] font-semibold text-[#333] mb-1">
                E-Mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`appearance-none block w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-[#dcdcdc]'} rounded-sm placeholder-gray-400 focus:outline-none focus:border-[#333] text-[15px] transition-colors`}
              />
              {errors.email && <p className="mt-1 text-[12px] text-red-500">{errors.email}</p>}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-[14px] font-semibold text-[#333] mb-1">
                Passwort
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`appearance-none block w-full px-3 py-2 border ${errors.password ? 'border-red-500' : 'border-[#dcdcdc]'} rounded-sm placeholder-gray-400 focus:outline-none focus:border-[#333] text-[15px] transition-colors pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-[12px] text-red-500">{errors.password}</p>}
            </div>

            {/* Submit Button */}
            <div className="mt-6">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-sm text-[16px] font-bold text-white bg-[#A8C300] hover:bg-[#96ae00] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#A8C300] transition-colors disabled:opacity-70"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Anmelden'}
              </button>
            </div>


            
          </form>
        </div>
      </div>
    </div>
  );
}
