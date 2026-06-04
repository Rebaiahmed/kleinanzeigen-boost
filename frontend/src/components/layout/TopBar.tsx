import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, LogOut } from 'lucide-react';

function getUserFromToken(): { email: string; initials: string } | null {
  try {
    const token = localStorage.getItem('kb_session') || localStorage.getItem('token');
    if (!token) return null;
    // JWT payload is the second base64 segment
    const payload = JSON.parse(atob(token.split('.')[1]));
    const email: string = payload.email || '';
    if (!email) return null;
    // Build display name from email prefix (e.g. "ahmed.test@mail.de" → "Ahmed")
    const prefix = email.split('@')[0];
    const display = prefix.charAt(0).toUpperCase() + prefix.slice(1).replace(/[._-]/g, ' ');
    const initials = prefix.slice(0, 2).toUpperCase();
    return { email: display, initials };
  } catch {
    return null;
  }
}

export function TopBar() {
  const navigate = useNavigate();
  const user = useMemo(() => getUserFromToken(), []);

  const handleLogout = () => {
    localStorage.removeItem('kb_session');
    localStorage.removeItem('token');
    navigate('/auth');
  };

  return (
    <header className="bg-white sticky top-0 z-50 border-b border-[#d4d4d4] shadow-sm">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-14">
          {/* Left: Logo */}
          <div className="flex">
            <Link to="/m-meine-anzeigen" className="flex-shrink-0 flex items-center text-[22px] tracking-tight">
              <span className="font-bold text-[#86b817]">kleinanzeigen</span>
              <span className="font-normal text-[#666] ml-1">Boost</span>
            </Link>
          </div>
          
          {/* Right: Profile & Logout */}
          <div className="flex items-center gap-3 border-l border-[#d4d4d4] pl-4">
            {user ? (
              <>
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[13px] font-bold text-[#333] leading-tight">{user.email}</span>
                </div>
                <div className="h-8 w-8 rounded-full bg-[#A8C300] flex items-center justify-center text-white text-[11px] font-bold cursor-default select-none">
                  {user.initials}
                </div>
              </>
            ) : (
              <div className="h-8 w-8 rounded-full bg-[#f5f5f5] border border-[#d4d4d4] flex items-center justify-center text-[#666]">
                <User className="h-4 w-4" />
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Abmelden"
              className="h-8 w-8 rounded-full flex items-center justify-center text-[#999] hover:text-[#ef4444] hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
