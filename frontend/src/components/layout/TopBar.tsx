import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, LogOut, Settings, HelpCircle, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '../BrandMark';

function getUserFromToken(): { email: string; initials: string; fullEmail: string } | null {
  try {
    const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));

    // Priority 1: email in JWT (email-based login)
    if (payload.email) {
      const prefix = payload.email.split('@')[0];
      const display = prefix.charAt(0).toUpperCase() + prefix.slice(1).replace(/[._-]/g, ' ');
      return { email: display, initials: prefix.slice(0, 2).toUpperCase(), fullEmail: payload.email };
    }

    return null;
  } catch {
    return null;
  }
}

export function TopBar() {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState(() => getUserFromToken());
  const { t } = useTranslation();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };
    
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
      const apiBase = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';
      await fetch(`${apiBase}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      console.error(e);
    } finally {
      localStorage.removeItem('kb_session');
      localStorage.removeItem('token');
      localStorage.removeItem('kb_username');
      sessionStorage.clear();
      navigate('/login');
    }
  };

  return (
    <header className="bg-white dark:bg-[#26282c] sticky top-0 z-50 border-b border-[#d4d4d4] dark:border-[#3a3d42] shadow-sm">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-14">
          {/* Left: Logo */}
          <div className="flex">
            <Link to="/meine-anzeigen" className="flex-shrink-0 flex items-center gap-1.5 text-[22px] tracking-tight">
              <BrandMark className="h-7 w-auto shrink-0" />
              <span className="font-bold text-[#1F2937] dark:text-[#f5f5f5]">Anzeigen</span>
              <span className="font-bold text-[#A8C300]">Boost</span>
            </Link>
          </div>
          
          {/* Right: account menu */}
          <div className="flex items-center gap-3 border-l border-[#d4d4d4] dark:border-[#3a3d42] pl-4 relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={isDropdownOpen}
              aria-label={t('topbar.accountMenu')}
              className="flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1.5 md:py-1 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#A8C300] transition-colors"
            >
              {user ? (
                <span className="h-8 w-8 rounded-full bg-[#A8C300] flex items-center justify-center text-white text-[11px] font-bold">
                  {user.initials}
                </span>
              ) : (
                <span className="h-8 w-8 rounded-full bg-[#f5f5f5] border border-[#d4d4d4] flex items-center justify-center text-[#666]">
                  <User className="h-4 w-4" />
                </span>
              )}
              {user && (
                <span className="text-[13px] font-medium text-gray-700 hidden sm:inline max-w-[140px] truncate">
                  {user.email}
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {isDropdownOpen && (
              <div
                role="menu"
                aria-label={t('topbar.account')}
                className="absolute top-12 right-0 mt-1 w-56 bg-white dark:bg-[#2c2f33] border border-[#e5e5e5] dark:border-[#3a3d42] rounded-md shadow-lg py-1 z-50"
              >
                {user && (
                  <div className="px-4 py-2 border-b border-[#f0f0f0] dark:border-[#3a3d42] mb-1">
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">{t('topbar.loggedInAs')}</p>
                    <p className="text-[12px] text-gray-600 dark:text-gray-300 truncate" title={user.fullEmail}>
                      {user.fullEmail}
                    </p>
                  </div>
                )}

                <Link
                  to="/einstellungen"
                  role="menuitem"
                  onClick={() => setIsDropdownOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#35383c] transition-colors focus:bg-gray-50 dark:focus:bg-[#35383c] focus:outline-none"
                >
                  <Settings className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span>{t('topbar.settings')}</span>
                </Link>

                {/* Opens the support/feedback form in a new tab. A mailto: link
                    silently does nothing when no desktop mail client is set as
                    default, so we link to a real page instead. */}
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSfWFO_imx_NLkCTGjphKV1gwogiHbZTxmjUEzVHma79n1gE_w/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  onClick={() => setIsDropdownOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#35383c] transition-colors focus:bg-gray-50 dark:focus:bg-[#35383c] focus:outline-none"
                >
                  <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span>{t('topbar.help')}</span>
                </a>

                <div className="h-px bg-[#f0f0f0] dark:bg-[#3a3d42] my-1" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus:bg-red-50 dark:focus:bg-red-900/20 focus:outline-none"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  <span>{t('topbar.logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
