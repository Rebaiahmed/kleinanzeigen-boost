import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, LogOut, Settings } from 'lucide-react';

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
      navigate('/auth');
    }
  };

  return (
    <header className="bg-white sticky top-0 z-50 border-b border-[#d4d4d4] shadow-sm">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-14">
          {/* Left: Logo */}
          <div className="flex">
            <Link to="/meine-anzeigen" className="flex-shrink-0 flex items-center text-[22px] tracking-tight">
              <span className="font-bold text-[#86b817]">kleinanzeigen</span>
              <span className="font-normal text-[#666] ml-1">Boost</span>
            </Link>
          </div>
          
          {/* Right: Profile & Logout */}
          <div className="flex items-center gap-3 border-l border-[#d4d4d4] pl-4 relative" ref={dropdownRef}>
            {user && (
              <span className="text-[13px] font-medium text-gray-600 flex items-center gap-1">
                👤 {user.email}
              </span>
            )}
            <span className="text-[#d4d4d4] hidden sm:inline">|</span>
            <button
              onClick={handleLogout}
              className="text-[13px] text-red-600 hover:text-red-700 transition-colors hidden sm:inline"
            >
              Logout
            </button>
            <span className="text-[#d4d4d4] hidden sm:inline">|</span>
            {user ? (
              <>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="h-8 w-8 rounded-full bg-[#A8C300] flex items-center justify-center text-white text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#A8C300] transition-shadow"
                >
                  {user!.initials}
                </button>
              </>
            ) : (
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="h-8 w-8 rounded-full bg-[#f5f5f5] border border-[#d4d4d4] flex items-center justify-center text-[#666] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#ccc] transition-shadow"
              >
                <User className="h-4 w-4" />
              </button>
            )}

            {isDropdownOpen && (
              <div className="absolute top-10 right-0 mt-2 w-56 bg-white border border-[#e5e5e5] rounded-sm shadow-lg py-1 z-50">
                {user && (
                  <div className="px-4 py-2 border-b border-[#f0f0f0] mb-1">
                    <p className="text-[12px] text-gray-500 truncate" title={user.fullEmail}>
                      {user.fullEmail}
                    </p>
                  </div>
                )}
                
                <Link
                  to="/einstellungen"
                  onClick={() => setIsDropdownOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors focus:bg-gray-50 focus:outline-none"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  <span>Einstellungen</span>
                </Link>
                
                <div className="h-px bg-[#f0f0f0] my-1" />
                
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors focus:bg-red-50 focus:outline-none"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  <span>Abmelden</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
